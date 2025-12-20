import type { Metadata } from 'next';
import { Jost } from 'next/font/google';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import IntlProvider from '@/components/IntlProvider';

const font = Jost({
  subsets: ['latin'],
  display: 'swap',
  weight: ['100','200','300','400','500','600','700','800','900']
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: t('common.meta.title'),
    description: t('common.meta.description'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${font.className} font-sans antialiased`}>
        <IntlProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </IntlProvider>
      </body>
    </html>
  );
}
