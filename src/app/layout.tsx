import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuyMeTokens - Support Developers with AI Credits",
  description: "Donate to developers and let them use the funds for AI API credits through OpenRouter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
