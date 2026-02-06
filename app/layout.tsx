import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const satoshi = localFont({
  src: [
    {
      path: "../public/fonts/Satoshi-Variable.ttf",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-satoshi",
  display: "swap",
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
      {
        url: "/logo-balancer-black.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo-balancer-white.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: "/logo-balancer-black.svg",
    apple: "/logo-balancer-black.svg",
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { Background3D } from "@/components/ui/Background3D";
import { Toaster } from "@/components/ui/toast";
import { PlayPauseButton } from "@/components/ui/PlayPauseButton";
import { SvgDefinitions } from "@/components/ui/SvgDefinitions";
import { Header } from "@/components/layout/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${satoshi.variable} ${newsreader.variable} antialiased font-sans text-foreground`}
      >
        {process.env.NODE_ENV === "development" && (
          <Script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            strategy="afterInteractive"
          />
        )}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="vite-ui-theme"
        >
          <SvgDefinitions />
          <Background3D />
          <div
            id="app-scroll"
            className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden flex flex-col"
          >
            <Header />
            <div className="flex-1 flex flex-col min-h-0">{children}</div>
          </div>
          <Toaster />
          <PlayPauseButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
