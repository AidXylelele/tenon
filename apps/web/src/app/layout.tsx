import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { RootFrame } from '@/spaces/shell/modules/root-frame';
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
  title: { template: '%s | Workflow Platform', default: 'Workflow Platform' },
  description: 'Build, run and watch automations on the Open Workflow standard',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <RootFrame>{children}</RootFrame>
      </body>
    </html>
  );
}
