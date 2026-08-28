import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofFlow | Proof-Carrying Capital Infrastructure",
  description: "Agent-to-agent autonomous economic infrastructure.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased bg-[var(--background)]">
      <body className="min-h-full flex flex-col text-[var(--foreground)] bg-[var(--background)]">
        {children}
      </body>
    </html>
  );
}
