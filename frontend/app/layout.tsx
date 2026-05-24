import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppStateProvider } from "@/context/app-state";
import "./globals.css";

export const metadata: Metadata = {
  title: "APY",
  description: "AI-powered API observability and reliability engineering.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
