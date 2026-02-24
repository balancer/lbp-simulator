import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COUNTER_KEY = "report_pdf_download";

export async function POST() {
  try {
    const sql = getSql();
    await sql`
      insert into analytics_counters (key, count)
      values (${COUNTER_KEY}, 1)
      on conflict (key)
      do update
      set count = analytics_counters.count + 1,
          updated_at = now()
    `;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
