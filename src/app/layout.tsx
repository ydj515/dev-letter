import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Dev Letter - AI가 생성하는 개발자 뉴스레터",
    template: `%s | Dev Letter`
  },
  description: "최신 기술 트렌드, 심층 분석, 커리어 팁까지. AI가 생성하는 고급 개발자 콘텐츠를 가장 먼저 만나보세요.",
  openGraph: {
    title: "Dev Letter",
    description: "AI가 생성하는 개발자를 위한 고품질 뉴스레터",
    url: "https://dev-letter.vercel.app/",
    siteName: "Dev Letter",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Dev Letter - AI가 생성하는 개발자 뉴스레터",
    description: "최신 기술 트렌드, 심층 분석, 커리어 팁까지.",
    images: ["/og-image.png"]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="w-full h-32 px-6 bg-gray-900 flex items-center">
          {/* 헤더 콘텐츠 나중에 추가 */}
        </header>
        {children}
      </body>
    </html>
  );
}
