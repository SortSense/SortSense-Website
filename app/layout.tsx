import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SortSense - Campus Waste Monitoring",
  description: "Smart Campus Waste Management and Monitoring Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
