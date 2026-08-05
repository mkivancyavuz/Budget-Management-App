"use client";

// The assistant's chat bubble, bottom-right on every signed-in page.
//
// Two things about the design are deliberate:
//
// 1. The conversation lives in React state only. It isn't persisted anywhere,
//    so closing the panel or reloading starts fresh — there's no transcript of
//    someone's finances sitting in localStorage on a shared machine.
// 2. The assistant never writes. When it wants to add a transaction the server
//    returns a *proposal*, rendered here as a confirmation card. Pressing
//    confirm runs the app's own allocate()/logIncome() action, so an
//    assistant-created entry goes through exactly the same validation, ledger
//    postings and history as one typed into the form by hand.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useTour } from "@/lib/tour/TourProvider";
import { formatCurrency } from "@/lib/ledger";
import { isStandaloneRoute } from "@/lib/routes";
import { Button } from "../ui";

interface Proposal {
  kind: "expense" | "income";
  amount: number;
  category?: string;
  categoryId?: string;
  source?: string;
  date: string;
  note?: string;
}

type ProposalState = "pending" | "saving" | "saved" | "rejected" | "failed";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  proposals?: Proposal[];
  /** Per-proposal state, parallel to `proposals`. */
  states?: ProposalState[];
  error?: string;
}

const MAX_INPUT = 500;

/** True while any <Modal> is mounted — it tags itself with data-modal.
 *
 * Modals sit at z-50 and the bubble is rendered after the page in the DOM, so
 * without this the bubble and its panel would float on top of an open dialog.
 * The tour overlay steps aside the same way. */
function useModalOpen(): boolean {
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    const check = () => setModalOpen(!!document.querySelector("[data-modal]"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return modalOpen;
}

export function AssistantBubble() {
  const pathname = usePathname();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { allocate, logIncome } = useStore();
  const { currency } = useCurrency();
  // `start` from the tour context is the restarting kind: it clears the
  // "already seen" marker first, so the tour genuinely replays instead of being
  // suppressed again after one step.
  const { start: startTour, active: tourActive } = useTour();
  const modalOpen = useModalOpen();

  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Follow the conversation as it grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  // The tour takes over the screen, so the panel yields to it. Derived rather
  // than pushed into state on a tour-start effect: that would be a second source
  // of truth for one piece of information, and it would forget that the panel
  // had been open. This way the conversation is still there when the tour ends.
  const panelOpen = open && !tourActive;

  useEffect(() => {
    if (panelOpen) inputRef.current?.focus();
  }, [panelOpen]);

  // Escape closes the panel, matching every other overlay in the app. Bound to
  // panelOpen so it doesn't steal Escape from the tour overlay.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;

      const nextTurns: ChatTurn[] = [...turns, { role: "user", content: message }];
      setTurns(nextTurns);
      setDraft("");
      setBusy(true);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Only the plain text goes back — proposals and their states are
            // local UI concerns the model has no use for.
            messages: nextTurns.map((turn) => ({ role: turn.role, content: turn.content })),
            lang,
            currency,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const error =
            res.status === 429
              ? t("assistant_quota_error", { limit: data?.limit ?? 30 })
              : res.status === 503
              ? t("assistant_unconfigured")
              : t("assistant_error");
          // The server sends `detail` in development only. Showing it turns a
          // useless "couldn't connect" into the actual cause while building.
          const detail = typeof data?.detail === "string" ? data.detail : undefined;
          setTurns((prev) => [
            ...prev,
            { role: "assistant", content: "", error: detail ? `${error}\n\n${detail}` : error },
          ]);
          return;
        }

        const proposals = (Array.isArray(data.proposals) ? data.proposals : []) as Proposal[];
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content: typeof data.reply === "string" ? data.reply : "",
            proposals: proposals.length ? proposals : undefined,
            states: proposals.length ? proposals.map(() => "pending" as ProposalState) : undefined,
          },
        ]);
      } catch {
        setTurns((prev) => [...prev, { role: "assistant", content: "", error: t("assistant_error") }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, turns, lang, currency, t]
  );

  const setProposalState = useCallback(
    (turnIndex: number, proposalIndex: number, state: ProposalState, error?: string) => {
      setTurns((prev) =>
        prev.map((turn, i) => {
          if (i !== turnIndex || !turn.states) return turn;
          const states = [...turn.states];
          states[proposalIndex] = state;
          return { ...turn, states, error: error ?? turn.error };
        })
      );
    },
    []
  );

  const confirmProposal = useCallback(
    async (turnIndex: number, proposalIndex: number, proposal: Proposal) => {
      setProposalState(turnIndex, proposalIndex, "saving");
      const result =
        proposal.kind === "expense" && proposal.categoryId
          ? await allocate({ categoryId: proposal.categoryId, amount: proposal.amount, date: proposal.date })
          : proposal.kind === "income"
          ? await logIncome({
              amount: proposal.amount,
              source: proposal.source ?? "",
              date: proposal.date,
              note: proposal.note,
            })
          : ({ ok: false, error: t("assistant_save_failed") } as const);

      if (result.ok) {
        setProposalState(turnIndex, proposalIndex, "saved");
      } else {
        setProposalState(turnIndex, proposalIndex, "failed", result.error || t("assistant_save_failed"));
      }
    },
    [allocate, logIncome, setProposalState, t]
  );

  // Signed-out pages have no account to answer questions about. An open dialog
  // owns the screen; the conversation is kept in state, so it's still there
  // when the dialog closes.
  if (!user || isStandaloneRoute(pathname) || modalOpen) return null;

  const suggestions = [t("assistant_suggestion_1"), t("assistant_suggestion_2"), t("assistant_suggestion_3")];

  return (
    <>
      {/* One fixed stack rather than two separately-positioned buttons: the "i"
          sits above the assistant because it comes first in the flex column, so
          the two can't drift apart if either size changes.

          Hidden while the tour runs — the tour dims the page and spotlights one
          element at a time, and a floating pair of buttons under the dim is both
          a distraction and unreachable. */}
      {/* Sizes step up with the viewport, following the same xl:/2xl: ladder the
          sign-in page uses. On a phone the buttons sit over the content and a
          56px circle is a thumb-sized hole in a small screen; on a 2560px display
          the same circle reads as a stray dot. The "i" stays proportionally
          smaller than the assistant at every step — it is the secondary action. */}
      {!panelOpen && !tourActive && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col items-center gap-2 sm:gap-2.5 2xl:bottom-7 2xl:right-7 2xl:gap-3.5">
          <button
            type="button"
            onClick={startTour}
            aria-label={t("tour_restart_button")}
            title={t("tour_restart_button")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-app-border bg-app-surface text-[15px] font-bold leading-none text-app-text-secondary shadow-lg transition-all duration-200 hover:scale-105 hover:border-app-accent hover:text-app-accent active:scale-95 sm:h-10 sm:w-10 sm:text-[17px] xl:h-11 xl:w-11 xl:text-lg 2xl:h-14 2xl:w-14 2xl:text-2xl"
          >
            <span aria-hidden="true">i</span>
          </button>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("assistant_open")}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-app-accent text-white shadow-[0_8px_24px_rgba(99,102,241,0.45)] transition-transform duration-200 hover:scale-105 active:scale-95 sm:h-14 sm:w-14 xl:h-16 xl:w-16 2xl:h-20 2xl:w-20"
          >
            <SparkIcon className="size-5 sm:size-[22px] xl:size-6 2xl:size-8" />
          </button>
        </div>
      )}

      {panelOpen && (
        <div
          role="dialog"
          aria-label={t("assistant_title")}
          className="fixed inset-x-3 bottom-3 z-40 flex max-h-[min(78vh,640px)] flex-col overflow-hidden rounded-3xl border border-app-border bg-app-surface shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[400px]"
        >
          <header className="flex items-center gap-3 border-b border-app-border px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-accent-soft text-app-accent">
              <SparkIcon className="size-[15px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-app-text">{t("assistant_title")}</p>
              <p className="truncate text-[11px] text-app-text-muted">{t("assistant_subtitle")}</p>
            </div>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={() => setTurns([])}
                className="text-[11px] font-medium text-app-text-muted transition-colors hover:text-app-text"
              >
                {t("assistant_clear")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("assistant_close")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-glass-subtle hover:text-app-text"
            >
              <CloseIcon />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <>
                <p className="rounded-2xl rounded-tl-md bg-glass-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-app-text-secondary">
                  {t("assistant_greeting")}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-app-border px-3 py-1.5 text-[12px] font-medium text-app-text-secondary transition-colors hover:border-app-accent hover:text-app-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {turns.map((turn, turnIndex) => (
              <div key={turnIndex} className={turn.role === "user" ? "flex justify-end" : ""}>
                {turn.role === "user" ? (
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-app-accent px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                    {turn.content}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {turn.content && (
                      <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-glass-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-app-text">
                        {turn.content}
                      </p>
                    )}
                    {turn.error && (
                      <p className="whitespace-pre-wrap break-words rounded-xl border border-app-danger/25 bg-app-danger-soft px-3 py-2 text-[12.5px] text-app-danger">
                        {turn.error}
                      </p>
                    )}
                    {turn.proposals?.map((proposal, proposalIndex) => {
                      const state = turn.states?.[proposalIndex] ?? "pending";
                      return (
                        <div
                          key={proposalIndex}
                          className="rounded-2xl border border-app-accent/30 bg-app-accent-soft/40 p-3"
                        >
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-app-accent">
                            {proposal.kind === "expense"
                              ? t("assistant_proposal_expense")
                              : t("assistant_proposal_income")}
                          </p>
                          <dl className="space-y-1 text-[12.5px]">
                            <Row label={t("amount")} value={formatCurrency(proposal.amount)} />
                            {proposal.kind === "expense" && proposal.category && (
                              <Row label={t("category")} value={proposal.category} />
                            )}
                            {proposal.kind === "income" && proposal.source && (
                              <Row label={t("client_or_source")} value={proposal.source} />
                            )}
                            <Row label={t("date")} value={proposal.date} />
                            {proposal.note && <Row label={t("note_optional")} value={proposal.note} />}
                          </dl>

                          {state === "pending" || state === "saving" ? (
                            <>
                              <p className="mt-2 text-[11px] text-app-text-muted">{t("assistant_proposal_hint")}</p>
                              <div className="mt-2.5 flex gap-2">
                                <Button
                                  onClick={() => confirmProposal(turnIndex, proposalIndex, proposal)}
                                  disabled={state === "saving"}
                                  className="flex-1"
                                >
                                  {t("assistant_confirm")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => setProposalState(turnIndex, proposalIndex, "rejected")}
                                  disabled={state === "saving"}
                                >
                                  {t("assistant_reject")}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <p
                              className={`mt-2 text-[12px] font-semibold ${
                                state === "saved"
                                  ? "text-app-success"
                                  : state === "failed"
                                  ? "text-app-danger"
                                  : "text-app-text-muted"
                              }`}
                            >
                              {state === "saved"
                                ? t("assistant_saved")
                                : state === "failed"
                                ? t("assistant_save_failed")
                                : t("assistant_rejected")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <p className="text-[12.5px] text-app-text-muted" aria-live="polite">
                {t("assistant_thinking")}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-end gap-2 border-t border-app-border px-3 py-3"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_INPUT))}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              placeholder={t("assistant_placeholder")}
              className="max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-app-border bg-app-bg px-3 py-2.5 text-[13px] text-app-text outline-none transition-colors placeholder:text-app-text-muted focus:border-app-accent"
            />
            <Button type="submit" disabled={busy || !draft.trim()}>
              {t("assistant_send")}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-app-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-app-text">{value}</dd>
    </div>
  );
}

/** Sized by CSS class rather than width/height attributes, so the caller can
 * scale it per breakpoint. With width/height as numbers the only way to change
 * size responsively is to render the icon twice and hide one — which the sign-in
 * page has to do for its lucide icons. The viewBox makes the SVG scale to
 * whatever box CSS gives it. */
function SparkIcon({ className = "size-[22px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 4.9L18.8 9.8l-4.9 1.9L12 16.6l-1.9-4.9L5.2 9.8l4.9-1.9L12 3z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
