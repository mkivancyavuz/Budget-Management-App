import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserIdForSession, SESSION_COOKIE } from "@/lib/serverSession";
import { categoryToRow, transactionToRow, type CategoryRow, type TransactionRow } from "@/lib/rows";
import type { Category, Transaction } from "@/lib/types";

// Single proxy endpoint for every read/write the app's store (lib/store.tsx)
// needs. The browser holds no Supabase credentials at all — every operation
// here is scoped to `userId`, which comes only from a validated row in the
// `sessions` table (never from anything the client sends), using the
// service-role admin client. RLS on these tables stays enabled as a backstop,
// but the actual tenant-scoping enforcement for this path is this route
// always filtering/writing by `userId`.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = await getUserIdForSession(sid);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  switch (body.op) {
    case "load": {
      const [catsRes, txRes, bufRes] = await Promise.all([
        admin.from("categories").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        admin.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: true }),
        admin.from("buffer_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      return NextResponse.json({
        categories: (catsRes.data ?? []) as CategoryRow[],
        transactions: (txRes.data ?? []) as TransactionRow[],
        bufferSettings: bufRes.data,
      });
    }

    case "insertTransaction": {
      const tx = body.payload?.transaction as Transaction;
      const row = { ...transactionToRow(tx), user_id: userId };
      const { error } = await admin.from("transactions").insert(row);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    case "insertCategory": {
      const category = body.payload?.category as Category;
      const row = { ...categoryToRow(category), user_id: userId };
      const { error } = await admin.from("categories").insert(row);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    case "updateCategory": {
      const { id, patch } = (body.payload ?? {}) as { id: string; patch: Record<string, unknown> };
      const dbPatch: Record<string, unknown> = {};
      if ("name" in patch) dbPatch.name = patch.name;
      if ("monthlyTarget" in patch) dbPatch.monthly_target = patch.monthlyTarget;
      if ("nameKey" in patch) dbPatch.name_key = patch.nameKey ?? null;
      const { error } = await admin.from("categories").update(dbPatch).eq("id", id).eq("user_id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    case "archiveCategory": {
      const { id } = (body.payload ?? {}) as { id: string };
      const { error } = await admin
        .from("categories")
        .update({ archived: true })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    case "upsertBufferSettings": {
      const merged = (body.payload ?? {}) as {
        targetMonths: number;
        criticalThresholdPct: number;
        lowThresholdPct: number;
      };
      const { error } = await admin.from("buffer_settings").upsert({
        user_id: userId,
        target_months: merged.targetMonths,
        critical_threshold_pct: merged.criticalThresholdPct,
        low_threshold_pct: merged.lowThresholdPct,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    case "loadDemoData": {
      const { categories, transactions } = (body.payload ?? {}) as {
        categories: Category[];
        transactions: Transaction[];
      };
      await admin.from("transactions").delete().eq("user_id", userId);
      await admin.from("categories").delete().eq("user_id", userId);
      const { error: catErr } = await admin
        .from("categories")
        .insert(categories.map((c) => ({ ...categoryToRow(c), user_id: userId })));
      const { error: txErr } = await admin
        .from("transactions")
        .insert(transactions.map((tx) => ({ ...transactionToRow(tx), user_id: userId })));
      if (catErr || txErr) {
        return NextResponse.json({ error: (catErr ?? txErr)?.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    case "clearAll": {
      await admin.from("transactions").delete().eq("user_id", userId);
      await admin.from("categories").delete().eq("user_id", userId);
      await admin.from("buffer_settings").delete().eq("user_id", userId);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "unknown op" }, { status: 400 });
  }
}
