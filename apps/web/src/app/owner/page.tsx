'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnerAuth } from '@/lib/useOwnerAuth';
import { useTranslations } from 'next-intl';

export default function OwnerIndexPage() {
  const router = useRouter();
  const t = useTranslations();
  const { token } = useOwnerAuth(false);
  useEffect(() => {
    if (token) router.replace('/owner/venues');
    else router.replace('/owner/login');
  }, [token, router]);
  return <div className="p-6 text-muted-foreground">{t('owner.states.loading')}</div>;
}
