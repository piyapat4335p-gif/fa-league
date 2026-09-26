import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FA League — ลีกของเพื่อนเรา',
  description: 'ตารางคะแนน ผลการแข่งขัน และสถิติ eFootball ของ FA League',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
