import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  style: "italic", // Tally often uses italic serif for headings, or regular. Let's include both if possible or just variable.
  // Newsreader is variable, so just subsets is enough.
  // Tally uses 'GT Alpina' which is often used in italic for display.
});

export const metadata: Metadata = {
  title: "Sale Simulator | Tally",
  description: "Simulate a token sale to understand price discovery.",
};

import { ThemeProvider } from "@/components/theme-provider";
import { Background3D } from "@/components/ui/Background3D";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${newsreader.variable} antialiased font-sans text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
        <Background3D />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
