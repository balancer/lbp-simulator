import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import Script from "next/script";
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
          <Background3D/>
          {/* Content as fixed overlay so sidebar/layout changes don't affect or lag the background */}
          <div className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
          <Toaster />
          <PlayPauseButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
