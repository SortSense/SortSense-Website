import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SortSense — Smart Campus Waste Management',
  description: 'AI-powered waste sorting, IoT fill telemetry, and university environmental operations console.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[var(--canvas)] text-[var(--ink)] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
