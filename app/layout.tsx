import './globals.css';
import { TelegramAuthProvider } from '@/components/TelegramAuthProvider';

export const metadata = {
  title: 'Voice of Youth Msg',
  description: 'Telegram Mini App Survey Platform'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <TelegramAuthProvider>
          <div className="min-h-screen bg-slate-50 text-slate-900">
            {children}
          </div>
        </TelegramAuthProvider>
      </body>
    </html>
  );
}
