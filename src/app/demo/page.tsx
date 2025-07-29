"use client";

import { useState } from "react";

export default function HomePage() {
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuestions = async () => {
    setIsLoading(true);
    setError(null);
    setQuestions([]);

    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ topic })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setQuestions(data);
    } catch (e: unknown) {
      setError("질문 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");

      if (e instanceof Error) {
        console.error(e.message);
      } else {
        console.error("Unknown error", e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-3xl">
        <header className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-500 mb-4">
            AI 면접 질문 생성기
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            궁금한 주제를 입력하고 질문을 생성해보세요.
          </p>
        </header>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: Spring Security, JPA, MSA..."
              className="flex-grow bg-gray-700 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={generateQuestions}
              disabled={isLoading}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-md transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? "생성 중..." : "질문 생성"}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded-lg relative mb-6"
            role="alert"
          >
            <strong className="font-bold">에러:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {questions.length > 0 && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-400">
              생성된 질문
            </h2>
            <ul className="space-y-4">
              {questions.map((q, index) => (
                <li
                  key={index}
                  className="bg-gray-700 p-4 rounded-md flex items-start"
                >
                  <span className="text-cyan-400 font-bold mr-3">
                    Q{index + 1}.
                  </span>
                  <p className="flex-1">{q}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
