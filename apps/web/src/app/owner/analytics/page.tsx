'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { useOwnerAuth } from '@/lib/useOwnerAuth';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';
import { toastApiError } from '@/lib/toast';
import type { OwnerStats } from '@qr/types';
import { useTranslations } from 'next-intl';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';

export default function OwnerAnalyticsPage() {
  const { token } = useOwnerAuth();
  const t = useTranslations();
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const revenueLabel = stats?.revenue ? (stats.revenue / 100).toFixed(2) : (0).toFixed(2);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_HTTP}/owner/stats`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setStats(data);
      } catch (err) {
        toastApiError(err, t('owner.errors.loadAnalytics'));
      }
    };
    load();
  }, [token, t]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-semibold">{t('owner.analytics.title')}</div>
        <div className="text-sm text-muted-foreground">{t('owner.analytics.subtitle')}</div>
      </div>
      <Card className="p-4">
        <div className="text-sm font-semibold">{t('owner.analytics.orders30d')}</div>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={stats?.ordersLast30d ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#14b8a6" fill="#14b8a6" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-semibold">{t('owner.analytics.topItems')}</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={stats?.topItems ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="itemName" hide />
                <Tooltip />
                <Legend />
                <Bar dataKey="qty" fill="#0f172a" />
                <Bar dataKey="revenue" fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold">{t('owner.analytics.revenue')}</div>
          <div className="text-3xl font-semibold text-teal-700">{revenueLabel}</div>
        </Card>
      </div>
    </div>
  );
}
