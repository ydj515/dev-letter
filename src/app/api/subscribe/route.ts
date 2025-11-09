import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import SubscriptionConfirmation from "@/emails/SubscriptionConfirmation";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { email, interests } = await req.json();

    if (!email || !interests || interests.length === 0) {
      return NextResponse.json(
        { error: "Email and at least one interest are required" },
        { status: 400 },
      );
    }

    // Check if the user is already subscribed
    const existingSubscriber = await prisma.subscriber.findUnique({
      where: { email },
    });

    if (existingSubscriber) {
      if (existingSubscriber.unsubscribedAt) {
        const reactivated = await prisma.subscriber.update({
          where: { email },
          data: {
            interests,
            unsubscribedAt: null,
          },
        });
        return NextResponse.json(reactivated, { status: 200 });
      }

      return NextResponse.json(
        { error: "This email is already subscribed." },
        { status: 409 }, // 409 Conflict
      );
    }

    // Create a new subscriber record
    const newSubscriber = await prisma.subscriber.create({
      data: {
        email,
        interests,
      },
    });

    // Send confirmation email
    const resend = new Resend(process.env.RESEND_API_KEY);
    const baseUrl = process.env.APP_BASE_URL ?? "https://dev-letter.dev";
    const emailHtml = await render(
      SubscriptionConfirmation({
        email,
        interests,
        manageUrl: buildAbsoluteUrl(baseUrl, "/newsletter/manage"),
        contactUrl: buildAbsoluteUrl(baseUrl, "/contact"),
      }),
    );

    const senderEmail = process.env.RESEND_FROM_EMAIL;

    if (!senderEmail) {
      console.warn("RESEND_FROM_EMAIL is not set. Confirmation email will not be sent.");
    }

    try {
      if (!senderEmail) {
        throw new Error("Missing RESEND_FROM_EMAIL");
      }

      await resend.emails.send({
        from: senderEmail,
        to: email,
        subject: "AI-Powered Developer Insights 뉴스레터 구독 확인",
        html: emailHtml,
      });
      console.log(`Confirmation email sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // 이메일 발송 실패가 구독 실패로 이어지지 않도록 에러를 던지지 않음
    }

    return NextResponse.json(newSubscriber, { status: 201 }); // 201 Created
  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe. Please try again later." },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

function buildAbsoluteUrl(base: string, pathname: string) {
  try {
    const url = new URL(pathname, base);
    return url.toString();
  } catch {
    return base;
  }
}
