import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, key);
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * PostgREST returns 1000 rows unless you page. Rebuild queries must use this, and must `.order()` on a
 * unique key: without it Postgres may return overlapping pages. After the first full page, the next
 * `concurrency` pages are fetched in parallel.
 */
export async function fetchAllRows<T>(
  makeQuery: () => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  },
  page = 1000,
  max = 500000,
  concurrency = 6,
): Promise<T[]> {
  const fetchPage = async (from: number) => {
    const { data, error } = await makeQuery().range(from, from + page - 1);
    if (error) throw new Error(error.message);
    return data || [];
  };
  const out: T[] = [];
  const first = await fetchPage(0);
  out.push(...first);
  let done = first.length < page;
  for (let from = page; !done && from < max; from += page * concurrency) {
    const starts: number[] = [];
    for (let i = 0; i < concurrency && from + i * page < max; i++) starts.push(from + i * page);
    const pages = await Promise.all(starts.map(fetchPage));
    for (const rows of pages) {
      out.push(...rows);
      if (rows.length < page) {
        done = true;
        break;
      }
    }
  }
  if (out.length > 1000) {
    console.warn(`[supabase] query returned ${out.length} rows`);
  }
  return out;
}
