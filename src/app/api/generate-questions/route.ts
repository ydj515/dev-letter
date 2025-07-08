import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { topic } = await req.json();

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "API key is not configured" },
      { status: 500 }
    );
  }

  if (!topic) {
    return NextResponse.json(
      { error: "Topic is required" },
      { status: 400 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert interviewer for senior Java/Spring developers.
      Generate 5 deep and insightful interview questions about the topic: "${topic}".
      The questions should be in Korean and designed to assess a candidate's deep understanding and practical experience.
      Avoid simple or factual questions. Focus on design, architecture, trade-offs, and problem-solving.
      Return the questions as a JSON array of strings. For example:
      ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean the response to get only the JSON array
    const jsonResponse = text.substring(text.indexOf("["), text.lastIndexOf("]") + 1);

    return NextResponse.json(JSON.parse(jsonResponse));
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
