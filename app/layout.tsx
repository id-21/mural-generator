import type { Metadata } from "next";
import Link from 'next/link';
import "./globals.css";

export const metadata: Metadata = {
  title: "Mural Generator",
  description: "AI-powered mural generator using Gemini Pro 3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Mural Generator
                </h1>
                <p className="text-sm text-gray-600">
                  Create AI-generated murals inspired by reference designs
                </p>
              </div>
              <nav className="flex gap-4">
                <Link href="/browse" className="text-gray-700 hover:text-blue-600 transition">
                  Browse
                </Link>
                <Link href="/reference-gallery" className="text-gray-700 hover:text-blue-600 transition">
                  References
                </Link>
                <Link href="/generate" className="text-gray-700 hover:text-blue-600 transition">
                  Generate
                </Link>
                <Link href="/gallery" className="text-gray-700 hover:text-blue-600 transition">
                  Gallery
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
