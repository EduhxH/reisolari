import React from "react";
import { CartProvider } from "@/lib/cart";

export default function MarketplaceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <CartProvider>{children}</CartProvider>;
}
