import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('API 키가 없습니다.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(input);
    // Gemini 응답에서 텍스트 추출
    const text =
      result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
      result.response.text ||
      '결과를 가져올 수 없습니다.';

    return NextResponse.json({ result: text });
  } catch (e) {
    return NextResponse.json(
      { error: '잘못된 요청이거나 Gemini API 호출 실패', detail: String(e) },
      { status: 400 }
    );
  }
} 