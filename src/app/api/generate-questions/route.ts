// import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // const { topic } = await req.json();

  // if (!process.env.GEMINI_API_KEY) {
  //   return NextResponse.json(
  //     { error: "API key is not configured" },
  //     { status: 500 }
  //   );
  // }

  // if (!topic) {
  //   return NextResponse.json({ error: "Topic is required" }, { status: 400 });
  // }

  try {
    // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // const prompt = `
    //   You are an expert interviewer for senior Java/Spring developers.
    //   Generate 5 deep and insightful interview questions about the topic: "${topic}".
    //   The questions should be in Korean and designed to assess a candidate's deep understanding and practical experience.
    //   Avoid simple or factual questions. Focus on design, architecture, trade-offs, and problem-solving.
    //   Return the questions as a JSON array of strings. For example:
    //   ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
    // `;

    // const result = await model.generateContent(prompt);
    // const response = await result.response;
    // const text = response.text();

    // const jsonResponse = text.substring(
    //   text.indexOf("["),
    //   text.lastIndexOf("]") + 1
    // );
    // return NextResponse.json(JSON.parse(jsonResponse));
    console.log(req);
    const staticQuestions = [
      "Java의 가비지 컬렉션에 대해 설명하고, 종류별 특징을 비교하시오.",
      "Spring Framework의 핵심 원리인 IoC와 DI에 대해 설명하고, 실제 프로젝트에서 어떻게 활용되는지 예를 들어 설명하시오.",
      "MSA(Microservices Architecture)의 장단점을 설명하고, MSA 전환 시 고려해야 할 사항들을 나열하시오.",
      "JPA(Java Persistence API)의 영속성 컨텍스트에 대해 설명하고, 1차 캐시, 쓰기 지연, 변경 감지, 지연 로딩의 동작 방식을 설명하시오.",
      "데이터베이스 트랜잭션의 ACID 속성에 대해 설명하고, 격리 수준(Isolation Level)에 따른 문제점과 해결 방안을 설명하시오."
    ];

    return NextResponse.json(staticQuestions);
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}
