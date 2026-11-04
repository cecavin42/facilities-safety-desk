import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import "./product-design.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Facilities Safety Desk",
  icons: { icon: "/brand/mark.svg" },
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
        <div className="demo-banner no-print">
          Classroom prototype · Fictional data · Not an official university
          service.
        </div>
        {children}
        <footer className="app-footer no-print">
          Team A draft. University of Tennessee documents are used under their
          nonprofit educational-use terms, with credit to The University of
          Tennessee. Not for commercial use.
        </footer>
      </body>
    </html>
  );
}
