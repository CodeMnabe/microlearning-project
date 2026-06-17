import { getSupabaseAdminClient } from "@/lib/db/admin";
import Head from "next/head";

export async function countRows(table,applyFilters) {
    const supabaseAdmin = getSupabaseAdminClient();

    let query = supabaseAdmin

    .from(table)
    .select("*", { count: "exact", head: true});

    if (typeof applyFilters === "function") {
        query = applyFilters(query);
    }

    const { count, error } = await query;

    if (error) {
        throw new Error ("${table}: ${error.message}");
    }
    return count ?? 0;
}



export async function fetchRows(table, columns, applyFilters) {
  const supabaseAdmin = getSupabaseAdminClient();

  let query = supabaseAdmin.from(table).select(columns);

  if (typeof applyFilters === "function") {
    query = applyFilters(query);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}