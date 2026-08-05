import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserIdForSession, SESSION_COOKIE } from "@/lib/serverSession";
import { categoryFromRow, transactionFromRow, type CategoryRow, type TransactionRow } from "@/lib/rows";
// From i18nDict, not i18n: the latter is a "use client" module, and importing
// it here would hand the route a client *reference* to translate() rather than
// the function. Calling that throws.
import { translate, type Lang } from "@/lib/i18nDict";
import { TOOL_SCHEMAS, runTool, type ToolContext } from "@/lib/assistant/tools";
import { buildSummary } from "@/lib/assistant/summary";
import { createTrace, redact, TRACE_ENABLED, type Trace } from "@/lib/assistant/trace";

// The assistant's server side. Three things are enforced here and nowhere else:
//
// 1. Tenant isolation. The account comes from the `sid` cookie; the ledger is
//    loaded with an explicit user_id filter. No tool accepts a user id, so the
//    model cannot ask about another account — the break is in this query layer,
//    not in the model's instructions.
// 2. The daily cap, checked before any paid API call is made.
// 3. The API key, which lives only in this process.
//
// Tools are called through a bounded loop. Writes are never performed: the
// propose_* tools return proposals that the UI asks the user to confirm.

const DAILY_MESSAGE_LIMIT = 30;
const MAX_TOOL_ROUNDS = 4;
const MODEL = process.env.ASSISTANT_MODEL || "gpt-5.6-luna";

// Any provider that speaks the OpenAI Chat Completions protocol works here:
// Groq, Cerebras, OpenRouter, Mistral, a local Ollama. The requirement is
// function calling — the assistant reads the ledger and drafts entries through
// `tools`, so a provider without tool support can chat but can't do the job.
//
// Trailing slashes are trimmed so both "https://x/v1" and "https://x/v1/" work.
const BASE_URL = (process.env.ASSISTANT_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

// Reasoning models spend tokens thinking before they write anything, and those
// tokens come out of the same output budget as the reply. OpenAI's guidance is
// to reserve ~25k for reasoning plus output; a small cap gets consumed by
// reasoning and returns an *empty* message, which looks exactly like a bug.
// This is a ceiling, not a spend — a two-sentence answer still bills for two
// sentences plus however much thinking it needed.
const MAX_OUTPUT_TOKENS = 25000;

// Must be "none" to use function tools on Chat Completions with the GPT-5.6
// family. The API is explicit about it:
//
//   "Function tools with reasoning_effort are not supported for gpt-5.6-luna in
//    /v1/chat/completions. To use function tools, use /v1/responses or set
//    reasoning_effort to 'none'."
//
// Note it has to be *sent* as "none", not omitted: with the parameter absent
// GPT-5.6 defaults to "medium" and the same rejection comes back. That is why
// the negotiation below cannot rescue this one by dropping the field.
//
// The cost of "none" is that the model does not deliberate before choosing a
// tool. Acceptable here — the work is "pick one of four tools, read the figures
// the app computed, answer in two sentences", not multi-step reasoning — and it
// is cheaper and faster besides. If answer quality ever needs real reasoning
// alongside tools, the upgrade path is the /v1/responses endpoint, which
// supports both together; that is a different request/response shape, so it
// would be a deliberate change rather than a tweak.
//
// Overridable because other providers read this field differently, and a few
// reject it outright — in which case the negotiation below drops it.
const REASONING_EFFORT = process.env.ASSISTANT_REASONING_EFFORT || "none";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

function systemPrompt(lang: Lang, summaryJson: string): string {
  const language = lang === "tr" ? "Turkish" : "English";
  return `You are the built-in assistant of "Budget Management", a budgeting app for freelancers with irregular income.

Reply in ${language}. Be brief and concrete; two or three sentences is usually enough. Never use markdown tables.

HOW THE APP WORKS — use this to answer "how do I…" questions:
- Available cash is money actually in the account. The app never lets the user budget against invoices that haven't been paid.
- "Log income" records a payment received: amount, who paid, date. Available cash goes up.
- "Log expense" records a spend against a category. If the amount exceeds available cash, the excess is recorded as debt rather than refused.
- "Expense Distribution" shows what each category cost this month; the pencil icon on a card corrects a mistyped amount by recording the difference (nothing is ever rewritten).
- The Debt card collects spending beyond available cash; "Pay Off Debt" or "Pay in Full" clears it from available cash.
- Income History shows month-to-month patterns. The Transaction Log lists every entry, grouped by month, and is append-only.
- The profile page holds the photo, username, password, currency (lira/dollar/euro) and account deletion.
- Income and expenses cannot be dated in the future.

RULES:
- Never invent or recalculate figures. Every number must come from a tool result. If you need data you don't have, call a tool.
- The summary below is already loaded, so simple questions need no tool call.
- To add a transaction, call propose_expense or propose_income. These do not save; the user gets a confirmation card. Say that you've prepared it and that they need to confirm.
- Don't give investment or legal advice. Observations about the user's own spending are fine.
- If asked something unrelated to this app or their finances, say briefly that it's outside what you can help with here.

CURRENT SUMMARY (all figures computed by the app):
${summaryJson}`;
}

async function checkAndIncrementQuota(userId: string): Promise<{ allowed: boolean; used: number }> {
  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);

  const { data } = await admin
    .from("assistant_usage")
    .select("message_count")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();

  const used = Number(data?.message_count ?? 0);
  if (used >= DAILY_MESSAGE_LIMIT) return { allowed: false, used };

  // Counted before the model runs: an over-count is harmless, an under-count
  // would let a failed-then-retried request slip past the cap.
  await admin.from("assistant_usage").upsert(
    { user_id: userId, day, message_count: used + 1 },
    { onConflict: "user_id,day" }
  );
  return { allowed: true, used: used + 1 };
}

/** Gives back a message the model never actually answered.
 *
 * The count is taken before the API call so a crash can't be used to slip past
 * the cap. But when the call fails outright — bad key, model not enabled,
 * network down — no tokens were spent and no answer was given, so charging the
 * user's daily allowance for it would be wrong. A misconfiguration would
 * otherwise burn the whole day in thirty retries. */
async function refundQuota(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from("assistant_usage")
      .select("message_count")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle();
    const used = Number(data?.message_count ?? 0);
    if (used <= 0) return;
    await admin
      .from("assistant_usage")
      .upsert({ user_id: userId, day, message_count: used - 1 }, { onConflict: "user_id,day" });
  } catch (e) {
    // A failed refund is not worth failing the request over.
    console.error("[assistant] quota refund failed", e);
  }
}

const NEGOTIABLE_PARAMS = ["max_completion_tokens", "max_tokens", "temperature", "reasoning_effort"] as const;

/** Parameters the configured model has already been observed to reject.
 *
 * Discovery costs a failed request, and the tool loop calls the model several
 * times per user message — without this, every round of every request pays that
 * cost again. Remembering it means the price is paid once per process.
 *
 * Process-local and unkeyed, which is safe because MODEL and BASE_URL come from
 * the environment and cannot change while the process runs. */
const knownUnsupportedParams = new Set<string>();

/** Calls Chat Completions, dropping request parameters the model rejects.
 *
 * Model families disagree about the request body: reasoning models want
 * `max_completion_tokens` where older ones want `max_tokens`, they reject a
 * `temperature` other than the default, and `reasoning_effort` is meaningless
 * to a non-reasoning model. Hard-coding one shape means the assistant breaks
 * whenever ASSISTANT_MODEL is pointed at a different family.
 *
 * So the optimistic body goes out first, and when the API names a parameter it
 * won't accept, that parameter is removed and the request retried. Only
 * parameters that are tuning knobs get dropped this way — `messages`, `tools`
 * and `model` are never negotiable, so a failure there is a real failure.
 *
 * Dropping is not always the right repair. When the API rejects a parameter's
 * *value* rather than its presence — "set reasoning_effort to 'none'" — removing
 * the field just lets the model apply its default and fail identically. The loop
 * detects that (the same parameter named twice, already absent) and stops rather
 * than spinning; the correct value has to be configured, not guessed. */
async function callChatCompletions(
  apiKey: string,
  body: Record<string, unknown>,
  trace: Trace
): Promise<
  | { ok: true; data: unknown; requestId: string; sentBody: Record<string, unknown> }
  | { ok: false; status: number; detail: string; requestId: string; sentBody: Record<string, unknown> }
> {
  const negotiable = new Set<string>(NEGOTIABLE_PARAMS);
  const attempt = { ...body };

  // Start from what previous requests already learned.
  const askedForTokenCap = "max_completion_tokens" in attempt || "max_tokens" in attempt;
  for (const param of knownUnsupportedParams) {
    if (param in attempt) {
      delete attempt[param];
      trace.step(`omitting "${param}": ${MODEL} rejected it earlier in this process`);
    }
  }

  // A token ceiling is not a tuning knob that can simply be dropped: without one
  // the reply is unbounded. When the cache removes the spelling this model
  // rejects, the other spelling has to take its place — the rejection path does
  // this too, but the cache short-circuits that path on every later request.
  if (
    askedForTokenCap &&
    !("max_completion_tokens" in attempt) &&
    !("max_tokens" in attempt) &&
    !knownUnsupportedParams.has("max_tokens")
  ) {
    attempt.max_tokens = MAX_OUTPUT_TOKENS;
    trace.step(`restored a token ceiling as "max_tokens" (${MAX_OUTPUT_TOKENS})`);
  }

  // At most one strip per negotiable parameter, then give up.
  for (let i = 0; i <= negotiable.size; i++) {
    trace.step(`--> POST ${BASE_URL}/chat/completions${i > 0 ? ` (retry ${i})` : ""}`, attempt);

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(attempt),
    });

    // The provider's request id. It identifies this exact call in their systems
    // and is the first thing their support asks for, so it must not be thrown
    // away — on success either, so a slow or odd-but-successful call can still
    // be looked up.
    const requestId = res.headers.get("x-request-id") ?? "";

    if (res.ok) {
      const data = await res.json();
      trace.step(`<-- ${res.status} OK  request id: ${requestId || "(none)"}`, data);
      return { ok: true, data, requestId, sentBody: attempt };
    }

    const detail = await res.text().catch(() => "");
    trace.fail(`<-- ${res.status}  request id: ${requestId || "(none)"}`, detail);

    // `param` names the offending field; some errors only mention it in the
    // message ("Unsupported parameter: 'max_tokens' ..."), so check both.
    let offender: string | undefined;
    try {
      const parsed = JSON.parse(detail);
      const named = parsed?.error?.param;
      if (typeof named === "string" && negotiable.has(named)) offender = named;
      if (!offender && typeof parsed?.error?.message === "string") {
        offender = [...negotiable].find((p) => parsed.error.message.includes(p));
      }
    } catch {
      // Not JSON — nothing to negotiate over.
    }

    if (!offender) {
      return { ok: false, status: res.status, detail, requestId, sentBody: attempt };
    }

    if (!(offender in attempt)) {
      // The parameter is named again although it is already gone, so the
      // complaint is about its *value*, not its presence, and no amount of
      // dropping will fix it. Say so plainly instead of returning a bare 400 —
      // this exact case cost a full debugging round to recognise.
      trace.fail(
        `"${offender}" was rejected again although it is not being sent. ` +
          `The API is objecting to its value, not its presence — read the message below and set it explicitly.`
      );
      return { ok: false, status: res.status, detail, requestId, sentBody: attempt };
    }

    trace.step(`negotiating: ${MODEL} rejected "${offender}", retrying without it`);
    delete attempt[offender];
    knownUnsupportedParams.add(offender);

    // Dropping the token cap outright would leave the request unbounded, so
    // swap in the other spelling once before letting it go.
    if (offender === "max_completion_tokens" && !("max_tokens" in attempt)) {
      attempt.max_tokens = MAX_OUTPUT_TOKENS;
      knownUnsupportedParams.delete("max_tokens");
    }
  }

  return {
    ok: false,
    status: 400,
    detail: "could not find a request shape this model accepts",
    requestId: "",
    sentBody: attempt,
  };
}

/** Returns the parsed object when the text is JSON, and the raw text otherwise.
 * Error bodies are usually JSON but a gateway failure can return HTML, and that
 * must not throw while we're already handling an error. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Development-only diagnosis of a `model_not_found`.
 *
 * `/v1/models` is a catalog: it enumerates the models a key can *see*, which is
 * not the same as the models a project may *call*. An earlier version of this
 * function reported the catalog as "models this key can use" and so confidently
 * recommended the very model that had just been refused. The distinction is the
 * whole diagnosis, so it's drawn explicitly here:
 *
 *   - model absent from the catalog  -> the name is wrong or retired.
 *   - model present but refused      -> the name is right and the block is an
 *                                       entitlement. Newer models are gated by
 *                                       account tier (several are unavailable on
 *                                       the free tier entirely), by per-project
 *                                       model restrictions, and by organisation
 *                                       verification. None of those are fixable
 *                                       from inside this app. */
async function modelAccessHint(apiKey: string, model: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return "";
    const data = await res.json();
    const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id).sort();
    if (ids.length === 0) return "";

    if (ids.includes(model)) {
      return (
        `\n\n"${model}" IS in this key's catalog at ${BASE_URL}, so the name is correct — ` +
        `the key is not entitled to call it. That's an account setting at the provider, not an app bug. Check, in order:\n` +
        `  1. Billing: some models are unavailable until an account has credits or a payment method.\n` +
        `  2. Per-project or per-key model restrictions in the provider's dashboard.\n` +
        `  3. Organisation verification, which a few newer models require.\n` +
        `Or point ASSISTANT_MODEL / ASSISTANT_BASE_URL at a model this key can already call.`
      );
    }

    // Show the whole catalog rather than guessing at name prefixes: a
    // third-party provider's ids look nothing like OpenAI's.
    const listed = ids.slice(0, 40);
    return (
      `\n\n"${model}" is not in this key's catalog at ${BASE_URL} at all, so the name is wrong or retired.` +
      (listed.length ? `\nCatalog lists: ${listed.join(", ")}${ids.length > listed.length ? ", …" : ""}` : "") +
      `\nNote: appearing in this list means visible, not necessarily callable.`
    );
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const trace = createTrace();
  trace.step(`=== assistant request  model=${MODEL}  base=${BASE_URL}  tracing=${TRACE_ENABLED}`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    trace.fail("no OPENAI_API_KEY set -> 503");
    return NextResponse.json({ error: "assistant_not_configured" }, { status: 503 });
  }
  trace.step(`api key present (${apiKey.length} chars)`);

  const cookieStore = await cookies();
  const userId = await getUserIdForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!userId) {
    trace.fail("no valid session for the sid cookie -> 401");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // A prefix only: enough to tell two accounts apart in a log, not enough to be
  // a copy of someone's user id sitting in a file.
  trace.step(`session resolved -> user ${userId.slice(0, 8)}…`);

  const body = (await request.json().catch(() => ({}))) as {
    messages?: { role: "user" | "assistant"; content: string }[];
    lang?: Lang;
    currency?: string;
  };
  const history = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  if (history.length === 0) {
    trace.fail("request carried no messages -> 400");
    return NextResponse.json({ error: "no_message" }, { status: 400 });
  }
  const lang: Lang = body.lang === "en" ? "en" : "tr";
  const currency = typeof body.currency === "string" ? body.currency : "TRY";

  trace.step(`>>> from browser  lang=${lang}  currency=${currency}  turns=${history.length}`, history);

  const quota = await checkAndIncrementQuota(userId);
  if (!quota.allowed) {
    trace.fail(`daily quota exhausted (${quota.used}/${DAILY_MESSAGE_LIMIT}) -> 429`);
    return NextResponse.json({ error: "quota_exceeded", limit: DAILY_MESSAGE_LIMIT }, { status: 429 });
  }
  trace.step(`quota ok: ${quota.used}/${DAILY_MESSAGE_LIMIT} used today`);

  // The ledger, scoped to this account by the query itself.
  const admin = createAdminClient();
  const [catsRes, txRes] = await Promise.all([
    admin.from("categories").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    admin.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: true }),
  ]);
  if (catsRes.error || txRes.error) {
    // Worth surfacing loudly: an empty ledger and a failed query look identical
    // to the model, and it would confidently report that you have no money.
    trace.fail("ledger query failed", { categories: catsRes.error, transactions: txRes.error });
  }
  const categories = ((catsRes.data ?? []) as CategoryRow[]).map(categoryFromRow);
  const transactions = ((txRes.data ?? []) as TransactionRow[]).map(transactionFromRow);

  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
  const ctx: ToolContext = { transactions, categories, currency, t, proposals: [] };

  const summary = buildSummary(transactions, categories, currency, t);
  trace.step(
    `ledger loaded for this account only: ${categories.length} categories, ${transactions.length} transactions`,
    summary
  );

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(lang, JSON.stringify(summary)) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      trace.step(`round ${round + 1}/${MAX_TOOL_ROUNDS}: conversation now has ${messages.length} messages`);

      const call = await callChatCompletions(
        apiKey,
        {
          model: MODEL,
          messages,
          tools: TOOL_SCHEMAS,
          // No `temperature`: reasoning models only accept the default, and the
          // answers here should be steady rather than varied anyway.
          max_completion_tokens: MAX_OUTPUT_TOKENS,
          reasoning_effort: REASONING_EFFORT,
        },
        trace
      );

      if (!call.ok) {
        // Always logged, tracing on or off, and never truncated: a clipped error
        // body is what made the earlier rounds of this debugging slow. The
        // request id is what the provider's support needs to find the call.
        // `messages` is omitted here because it carries the user's financial
        // summary; the parameters that actually cause rejections are kept.
        const paramsSent = { ...call.sentBody };
        delete paramsSent.messages;
        console.error(
          [
            `[assistant ${trace.id}] model request failed`,
            `  url:        ${BASE_URL}/chat/completions`,
            `  status:     ${call.status}`,
            `  request id: ${call.requestId || "(none returned)"}`,
            `  sent:       ${redact(JSON.stringify({ ...paramsSent, tools: `<${TOOL_SCHEMAS.length} tools>` }))}`,
            `  response:   ${redact(call.detail)}`,
          ].join("\n")
        );
        await refundQuota(userId);
        trace.step("quota refunded (no answer was produced)");

        // The real cause (bad key, no credit, model not enabled for the
        // project) is only useful while developing, and it can echo request
        // content — so it goes to the browser in dev only, never in production.
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "model_error" }, { status: 502 });
        }
        const hint = call.detail.includes("model_not_found") ? await modelAccessHint(apiKey, MODEL) : "";
        // Untruncated, so the bubble shows the same payload the provider sent
        // rather than a fragment that has to be reassembled from the terminal.
        return NextResponse.json(
          {
            error: "model_error",
            status: call.status,
            requestId: call.requestId,
            openaiError: safeJsonParse(call.detail),
            detail: `HTTP ${call.status}${call.requestId ? ` (request id: ${call.requestId})` : ""}\n${call.detail}${hint}`,
          },
          { status: 502 }
        );
      }

      const data = call.data as {
        choices?: { message?: Record<string, unknown>; finish_reason?: string }[];
        usage?: Record<string, unknown>;
      };
      const choice = data.choices?.[0];
      const message = choice?.message;
      if (data.usage) trace.step("token usage", data.usage);

      if (!message) {
        trace.fail("response had no choices[0].message -> 502", data);
        await refundQuota(userId);
        return NextResponse.json({ error: "model_error" }, { status: 502 });
      }

      const toolCalls = message.tool_calls as ChatMessage["tool_calls"];
      if (!toolCalls || toolCalls.length === 0) {
        const reply = typeof message.content === "string" ? message.content : "";
        // A reasoning model can hit the output ceiling while still thinking and
        // return nothing at all. Silence would read as a broken assistant, so
        // say what happened instead.
        if (!reply) {
          console.error(
            `[assistant ${trace.id}] empty reply, finish_reason=${choice?.finish_reason ?? "(none)"} — ` +
              `if this is "length", the output ceiling was consumed before any text was written`
          );
          trace.fail("<<< empty reply", { finish_reason: choice?.finish_reason, usage: data.usage });
          return NextResponse.json({
            reply: translate(lang, "assistant_truncated"),
            proposals: ctx.proposals,
            usage: { used: quota.used, limit: DAILY_MESSAGE_LIMIT },
          });
        }
        trace.step(`<<< to browser  finish_reason=${choice?.finish_reason ?? "(none)"}  ${trace.elapsedMs()}ms total`, {
          reply,
          proposals: ctx.proposals,
        });
        return NextResponse.json({
          reply,
          proposals: ctx.proposals,
          usage: { used: quota.used, limit: DAILY_MESSAGE_LIMIT },
        });
      }

      trace.step(
        `model asked for ${toolCalls.length} tool call(s): ${toolCalls.map((c) => c.function.name).join(", ")}`
      );

      // Record the model's turn, then answer each tool call.
      messages.push({
        role: "assistant",
        content: typeof message.content === "string" ? message.content : null,
        tool_calls: toolCalls,
      });
      for (const call of toolCalls) {
        const result = runTool(call.function.name, call.function.arguments, ctx);
        // Both halves of the tool exchange: what the model asked for, and the
        // figures the app handed back. This is where a wrong answer usually
        // becomes explainable — the model can only be as right as this result.
        trace.step(`tool ${call.function.name}`, {
          arguments: safeJsonParse(call.function.arguments),
          result: safeJsonParse(result),
        });
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    // Ran out of rounds — better to say so than to leave the user waiting.
    trace.fail(`gave up after ${MAX_TOOL_ROUNDS} tool rounds without a final answer`);
    return NextResponse.json({
      reply: translate(lang, "assistant_too_complex"),
      proposals: ctx.proposals,
      usage: { used: quota.used, limit: DAILY_MESSAGE_LIMIT },
    });
  } catch (e) {
    console.error(`[assistant ${trace.id}] unexpected failure`, e);
    trace.fail("threw", { message: String(e), stack: e instanceof Error ? e.stack : undefined });
    await refundQuota(userId);
    return NextResponse.json(
      {
        error: "model_error",
        ...(process.env.NODE_ENV === "production" ? {} : { detail: String(e).slice(0, 300) }),
      },
      { status: 502 }
    );
  }
}
