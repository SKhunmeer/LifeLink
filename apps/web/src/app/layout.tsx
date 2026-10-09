import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BloodLink AI — Real-Time Smart Blood Bank & Emergency Donor Network',
  description: 'Instant blood compatibility matching, atomic inventory management, and consent-based emergency donor outreach.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-rose-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
