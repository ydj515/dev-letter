import Link from "next/link";
import { techBlogs } from "@/constants";

export default function TechBlogs() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 overflow-hidden">
      <div className="w-full max-w-4xl text-center">
        <div className="flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-500 mb-4">
            Tech Blogs
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            여러가지 테크 기업들의 블로그를 살펴보세요.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
            {techBlogs.map((blog) => (
              <Link href={blog.url} key={blog.name} target="_blank" rel="noopener noreferrer">
                <div className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors duration-300">
                  <h2 className="text-xl font-bold text-cyan-400">{blog.name}</h2>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-24">
            <Link href="/">
              <p className="text-gray-400 mb-4">홈으로 돌아가기 &larr;</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
