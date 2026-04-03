import "./globals.css";
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* 파이 SDK를 가장 먼저 로드합니다 */}
        <Script 
          src="https://sdk.minepi.com/pi-sdk.js" 
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
