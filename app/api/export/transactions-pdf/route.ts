import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserIdForSession, SESSION_COOKIE } from "@/lib/serverSession";
import { categoryFromRow, transactionFromRow, type CategoryRow, type TransactionRow } from "@/lib/rows";
import { unallocatedCash, creditCardDebt, type CurrencyCode } from "@/lib/ledger";
import { TransactionReportDocument } from "@/lib/pdf/TransactionReportDocument";
import type { Lang } from "@/lib/i18nDict";

// @react-pdf/renderer needs Node's fs/Buffer to read the embedded font and
// build the PDF byte stream — it cannot run on the Edge runtime. Node is
// already this route's default, but that default is easy to lose the next
// time someone adds a blanket runtime config; naming it here means that
// change would have to touch this file to affect it.
export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES: CurrencyCode[] = ["TRY", "USD", "EUR"];

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = await getUserIdForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const from = typeof body.from === "string" ? body.from : "";
  const to = typeof body.to === "string" ? body.to : "";
  const lang: Lang = body.lang === "en" ? "en" : "tr";
  const currency: CurrencyCode = CURRENCIES.includes(body.currency) ? body.currency : "TRY";

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "range_reversed" }, { status: 400 });
  }
  // Same invariant the rest of the app holds for every date field: nothing is
  // ever entered against a day that hasn't happened yet, so a report can't be
  // asked to cover one either.
  if (to > todayStr()) {
    return NextResponse.json({ error: "future_date" }, { status: 400 });
  }

  // The full ledger, scoped to this account by the query itself — the same
  // tenant-isolation shape as /api/data and /api/assistant: identity comes
  // only from the validated session, never from anything the client sends.
  const admin = createAdminClient();
  const [catsRes, txRes] = await Promise.all([
    admin.from("categories").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    admin.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: true }),
  ]);
  const categories = ((catsRes.data ?? []) as CategoryRow[]).map(categoryFromRow);
  const transactions = ((txRes.data ?? []) as TransactionRow[]).map(transactionFromRow);

  // Current balances need the *entire* history — a running balance can't be
  // computed from a slice of it — while the report's period figures need only
  // what falls inside [from, to]. Both are derived from this one query so they
  // describe the same instant, rather than risking a second read racing a
  // concurrent write between them.
  const availableCashNow = unallocatedCash(transactions);
  const debtNow = creditCardDebt(transactions);
  const rangeTransactions = transactions.filter((tx) => tx.date >= from && tx.date <= to);

  try {
    const buffer = await renderToBuffer(
      TransactionReportDocument({
        lang,
        currency,
        from,
        to,
        generatedAt: new Date(),
        categories,
        rangeTransactions,
        availableCashNow,
        debtNow,
      })
    );

    // NextResponse's body type comes from the DOM lib's BodyInit, which
    // doesn't know about Node's Buffer even though Buffer *is* a Uint8Array
    // at runtime — a view over the same bytes, no copy, just satisfying the
    // type checker.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // Ascii-only filename — Content-Disposition's quoted-string form isn't
        // reliable for non-ascii, and there's nothing Turkish-specific worth
        // putting in a filename anyway.
        "Content-Disposition": `attachment; filename="islem-ozeti_${from}_${to}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[export/transactions-pdf] render failed", e);
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
