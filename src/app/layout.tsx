import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "급식평론가",
  description: "NEIS 급식 조회와 Gemini AI 급식 평가를 제공하는 학생용 웹앱",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "급식평론가",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0ea5e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
