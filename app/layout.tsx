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
  style: "italic",
});

export const metadata: Metadata = {
  title: "LBP Simulator | Balancer",
  description: "Simulate a lBP sale to understand price discovery.",
  icons: {
    icon: [
      { url: "/logo-balancer-black.svg", media: "(prefers-color-scheme: light)" },
      { url: "/logo-balancer-white.svg", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/logo-balancer-black.svg",
    apple: "/logo-balancer-black.svg",
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { Background3D } from "@/components/ui/Background3D";
import { Toaster } from "@/components/ui/toast";
import { PlayPauseButton } from "@/components/ui/PlayPauseButton";

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
          <Toaster />
          <PlayPauseButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
