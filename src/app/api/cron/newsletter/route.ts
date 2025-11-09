import { NextResponse, type NextRequest } from "next/server";
import { runNewsletterCron } from "@/services/newsletter-cron";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runNewsletterCron();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[Cron] Failed to run newsletter cron:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function isAuthorized(request: NextRequest, secret: string) {
  const header = request.headers.get("authorization");
  if (!header) return false;
  return header === `Bearer ${secret}`;
}
