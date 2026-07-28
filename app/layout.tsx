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
  title: "Combat Behavior Workbench",
  description: "전투 행동 구조와 3D 패턴을 함께 검증하는 기획 워크벤치",
  openGraph: {
    title: "Combat Behavior Workbench",
    description: "HFSM · Behavior Tree · 3D Pattern Lab",
    images: [{ url: "/og.png", width: 1680, height: 945, alt: "Combat Behavior Workbench interface" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Combat Behavior Workbench",
    description: "HFSM · Behavior Tree · 3D Pattern Lab",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
