import type { Metadata } from "next";
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
            <h1 className="text-2xl font-bold text-gray-900">
              Mural Generator
            </h1>
            <p className="text-sm text-gray-600">
              Create AI-generated murals inspired by reference designs
            </p>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
