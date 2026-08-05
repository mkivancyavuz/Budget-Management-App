// The PDF itself: layout, typography, colour — everything the exported report
// looks like. The route (app/api/export/transactions-pdf/route.ts) only
// gathers data; every design decision lives here so the two can be reviewed
// separately.
//
// Renders server-side via @react-pdf/renderer's renderToBuffer(), so this file
// is imported by a route handler, never by a browser bundle. Two things that
// matters follow from that:
//
// 1. Fonts. @react-pdf/renderer's built-in Helvetica is the PDF spec's
//    "Standard 14" font, encoded WinAnsi (cp1252) — which does not contain ş
//    or ğ. Turkish text would silently render with those letters replaced or
//    dropped. DejaVu Sans is embedded instead: confirmed by generating a real
//    PDF and extracting the text back out, byte for byte, including ş, ğ, ı,
//    İ, ö, ü, ç and the ₺/€/$ signs. See lib/pdf/fonts/LICENSE — Bitstream
//    Vera terms, free to embed and redistribute.
// 2. Currency. lib/ledger.ts's formatCurrency() has a module-level "active
//    currency" that lib/currency.tsx (client-only) mutates as the user changes
//    their setting. That global is fine in the browser, where one tab has one
//    user — but this module runs inside a server process handling concurrent
//    requests from *different* accounts with potentially different
//    currencies. Calling setActiveCurrency() here would race: a request for
//    account A in USD could format account B's numbers while a EUR request
//    is mid-flight. So `currency` is always passed explicitly to
//    formatCurrency() below, which makes it a pure function and sidesteps the
//    global entirely — never call setActiveCurrency() from this module.
import React from "react";
import path from "path";
import { Document, Page, View, Text, Font, StyleSheet } from "@react-pdf/renderer";
import type { Category, Transaction } from "@/lib/types";
import type { CurrencyCode } from "@/lib/ledger";
import {
  categoryDisplayName,
  expenseSignedAmount,
  formatCurrency,
  renderTransactionLabel,
  round2,
} from "@/lib/ledger";
import { translate, type Lang } from "@/lib/i18nDict";

const FONTS_DIR = path.join(process.cwd(), "lib/pdf/fonts");

// Registered once, at module load — Font.register is idempotent, but there's
// no reason to re-read the font files from disk on every request. Node caches
// this module after the first import, so this line runs exactly once per
// server process.
Font.register({
  family: "DejaVuSans",
  fonts: [
    { src: path.join(FONTS_DIR, "DejaVuSans.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS_DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const COLOR = {
  ink: "#18181b",
  secondary: "#52525b",
  muted: "#8b8b93",
  border: "#e4e4e7",
  borderStrong: "#d4d4d8",
  tint: "#f4f4f6",
  accent: "#4f46e5",
  accentTint: "#eef0fd",
  success: "#15803d",
  danger: "#b91c1c",
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: "DejaVuSans",
    fontSize: 9.5,
    color: COLOR.ink,
    paddingTop: 42,
    paddingBottom: 46,
    paddingHorizontal: 40,
  },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 9, color: COLOR.accent, fontWeight: "bold", letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: "bold", color: COLOR.ink },
  headerRight: { alignItems: "flex-end" },
  headerMeta: { fontSize: 8.5, color: COLOR.muted, marginBottom: 2 },
  headerRule: { height: 2, backgroundColor: COLOR.accent, marginTop: 12, marginBottom: 18 },

  // Metric cards
  cardRow: { flexDirection: "row", gap: 10 },
  card: { flex: 1, backgroundColor: COLOR.tint, borderRadius: 4, padding: 10 },
  // Uppercasing happens in JS (see `upper()` below), not here — CSS
  // textTransform runs a locale-blind toUpperCase() that turns Turkish "i"
  // into ASCII "I" instead of "İ" (confirmed by rendering "Gider" and reading
  // "GIDER" back out of the PDF instead of "GİDER"). toLocaleUpperCase("tr-TR")
  // gets this right.
  cardLabel: { fontSize: 7.5, color: COLOR.secondary, letterSpacing: 0.4, marginBottom: 5 },
  cardValue: { fontSize: 13, fontWeight: "bold" },

  sectionGap: { marginTop: 18 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", color: COLOR.ink, marginBottom: 3 },
  sectionCaption: { fontSize: 8, color: COLOR.muted, marginBottom: 10 },

  // Category breakdown
  catRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  catName: { width: 130, fontSize: 8.5, color: COLOR.secondary },
  catBarTrack: { flex: 1, height: 7, backgroundColor: COLOR.border, borderRadius: 3, marginHorizontal: 8 },
  catBarFill: { height: 7, backgroundColor: COLOR.accent, borderRadius: 3 },
  catAmount: { width: 78, fontSize: 8.5, fontWeight: "bold", textAlign: "right" },

  emptyNote: { fontSize: 8.5, color: COLOR.muted },

  // Transaction table
  monthBlock: { marginTop: 14 },
  monthHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borderStrong,
    paddingBottom: 4,
    marginBottom: 6,
  },
  monthLabel: { fontSize: 10, fontWeight: "bold", color: COLOR.ink },
  monthCount: { fontSize: 8, color: COLOR.muted },
  txRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
  },
  txDate: { width: 56, fontSize: 8, color: COLOR.muted, paddingTop: 1 },
  txMain: { flex: 1, paddingRight: 8 },
  // See the cardLabel comment above — uppercasing is done in JS with
  // toLocaleUpperCase(), not via textTransform. No color here: it's set
  // inline to match the amount on the same row (green in, red out), same as
  // the category breakdown and metric cards above.
  txType: { fontSize: 7, fontWeight: "bold", marginBottom: 1.5 },
  txLabel: { fontSize: 9, color: COLOR.ink },
  txNote: { fontSize: 8, color: COLOR.muted, marginTop: 1.5 },
  txAmount: { width: 82, fontSize: 9, fontWeight: "bold", textAlign: "right", paddingTop: 1 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: COLOR.border,
    paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: COLOR.muted },
});

export interface ReportInput {
  lang: Lang;
  currency: CurrencyCode;
  /** Report range, yyyy-mm-dd, inclusive on both ends. */
  from: string;
  to: string;
  generatedAt: Date;
  /** Full list, including archived — a historical transaction can still name
   * an archived category, and it needs to keep its display name. */
  categories: Category[];
  /** Already filtered to [from, to] by the caller. Any order. */
  rangeTransactions: Transaction[];
  /** Current balances — snapshots, not period totals, so they're kept
   * visually separate from the range figures below. */
  availableCashNow: number;
  debtNow: number;
}

function isExpenseType(type: Transaction["type"]): boolean {
  return type === "allocate" || type === "spend" || type === "adjustment";
}

function isInflowType(type: Transaction["type"]): boolean {
  return type === "income" || type === "initial_balance";
}

// Locale-aware uppercasing for the small-caps-style labels (card labels,
// transaction type tags). Plain .toUpperCase() is locale-blind and turns
// Turkish "i" into ASCII "I" instead of "İ" — e.g. "Gider" -> "GIDER" instead
// of "GİDER". .toLocaleUpperCase("tr-TR") applies Turkish's dotted/dotless-I
// casing rule correctly; verified by rendering and reading the text back out
// of an actual PDF.
function upper(text: string, lang: Lang): string {
  return text.toLocaleUpperCase(lang === "tr" ? "tr-TR" : "en-US");
}

function localeDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d, 12).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
    day: "2-digit",
    month: "short",
  });
}

function monthLabel(key: string, lang: Lang): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1, 12).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

export function TransactionReportDocument({
  lang,
  currency,
  from,
  to,
  generatedAt,
  categories,
  rangeTransactions,
  availableCashNow,
  debtNow,
}: ReportInput) {
  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
  const money = (amount: number) => formatCurrency(amount, currency);

  // Period totals, computed the same way the rest of the app does: an inflow
  // sums its postings, an expense-ish transaction contributes its signed
  // outflow (so a correction that gave money back nets against the total
  // rather than double-counting).
  let income = 0;
  let expense = 0;
  const categoryTotals = new Map<string, number>();

  for (const tx of rangeTransactions) {
    if (isInflowType(tx.type)) {
      income += tx.postings.reduce((sum, p) => sum + p.amount, 0);
    } else if (isExpenseType(tx.type)) {
      const signed = expenseSignedAmount(tx); // negative = spent
      expense += -signed;
      const categoryId = tx.meta?.categoryId;
      if (categoryId) categoryTotals.set(categoryId, (categoryTotals.get(categoryId) ?? 0) + -signed);
    }
  }
  income = round2(income);
  expense = round2(expense);
  const net = round2(income - expense);

  const categoryRows = [...categoryTotals.entries()]
    .map(([id, amount]) => {
      const cat = categories.find((c) => c.id === id);
      return { name: cat ? categoryDisplayName(cat, t) : id, amount: round2(amount) };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const maxCategoryAmount = categoryRows.reduce((max, row) => Math.max(max, row.amount), 0);

  // Newest month first, matching the in-app Transaction Log.
  const sorted = rangeTransactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const months: { key: string; transactions: Transaction[] }[] = [];
  for (const tx of sorted) {
    const key = tx.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.key === key) last.transactions.push(tx);
    else months.push({ key, transactions: [tx] });
  }

  return (
    <Document
      title={t("pdf_report_title")}
      author={t("app_name")}
      creator={t("app_name")}
      language={lang}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{t("app_name")}</Text>
            <Text style={styles.title}>{t("pdf_report_title")}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>
              {t("pdf_report_range", { from: localeDate(from, lang), to: localeDate(to, lang) })}
            </Text>
            <Text style={styles.headerMeta}>
              {t("pdf_report_generated", {
                date: generatedAt.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US"),
              })}
            </Text>
          </View>
        </View>
        <View style={styles.headerRule} />

        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{upper(t("pdf_income_in_range"), lang)}</Text>
            <Text style={[styles.cardValue, { color: COLOR.success }]}>{money(income)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{upper(t("pdf_expense_in_range"), lang)}</Text>
            <Text style={[styles.cardValue, { color: COLOR.danger }]}>{money(expense)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{upper(t("pdf_net_in_range"), lang)}</Text>
            <Text style={[styles.cardValue, { color: net >= 0 ? COLOR.success : COLOR.danger }]}>{money(net)}</Text>
          </View>
        </View>

        <View style={[styles.sectionGap, { marginTop: 12 }]}>
          <Text style={styles.sectionCaption}>{t("pdf_current_status_caption")}</Text>
          <View style={styles.cardRow}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{upper(t("unallocated_cash"), lang)}</Text>
              <Text style={[styles.cardValue, { color: COLOR.accent }]}>{money(availableCashNow)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{upper(t("account_credit_card"), lang)}</Text>
              <Text style={[styles.cardValue, { color: debtNow > 0 ? COLOR.danger : COLOR.ink }]}>
                {money(debtNow)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionGap}>
          <Text style={styles.sectionTitle}>{t("pdf_category_breakdown")}</Text>
          {categoryRows.length === 0 ? (
            <Text style={styles.emptyNote}>{t("pdf_no_category_spend")}</Text>
          ) : (
            categoryRows.map((row) => (
              <View key={row.name} style={styles.catRow} wrap={false}>
                <Text style={styles.catName}>{row.name}</Text>
                <View style={styles.catBarTrack}>
                  <View
                    style={[
                      styles.catBarFill,
                      { width: `${maxCategoryAmount > 0 ? Math.max(4, (row.amount / maxCategoryAmount) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.catAmount}>{money(row.amount)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionGap}>
          <Text style={styles.sectionTitle}>{t("pdf_transaction_list")}</Text>
          {months.length === 0 && <Text style={styles.emptyNote}>{t("no_transactions_yet")}</Text>}

          {months.map((month) => (
            <View key={month.key} style={styles.monthBlock}>
              <View style={styles.monthHeading} wrap={false}>
                <Text style={styles.monthLabel}>{monthLabel(month.key, lang)}</Text>
                <Text style={styles.monthCount}>{t("transaction_count", { count: month.transactions.length })}</Text>
              </View>

              {month.transactions.map((tx) => {
                const label = renderTransactionLabel(tx, categories, t);
                const amount = isExpenseType(tx.type)
                  ? expenseSignedAmount(tx)
                  : isInflowType(tx.type)
                  ? tx.postings.reduce((sum, p) => sum + p.amount, 0)
                  : tx.postings.reduce((sum, p) => sum + Math.abs(p.amount), 0) / 2; // transfer: show the moved amount

                const amountColor = amount < 0 ? COLOR.danger : COLOR.success;

                return (
                  <View key={tx.id} style={styles.txRow} wrap={false}>
                    <Text style={styles.txDate}>{localeDate(tx.date, lang)}</Text>
                    <View style={styles.txMain}>
                      <Text style={[styles.txType, { color: amountColor }]}>{upper(t(`type_${tx.type}`), lang)}</Text>
                      <Text style={styles.txLabel}>{label}</Text>
                      {tx.note && <Text style={styles.txNote}>{tx.note}</Text>}
                    </View>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {amount >= 0 ? "+" : ""}
                      {money(amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{t("pdf_footer_generated_by", { app: t("app_name") })}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => t("pdf_footer_page", { page: pageNumber, total: totalPages })}
          />
        </View>
      </Page>
    </Document>
  );
}
