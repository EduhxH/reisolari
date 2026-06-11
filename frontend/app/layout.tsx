import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solar P2P Marketplace",
  description: "Marketplace P2P & Simulador Solar – Portugal"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
