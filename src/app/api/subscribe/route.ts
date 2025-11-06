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
      // Optionally, you could update their interests instead of throwing an error
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
    const emailHtml = await render(SubscriptionConfirmation({ email, interests }));

    try {
      await resend.emails.send({
        from: "onboarding@resend.dev", // Resend에서 제공하는 기본 발신 이메일
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
