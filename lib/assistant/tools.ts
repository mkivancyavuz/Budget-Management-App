// Tools the assistant may call, and the code that runs them.
//
// The security property that matters: **no tool takes a user id.** The route
// resolves the account from the `sid` cookie and passes the already-loaded
// ledger into these executors. The model has no parameter through which it
// could address another tenant, so tenant isolation is a hard break in the
// query layer rather than something the model is trusted to respect. A prompt
// injection can at worst ask for the caller's own data.
//
// Writes work the same way: the propose_* tools return a *proposal*. Nothing
// touches the ledger here. The UI shows a confirmation card and, if the user
// accepts, the write goes through the app's normal allocate()/logIncome() path.
import type { Category, Transaction } from "@/lib/types";
import { transactionOutflow, round2 } from "@/lib/ledger";
import { buildSummary, categoryIndex, type AssistantSummary } from "./summary";

/** Hard cap on rows returned to the model, whatever it asks for. */
const MAX_ROWS = 120;

export interface ProposedEntry {
  kind: "expense" | "income";
  amount: number;
  /** Resolved category name for an expense. */
  category?: string;
  categoryId?: string;
  /** Client/source for income. */
  source?: string;
  date: string;
  note?: string;
}

export interface ToolContext {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Collected proposals, surfaced to the UI after the run. */
  proposals: ProposedEntry[];
}

/** OpenAI tool schemas. Deliberately narrow: every field is something the model
 * could plausibly know from the conversation, and nothing identifies an account. */
export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "get_summary",
      description:
        "Returns the signed-in user's financial summary: available cash, debt, per-category spend for this month and all time, and monthly income/expense/profit for the last 12 months. All figures are computed by the application, so use them verbatim and never recompute totals yourself.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_transactions",
      description:
        "Returns individual transactions when the summary isn't enough — for example a question about a specific client, note, or day. Results are capped and sorted newest first.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date, yyyy-mm-dd (inclusive). Optional." },
          to: { type: "string", description: "End date, yyyy-mm-dd (inclusive). Optional." },
          kind: {
            type: "string",
            enum: ["income", "expense", "all"],
            description: "Filter by direction. Defaults to all.",
          },
          category: { type: "string", description: "Category name to filter expenses by. Optional." },
          limit: { type: "number", description: `Max rows, capped at ${MAX_ROWS}.` },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_expense",
      description:
        "Proposes recording an expense. This does NOT save anything — it shows the user a confirmation card they must accept. Use it when the user asks to add or log a spend.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Positive amount." },
          category: { type: "string", description: "Existing category name." },
          date: { type: "string", description: "yyyy-mm-dd. Defaults to today. Cannot be in the future." },
          note: { type: "string", description: "Optional note." },
        },
        required: ["amount", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_income",
      description:
        "Proposes recording income. This does NOT save anything — the user must accept a confirmation card. Use it when the user asks to add a payment they received.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Positive amount." },
          source: { type: "string", description: "Who paid — client or source name." },
          date: { type: "string", description: "yyyy-mm-dd. Defaults to today. Cannot be in the future." },
          note: { type: "string", description: "Optional note." },
        },
        required: ["amount", "source"],
        additionalProperties: false,
      },
    },
  },
];

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isExpense(tx: Transaction): boolean {
  return tx.type === "spend" || tx.type === "allocate";
}

/** Runs one tool call and returns the JSON string handed back to the model. */
export function runTool(name: string, rawArgs: string, ctx: ToolContext): string {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return JSON.stringify({ error: "arguments were not valid JSON" });
  }

  switch (name) {
    case "get_summary": {
      const summary: AssistantSummary = buildSummary(ctx.transactions, ctx.categories, ctx.currency, ctx.t);
      return JSON.stringify(summary);
    }

    case "get_transactions": {
      const from = typeof args.from === "string" ? args.from : undefined;
      const to = typeof args.to === "string" ? args.to : undefined;
      const kind = args.kind === "income" || args.kind === "expense" ? args.kind : "all";
      const categoryName = typeof args.category === "string" ? args.category.toLowerCase() : undefined;
      const limit = Math.min(MAX_ROWS, Math.max(1, Number(args.limit) || 40));

      const index = categoryIndex(ctx.categories, ctx.t);
      const nameById = new Map(index.map((c) => [c.id, c.name]));

      const rows = ctx.transactions
        .filter((tx) => {
          if (from && tx.date < from) return false;
          if (to && tx.date > to) return false;
          if (kind === "income" && tx.type !== "income") return false;
          if (kind === "expense" && !isExpense(tx)) return false;
          if (categoryName) {
            const name = nameById.get(tx.meta?.categoryId ?? "")?.toLowerCase();
            if (name !== categoryName) return false;
          }
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
        .map((tx) => ({
          date: tx.date,
          kind: tx.type === "income" ? "income" : isExpense(tx) ? "expense" : tx.type,
          amount:
            tx.type === "income"
              ? round2(tx.postings.reduce((s, p) => s + p.amount, 0))
              : transactionOutflow(tx),
          category: nameById.get(tx.meta?.categoryId ?? "") ?? undefined,
          source: tx.meta?.source ?? undefined,
          note: tx.note ?? undefined,
        }));

      return JSON.stringify({ count: rows.length, cappedAt: limit, transactions: rows });
    }

    case "propose_expense": {
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return JSON.stringify({ error: "amount must be a positive number" });
      }
      const wanted = typeof args.category === "string" ? args.category.trim().toLowerCase() : "";
      const match = categoryIndex(ctx.categories, ctx.t).find((c) => c.name.toLowerCase() === wanted);
      if (!match) {
        return JSON.stringify({
          error: "no such category",
          availableCategories: categoryIndex(ctx.categories, ctx.t).map((c) => c.name),
        });
      }
      const date = typeof args.date === "string" && args.date ? args.date : today();
      if (date > today()) {
        return JSON.stringify({ error: "the date cannot be in the future" });
      }

      ctx.proposals.push({
        kind: "expense",
        amount: round2(amount),
        category: match.name,
        categoryId: match.id,
        date,
        note: typeof args.note === "string" ? args.note : undefined,
      });
      return JSON.stringify({
        status: "awaiting_user_confirmation",
        message: "A confirmation card has been shown to the user. Nothing is saved until they accept it.",
      });
    }

    case "propose_income": {
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return JSON.stringify({ error: "amount must be a positive number" });
      }
      const source = typeof args.source === "string" ? args.source.trim() : "";
      if (!source) return JSON.stringify({ error: "source is required" });
      const date = typeof args.date === "string" && args.date ? args.date : today();
      if (date > today()) {
        return JSON.stringify({ error: "the date cannot be in the future" });
      }

      ctx.proposals.push({
        kind: "income",
        amount: round2(amount),
        source,
        date,
        note: typeof args.note === "string" ? args.note : undefined,
      });
      return JSON.stringify({
        status: "awaiting_user_confirmation",
        message: "A confirmation card has been shown to the user. Nothing is saved until they accept it.",
      });
    }

    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}
