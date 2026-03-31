import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

const appName = "PIONEERS!!"
const appDescription = "Ring Catcher Game - Catch falling rings with your pole to score points!"
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pioneers-ring-catcher.vercel.app"

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  keywords: ["game", "ring catcher", "pi network", "casual game", "web game"],
  authors: [
    {
      name: "PIONEERS!! Team",
    },
  ],
  creator: "PIONEERS!! Team",
  robots: "index, follow",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: appUrl,
    title: appName,
    description: appDescription,
    siteName: appName,
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: appDescription,
    creator: "@pioneersapp",
  },
  manifest: "/manifest.json",
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
