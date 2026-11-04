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
  title: "Facilities Safety Desk (class project)",
  description:
    "Report incidents and near misses, see safety trends, and ask questions answered only from five safety documents. A student project, not an official university site.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="no-print bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Class project (MSAI 5563, Lipscomb University). Not an official
          University of Tennessee site. All records are fake.
        </div>
        {children}
        <footer className="no-print border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
          Team A draft. University of Tennessee documents are used under their
          nonprofit educational-use terms, with credit to The University of
          Tennessee. Not for commercial use.
        </footer>
      </body>
    </html>
  );
}
