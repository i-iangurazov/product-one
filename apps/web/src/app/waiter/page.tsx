'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { Order, OrderStatusEnum } from '@qr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toastApiError, toastInfo, toastSuccess } from '@/lib/toast';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/lib/useLanguage';
import type { Language } from '@/lib/i18n';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { Bell, Loader2, RefreshCw } from 'lucide-react';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';
const API_WS = process.env.NEXT_PUBLIC_API_WS ?? 'http://localhost:4000';
// Should match venue slug/id used by sessions; defaults to demo slug
const VENUE_ID = process.env.NEXT_PUBLIC_VENUE_ID ?? 'venue-demo';

export default function WaiterPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [assistance, setAssistance] = useState<
    Array<{ tableId: string; message?: string; time: string; timestamp: number }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'orders' | 'calls'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set());
  const { lang, setLang } = useLanguage();
  const t = useTranslations();
  const { accessToken, user, loading: authLoading, error: authError, login, authorizedFetch } = useStaffAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const languageOptions = useMemo(
    () => [
      { value: 'en', label: t('common.language.options.en') },
      { value: 'ru', label: t('common.language.options.ru') },
      { value: 'kg', label: t('common.language.options.kg') },
    ],
    [t]
  );
  const authErrorMessage = authError ? t(authError as never) : t('errors.invalidCredentials');

  const fetchOrders = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authorizedFetch(`${API_HTTP}/staff/orders?status=READY`);
      const data = await res.json();
      setOrders((data.orders ?? []).filter((o: Order) => o.status === OrderStatusEnum.enum.READY));
    } catch (err) {
      console.error(err);
      setError(t('errors.generic'));
      toastApiError(err, t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, authorizedFetch, t]);

  useEffect(() => {
    fetchOrders();
    const s = io(API_WS);

    const onConnect = () => {
      if (accessToken) {
        s.emit('waiter.subscribe', { venueId: VENUE_ID, token: accessToken });
      }
    };
    s.on('connect', onConnect);
    if (s.connected) onConnect();

    const onOrderUpdated = (payload: { order: Order }) => {
      if (payload.order.venueId !== VENUE_ID) return;
      if (payload.order.status === OrderStatusEnum.enum.READY || payload.order.status === OrderStatusEnum.enum.SERVED) {
        setOrders((prev) => {
          const exists = prev.find((o) => o.id === payload.order.id);
          const updated = exists
            ? prev.map((o) => (o.id === payload.order.id ? payload.order : o))
            : [...prev, payload.order];
          return updated.filter((o) => o.status === OrderStatusEnum.enum.READY);
        });
        if (payload.order.status === OrderStatusEnum.enum.READY) {
          toastSuccess(t('staff.toasts.orderReady', { number: payload.order.number, table: payload.order.tableId }));
        }
      }
    };

    const onAssistance = (payload: { sessionId: string; tableId: string; message?: string }) => {
      if (payload.message) {
        toastInfo(t('staff.toasts.callWaiterWithMessage', { table: payload.tableId, message: payload.message }));
      } else {
        toastInfo(t('staff.toasts.callWaiter', { table: payload.tableId }));
      }
      const now = Date.now();
      setAssistance((prev) => [
        { tableId: payload.tableId, message: payload.message, time: new Date(now).toLocaleTimeString(), timestamp: now },
        ...prev,
      ]);
    };

    s.on('order.updated', onOrderUpdated);
    s.on('table.assistanceRequested', onAssistance);

    return () => {
      s.off('connect', onConnect);
      s.off('order.updated', onOrderUpdated);
      s.off('table.assistanceRequested', onAssistance);
      s.disconnect();
    };
  }, [accessToken, fetchOrders, t]);

  const markServed = async (orderId: string) => {
    if (!accessToken) {
      toastApiError(t('errors.generic'), t('errors.generic'));
      return;
    }
    setPendingOrderIds((prev) => new Set(prev).add(orderId));
    try {
      await authorizedFetch(`${API_HTTP}/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: OrderStatusEnum.enum.SERVED }),
      });
      fetchOrders();
    } catch (err) {
      console.error(err);
      toastApiError(err, t('errors.generic'));
    } finally {
      setPendingOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const normalizedSearch = search.toLowerCase().trim();
  const filteredOrders = orders.filter((order) => {
    if (!normalizedSearch) return true;
    const text = `${order.number} ${order.tableId} ${order.items.map((i) => i.itemName).join(' ')}`.toLowerCase();
    return text.includes(normalizedSearch);
  });
  const filteredAssistance = assistance.filter((call) => {
    if (!normalizedSearch) return true;
    const text = `${call.tableId} ${call.message ?? ''}`.toLowerCase();
    return text.includes(normalizedSearch);
  });
  const sortedOrders = [...filteredOrders].sort((a, b) =>
    sortOrder === 'newest' ? b.number - a.number : a.number - b.number
  );
  const sortedAssistance = [...filteredAssistance].sort((a, b) =>
    sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
  );
  const showOrders = viewFilter !== 'calls';
  const showCalls = viewFilter !== 'orders';
  const resetFilters = () => {
    setSearch('');
    setViewFilter('all');
    setSortOrder('newest');
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
          <Card className="w-full space-y-4 p-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t('common.roles.waiter')}</div>
              <div className="text-xl font-semibold">{t('common.actions.signIn')}</div>
            </div>
            <Input
              className="h-11"
              placeholder={t('forms.placeholders.email')}
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <Input
              className="h-11"
              placeholder={t('forms.placeholders.password')}
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <Button
              disabled={authLoading}
              onClick={async () => {
                try {
                  await login({ email: loginEmail, password: loginPassword });
                  fetchOrders();
                } catch (err) {
                  toastApiError(err ?? authErrorMessage, authErrorMessage);
                }
              }}
            >
              {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {authLoading ? t('common.states.loading') : t('common.actions.signIn')}
            </Button>
            {authError && <div className="text-sm text-destructive">{authErrorMessage}</div>}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bell className="h-4 w-4" />
              {t('common.roles.waiter')}
            </div>
            <div className="text-2xl font-semibold">{t('staff.readyTitle')}</div>
            {user && <div className="text-sm text-muted-foreground">{user.email || user.phone}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Select value={lang} onValueChange={(val) => setLang(val as Language)}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder={t('common.language.label')} />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchOrders} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('common.actions.refresh')}
            </Button>
          </div>
        </div>

        <Card className="p-4 md:p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder={t('staff.filters.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={viewFilter} onValueChange={(val) => setViewFilter(val as typeof viewFilter)}>
              <SelectTrigger>
                <SelectValue placeholder={t('staff.filters.viewLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('staff.filters.viewAll')}</SelectItem>
                <SelectItem value="orders">{t('staff.filters.viewOrders')}</SelectItem>
                <SelectItem value="calls">{t('staff.filters.viewCalls')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(val) => setSortOrder(val as typeof sortOrder)}>
              <SelectTrigger>
                <SelectValue placeholder={t('staff.filters.sortLabel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('staff.filters.sortNewest')}</SelectItem>
                <SelectItem value="oldest">{t('staff.filters.sortOldest')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {error && (
          <Card className="flex items-center justify-between border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <div>{error}</div>
            <Button size="sm" variant="outline" onClick={fetchOrders} disabled={loading}>
              {t('common.actions.refresh')}
            </Button>
          </Card>
        )}

        {showCalls && (
          <Card className="space-y-3 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t('staff.calls.title')}</div>
              <Badge variant="outline">{sortedAssistance.length}</Badge>
            </div>
            {sortedAssistance.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
                <div>{t('staff.calls.empty')}</div>
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  {t('common.actions.clearFilters')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                {sortedAssistance.map((a, idx) => (
                  <div key={`${a.tableId}-${idx}`} className="rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span>
                        {t('common.labels.table')} {a.tableId}
                      </span>
                      <span className="text-sm text-muted-foreground">{a.time}</span>
                    </div>
                    {a.message && <div className="text-sm text-muted-foreground">{a.message}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {showOrders && (
          <Card className="space-y-3 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t('staff.readyTitle')}</div>
              <Badge variant="outline">{sortedOrders.length}</Badge>
            </div>
            {sortedOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
                <div>{t('staff.orders.empty')}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={fetchOrders} disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('common.actions.refresh')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetFilters}>
                    {t('common.actions.clearFilters')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedOrders.map((order) => {
                  const pending = pendingOrderIds.has(order.id);
                  return (
                    <div key={order.id} className="space-y-2 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-semibold">#{order.number}</div>
                        <Badge variant="outline">{t(`status.order.${order.status}` as never)}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t('common.labels.table')} {order.tableId}
                      </div>
                      <div className="space-y-1 text-sm">
                        {order.items.map((i) => (
                          <div key={i.id}>
                            {i.qty} × {i.itemName}
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => markServed(order.id)} disabled={pending}>
                        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('staff.actions.markServed')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
