"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Transition } from "@headlessui/react";
import TechCarousel from "@/components/TechCarousel";
import { INTEREST_CATEGORIES } from "@/constants";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const closeModal = () => {
    setShowForm(false);
    setSelectedCategories([]);
    setEmail("");
    setError(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        closeModal();
      }
    };

    if (showForm) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showForm]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("관심 분야를 하나 이상 선택해주세요.");
      return;
    }

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, interests: selectedCategories })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "구독에 실패했습니다.");
      }

      setShowForm(false);
      setTimeout(() => setSubscribed(true), 500);
    } catch (e: unknown) {
      setError("질문 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");

      if (e instanceof Error) {
        console.error(e.message);
      } else {
        console.error("Unknown error", e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-4xl text-center">
        <div className="relative" style={{ minHeight: "300px" }}>
          <Transition
            as="div"
            show={!showForm && !subscribed}
            className="absolute w-full"
            leave="transition-all duration-500 ease-in-out"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-10"
          >
            <div className="flex flex-col items-center">
              <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-500 mb-4">
                Dev Letter
              </h1>
              <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                최신 기술 트렌드, 심층 분석, 그리고 커리어 팁까지. AI가 생성하는
                고급 개발자 콘텐츠를 가장 먼저 만나보세요.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-purple-500 to-cyan-600 hover:from-purple-600 hover:to-cyan-700 text-white font-bold py-4 px-10 rounded-md transition-all duration-300 shadow-lg text-lg"
              >
                뉴스레터 구독하기
              </button>
            </div>
          </Transition>

          <Transition
            as="div"
            show={showForm}
            className="absolute w-full"
            enter="transition-all duration-500 ease-in-out"
            enterFrom="opacity-0 translate-y-10"
            enterTo="opacity-100 translate-y-0"
            leave="transition-all duration-300 ease-in-out"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-10"
          >
            <form
              key="subscription-form"
              ref={formRef}
              onSubmit={handleSubscription}
              className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700"
            >
              <h3 className="text-2xl font-bold text-cyan-400 mb-6">
                관심 분야를 선택해주세요
              </h3>
              <div className="mb-6">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  className="w-full bg-gray-700 text-white rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {INTEREST_CATEGORIES.map((category) => (
                  <button
                    type="button"
                    key={category}
                    onClick={() => handleCategoryToggle(category)}
                    className={`p-3 rounded-md text-center font-semibold transition-all duration-200 border-2 ${selectedCategories.includes(category) ? "bg-cyan-500 border-cyan-500 text-white" : "bg-gray-700 border-gray-600 hover:border-cyan-500"}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-cyan-600 hover:from-purple-600 hover:to-cyan-700 text-white font-bold py-3 px-8 rounded-md transition-all duration-300 shadow-lg"
              >
                구독 완료
              </button>
              {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
            </form>
          </Transition>

          <Transition
            as="div"
            show={subscribed}
            className="absolute w-full"
            enter="transition-all duration-500 ease-out"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
          >
            <div className="bg-green-800 border border-green-600 text-white px-6 py-4 rounded-lg max-w-lg mx-auto">
              <p className="font-bold text-lg">구독해주셔서 감사합니다!</p>
              <p>관심 분야에 맞는 유용한 정보로 곧 찾아뵙겠습니다.</p>
            </div>
          </Transition>
        </div>

        

        <div className={`mt-24 w-full transition-opacity duration-300 ${showForm ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <TechCarousel />
        </div>

        <div className="mt-24">
          <p className="text-gray-400 mb-4">
            AI 면접 질문 생성기도 사용해보세요.
          </p>
          <Link href="/demo">
            <span className="bg-gray-700 hover:bg-gray-600 text-cyan-400 font-bold py-3 px-8 rounded-md transition-colors duration-300 cursor-pointer">
              데모 페이지로 이동 &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
