// Shared DB-row <-> app-type mapping, used by both the browser-side store
// (to shape request payloads sent to /api/data) and the /api/data route
// itself (to shape rows it inserts/returns). `user_id` is intentionally
// never part of these shapes — it's always assigned server-side from the
// validated session, never trusted from the client.
import { Transaction, Category } from "./types";

export interface CategoryRow {
  id: string;
  name: string;
  name_key: string | null;
  monthly_target: number;
  is_buffer: boolean;
  archived: boolean;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  type: Transaction["type"];
  date: string;
  created_at: string;
  postings: Transaction["postings"];
  label_key: string;
  label_params: Transaction["labelParams"] | null;
  note: string | null;
  meta: Transaction["meta"] | null;
}

export function categoryFromRow(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    nameKey: r.name_key ?? undefined,
    monthlyTarget: r.monthly_target,
    isBuffer: r.is_buffer,
    archived: r.archived,
    createdAt: r.created_at,
  };
}

export function categoryToRow(c: Category): CategoryRow {
  return {
    id: c.id,
    name: c.name,
    name_key: c.nameKey ?? null,
    monthly_target: c.monthlyTarget,
    is_buffer: c.isBuffer ?? false,
    archived: c.archived ?? false,
    created_at: c.createdAt,
  };
}

export function transactionFromRow(r: TransactionRow): Transaction {
  return {
    id: r.id,
    type: r.type,
    date: r.date,
    createdAt: r.created_at,
    postings: r.postings,
    labelKey: r.label_key,
    labelParams: r.label_params ?? undefined,
    note: r.note ?? undefined,
    meta: r.meta ?? undefined,
  };
}

export function transactionToRow(tx: Transaction): TransactionRow {
  return {
    id: tx.id,
    type: tx.type,
    date: tx.date,
    created_at: tx.createdAt,
    postings: tx.postings,
    label_key: tx.labelKey,
    label_params: tx.labelParams ?? null,
    note: tx.note ?? null,
    meta: tx.meta ?? null,
  };
}
