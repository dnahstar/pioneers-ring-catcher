import "./globals.css";

export const metadata = {
  title: "Pi-Ring 2.0",
  description: "Grit leads to the Mainnet",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* Pi SDK를 최상단에서 로드하여 인증 안정성 확보 */}
        <script src="https://sdk.minepi.com/pi-sdk.js" defer></script>
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
