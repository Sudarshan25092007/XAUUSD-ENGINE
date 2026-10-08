import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'XAUUSD Microstructure Engine | Live Prop Analytics Terminal',
  description:
    'Real-time analytics dashboard for XAUUSD High-Frequency Ingestion Engine. 1-second candles, μ+1.5σ statistical impulse gating, adverse selection shields, and live decision flight recorder.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-neutral-100">
        {children}
      </body>
    </html>
  );
}
