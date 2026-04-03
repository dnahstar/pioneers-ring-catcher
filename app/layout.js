import "./globals.css";

export const metadata = {
  title: "Pi-Ring 2.0",
  description: "Grit leads to the Mainnet",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* Pi SDK를 미리 로드하여 인증 누락 방지 */}
        <script src="https://sdk.minepi.com/pi-sdk.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
