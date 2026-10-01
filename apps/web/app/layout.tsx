import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PayGo Integration Lab | BeSelly',
  description: 'Isolated test environment for PayGo Checkout Angola API integration',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
