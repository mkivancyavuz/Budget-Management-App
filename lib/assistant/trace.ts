// Step-by-step tracing of one assistant request, written to the server
// terminal.
//
// Why this exists: the assistant is a loop between three parties — the browser,
// this server's ledger queries, and the model — and when it misbehaves the
// interesting question is almost always "what exactly was sent, and what came
// back". Logging only the failure hides the shape of the conversation that led
// there, so every step of the flow is traced: the incoming message, the session
// and quota decision, the ledger that was loaded, each request to the model,
// each response, every tool call and its result, and the reply that goes back.
//
// Two safeguards, because this deliberately prints request bodies:
//
//  1. It is OFF in production. The trace contains the user's financial summary
//     and their message text, which does not belong in a production log.
//  2. Everything printed goes through redact(), which strips anything shaped
//     like an API key or bearer token. Tracing is only worth having if it can't
//     leak the credential it's tracing.

/** On in development, off in production. `ASSISTANT_DEBUG` overrides either way
 * ("1" forces on, "0" forces off) so a deployed instance can be traced
 * deliberately and a local one can be quietened. */
export const TRACE_ENABLED =
  process.env.ASSISTANT_DEBUG === "1" ||
  (process.env.ASSISTANT_DEBUG !== "0" && process.env.NODE_ENV !== "production");

/** Longest single value printed. Generous, because a truncated request body is
 * what made the earlier rounds of this debugging so slow — but not unbounded,
 * because a 12k-token prompt makes the terminal unreadable. */
const MAX_VALUE = 6000;

const KEY_PATTERNS: RegExp[] = [
  // OpenAI-style keys, including project-scoped (sk-proj-...) and other vendors'
  // long opaque tokens.
  /\b(sk|rk|pk)-[A-Za-z0-9_-]{12,}/g,
  /\bgsk_[A-Za-z0-9_-]{12,}/g, // Groq
  /\bcsk-[A-Za-z0-9_-]{12,}/g, // Cerebras
  /\bBearer\s+[A-Za-z0-9._-]{12,}/gi,
  // JWTs (the Supabase service-role key is one).
  /\beyJ[A-Za-z0-9._-]{20,}/g,
];

/** Removes credentials from anything about to be printed. */
export function redact(input: string): string {
  let out = input;
  for (const pattern of KEY_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const head = match.startsWith("Bearer") ? "Bearer " : match.slice(0, 6);
      return `${head}[REDACTED:${match.length}]`;
    });
  }
  return out;
}

function render(payload: unknown): string {
  if (payload === undefined) return "";
  const text =
    typeof payload === "string"
      ? payload
      : (() => {
          try {
            return JSON.stringify(payload, null, 2);
          } catch {
            return String(payload);
          }
        })();
  const safe = redact(text);
  return safe.length > MAX_VALUE ? `${safe.slice(0, MAX_VALUE)}\n… [${safe.length - MAX_VALUE} more chars]` : safe;
}

export interface Trace {
  /** Short id tying every line of one request together in an interleaved log. */
  readonly id: string;
  /** Milliseconds since the request started. */
  elapsedMs(): number;
  step(label: string, payload?: unknown): void;
  fail(label: string, payload?: unknown): void;
}

/** No-op when tracing is off, so call sites stay free of `if (DEBUG)`. */
export function createTrace(prefix = "assistant"): Trace {
  const id = Math.random().toString(36).slice(2, 8);
  const started = Date.now();

  if (!TRACE_ENABLED) {
    return { id, elapsedMs: () => Date.now() - started, step: () => {}, fail: () => {} };
  }

  const write = (stream: "log" | "error", label: string, payload?: unknown) => {
    const head = `[${prefix} ${id} +${String(Date.now() - started).padStart(5)}ms] ${label}`;
    const body = render(payload);
    console[stream](body ? `${head}\n${indent(body)}` : head);
  };

  return {
    id,
    elapsedMs: () => Date.now() - started,
    step: (label, payload) => write("log", label, payload),
    fail: (label, payload) => write("error", label, payload),
  };
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
