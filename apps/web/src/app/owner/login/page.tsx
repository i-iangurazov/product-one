'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toastApiError, toastSuccess } from '@/lib/toast';
import { OWNER_REDIRECT_KEY, OWNER_TOKEN_KEY, useOwnerAuth } from '@/lib/useOwnerAuth';
import { useTranslations } from 'next-intl';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';

function OwnerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const { setToken } = useOwnerAuth(false);
  const [email, setEmail] = useState(() => t('owner.login.demoEmail'));
  const [password, setPassword] = useState(() => t('owner.login.demoPassword'));
  const [loading, setLoading] = useState(false);
  const nextParam = searchParams?.get('next');

  const resolveDestination = (storedNext: string | null) => {
    const urlNext = nextParam;
    const candidate = urlNext && urlNext.startsWith('/') ? urlNext : storedNext;
    return candidate && candidate.startsWith('/owner') ? candidate : '/owner/venues';
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_HTTP}/owner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.accessToken) {
        const message = data?.message ?? t('owner.errors.loginFailed');
        throw new Error(message);
      }
      localStorage.setItem(OWNER_TOKEN_KEY, data.accessToken);
      setToken?.(data.accessToken);
      toastSuccess(t('owner.toasts.loggedIn'));
      const storedNext = typeof window !== 'undefined' ? localStorage.getItem(OWNER_REDIRECT_KEY) : null;
      const urlNext = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(OWNER_REDIRECT_KEY);
      }
      const destination = resolveDestination(urlNext || storedNext);
      router.replace(destination);
    } catch (err) {
      toastApiError(err, t('errors.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div>
          <div className="text-lg font-semibold">{t('owner.login.title')}</div>
          <div className="text-sm text-muted-foreground">{t('owner.login.subtitle')}</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('forms.placeholders.email')}
            required
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('forms.placeholders.password')}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('common.states.loading') : t('common.actions.signIn')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function OwnerLoginPage() {
  const t = useTranslations();
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center">{t('common.states.loading')}</div>}
    >
      <OwnerLoginContent />
    </Suspense>
  );
}
