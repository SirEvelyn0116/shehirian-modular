import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payment Integration Prototype",
  description: "Checkout flow with Shopify Shipping and Amazon FBA options",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
