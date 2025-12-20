'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';

type Props = {
  remainingCents: number;
  currency: string;
};

export function OutstandingBanner({ remainingCents, currency }: Props) {
  const t = useTranslations();
  if (remainingCents <= 0) return null;
  const amount = `${(remainingCents / 100).toFixed(2)} ${currency}`;
  return (
    <Card className="flex items-center gap-1 border-warnTint/60 bg-warnTint/40 px-3 py-2 text-sm rounded-none">
      <AlertCircle className="h-4 w-4 text-primary" />
      <div>
        <div className="font-semibold text-foreground">{t('guest.outstanding.title')}</div>
        <div className="text-muted-foreground">{t('guest.outstanding.remaining', { amount })}</div>
      </div>
    </Card>
  );
}
