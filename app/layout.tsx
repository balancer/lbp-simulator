import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import localFont from "next/font/local";
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
  title: "LBP Simulator | Beets",
  description: "Simulate a Beets LBP sale to understand price discovery.",
  icons: {
    icon: [
      {
        url: "/logo-beets-white.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo-beets-white.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: "/logo-beets-white.svg",
    apple: "/logo-beets-white.svg",
  },
};
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
          <html lang="en" className="dark" suppressHydrationWarning>
            <body
              className={`${satoshi.variable} ${newsreader.variable} antialiased font-sans text-foreground`}
            >
<SvgDefinitions />
            <div
              id="app-scroll"
              className="fixed inset-0 z-10 overflow-y-auto overflow-x-hidden flex flex-col"
            >
              <Header />
              <div className="flex-1 flex flex-col min-h-0">{children}</div>
            </div>
            <Toaster />
            <PlayPauseButton />
            </body>
          </html>
        );
}
