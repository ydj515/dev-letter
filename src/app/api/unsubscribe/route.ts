import { DeliveryStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const deliveryId = request.nextUrl.searchParams.get("delivery");

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
  });

  if (!subscriber) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 404 });
  }

  const alreadyUnsubscribed = Boolean(subscriber.unsubscribedAt);

  if (!alreadyUnsubscribed) {
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { unsubscribedAt: new Date() },
    });
  }

  if (deliveryId) {
    await prisma.issueDelivery.updateMany({
      where: {
        id: deliveryId,
        subscriberId: subscriber.id,
        status: DeliveryStatus.PENDING,
      },
      data: {
        status: DeliveryStatus.FAILED,
        error: "Unsubscribed by recipient",
      },
    });
  }

  const heading = alreadyUnsubscribed ? "이미 구독이 해지되었습니다" : "구독이 해지되었습니다";
  const body = alreadyUnsubscribed
    ? "현재 계정은 더 이상 뉴스레터를 받지 않습니다."
    : "앞으로 Dev Letter 뉴스레터가 발송되지 않습니다.";

  return buildHtmlResponse({ heading, body });
}

function buildHtmlResponse(message: { heading: string; body: string }) {
  const html = `<!doctype html>
  <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <title>${message.heading}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 32px; border-radius: 12px; max-width: 420px; text-align: center; box-shadow: 0 20px 70px rgba(15, 23, 42, 0.45); }
        h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
        p { font-size: 1rem; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${message.heading}</h1>
        <p>${message.body}</p>
      </div>
    </body>
  </html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
