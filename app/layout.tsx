import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pramana — Know what’s proven, and what isn’t",
  description: "Add your sources and see what’s missing, what conflicts, and what’s outdated.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full">
        <main className="app-shell">{children}</main>
      </body>
    </html>
  );
}
