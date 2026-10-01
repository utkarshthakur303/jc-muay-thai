import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Called once a day by Vercel Cron (vercel.json) so the Supabase project
 * is never idle for a week.
 *
 * Supabase pauses a free project after seven days without activity, and
 * this site makes that easy to reach: the home page is static and its
 * photographs come out of the data cache, so ordinary visitors never touch
 * the database at all. Only members do. On 2026-10-01 the project was
 * found paused — sign-in and booking down — after a quiet stretch.
 *
 * One read of one row through PostgREST, with the publishable key, so it
 * is real database activity at the least privilege that produces it.
 * `no-store` is load-bearing: a tagged or default-cached fetch here is
 * answered from Next's data cache and would keep nothing alive.
 *
 * The secret check exists so the route cannot be used to hammer the
 * database from outside. Unset secret → refused, cron included; a cron
 * that silently 401s shows up in Vercel's cron logs, a public endpoint
 * does not show up anywhere.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || !sameString(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const host = request.headers.get("host");

  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/site_images?select=id&limit=1`,
      {
        headers: {
          apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("[keepalive] Supabase answered", response.status);
      return Response.json({ ok: false, status: response.status }, { status: 503 });
    }
    // Read to the end rather than `body.cancel()`: Next's fetch hands back
    // a teed stream, and cancelling one branch of a tee waits for the
    // other — the request hung until the platform timed it out.
    await response.text();
  } catch (error) {
    console.error("[keepalive] Supabase unreachable", error);
    return Response.json({ ok: false }, { status: 503 });
  }

  // The host is logged because Vercel does not document which of the
  // project's URLs a cron calls, and a redirect on that URL would turn
  // every run into a silent no-op — crons do not follow redirects.
  console.info("[keepalive] ok via", host);
  return Response.json({ ok: true, host });
}

/** Constant-time, so the comparison does not leak how much of a guess matched. */
function sameString(given: string | null, expected: string): boolean {
  if (given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
