import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppStateProvider } from "@/context/app-state";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseRoot AI",
  description: "A simple AI incident playground using Groq.",
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
