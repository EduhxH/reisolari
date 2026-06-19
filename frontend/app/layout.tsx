import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime";
import { CartProvider } from "@/lib/cart";

export const metadata: Metadata = {
  title: "Reisolari",
  description: "Marketplace P2P e simulador solar para Portugal"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body>
        <AuthProvider>
          <RealtimeProvider>
            <CartProvider>{children}</CartProvider>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
