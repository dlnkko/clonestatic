import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Ad Prompt Generator",
  description: "Generate high-quality AI image prompts from a reference static ad and your product image.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] antialiased selection:bg-[var(--primary)] selection:text-white">
        {children}
      </body>
    </html>
  );
}
