'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { OWNER_TOKEN_KEY, useOwnerAuth } from '@/lib/useOwnerAuth';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function OwnerLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const { token, clear } = useOwnerAuth(pathname !== '/owner/login');
  const isLogin = pathname === '/owner/login';
  const nav = [
    { href: '/owner/venues', label: t('owner.nav.venues') },
    { href: '/owner/analytics', label: t('owner.nav.analytics') },
  ];

  if (!token && !isLogin) {
    return <div className="p-6 text-muted-foreground">{t('common.states.redirecting')}</div>;
  }

  if (isLogin) {
    return <main className="min-h-screen bg-slate-50 text-slate-900">{children}</main>;
  }

  const content = (
    <div className="flex flex-col gap-3 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('owner.nav.title')}</div>
      {nav.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm ${active ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
          >
            {item.label}
          </Link>
        );
      })}
      <Button
        variant="outline"
        onClick={() => {
          localStorage.removeItem(OWNER_TOKEN_KEY);
          clear();
        }}
      >
        {t('common.actions.logout')}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild className="sm:hidden">
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              {content}
            </SheetContent>
          </Sheet>
          <div className="text-lg font-semibold text-teal-700">{t('owner.header.title')}</div>
        </div>
        <Button variant="ghost" onClick={() => router.push('/owner/analytics')}>
          {t('owner.nav.analytics')}
        </Button>
      </header>
      <div className="flex">
        <aside className="hidden w-64 border-r bg-white sm:block">{content}</aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
