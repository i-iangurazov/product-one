'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { Order, OrderStatusEnum, type OrderStatus } from '@qr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toastApiError } from '@/lib/toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/lib/useLanguage';
import type { Language } from '@/lib/i18n';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { ChefHat, Loader2, RefreshCw } from 'lucide-react';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';
const API_WS = process.env.NEXT_PUBLIC_API_WS ?? 'http://localhost:4000';
const VENUE_ID = process.env.NEXT_PUBLIC_VENUE_ID ?? 'venue-demo';

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set());
  const { lang, setLang } = useLanguage();
  const t = useTranslations();
  const { accessToken, user, login, authorizedFetch, loading: authLoading, error: authError } = useStaffAuth();
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
      const res = await authorizedFetch(`${API_HTTP}/staff/orders?status=NEW,ACCEPTED,IN_PROGRESS,READY,SERVED`);
      const data = await res.json();
      setOrders(data.orders ?? []);
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
        s.emit('kitchen.subscribe', { venueId: VENUE_ID, token: accessToken });
      }
    };
    s.on('connect', onConnect);
    if (s.connected) onConnect();

    const upsertOrder = (order: Order) => {
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === order.id);
        const next = exists ? prev.map((o) => (o.id === order.id ? order : o)) : [...prev, order];
        return next;
      });
    };

    const onOrderCreated = (payload: { order: Order }) => {
      upsertOrder(payload.order);
    };
    const onOrderUpdated = (payload: { order: Order }) => {
      upsertOrder(payload.order);
    };

    s.on('order.created', onOrderCreated);
    s.on('order.updated', onOrderUpdated);

    return () => {
      s.off('connect', onConnect);
      s.off('order.created', onOrderCreated);
      s.off('order.updated', onOrderUpdated);
      s.disconnect();
    };
  }, [accessToken, fetchOrders]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    if (!accessToken) {
      return;
    }
    setPendingOrderIds((prev) => new Set(prev).add(orderId));
    try {
      await authorizedFetch(`${API_HTTP}/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
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

  const renderStatus = (status: OrderStatus) => {
    const statusClasses: Record<OrderStatus, string> = {
      [OrderStatusEnum.enum.NEW]: 'border-brandTint/60 bg-brandTint/30 text-foreground',
      [OrderStatusEnum.enum.ACCEPTED]: 'border-warnTint/70 bg-warnTint/40 text-foreground',
      [OrderStatusEnum.enum.IN_PROGRESS]: 'border-warnTint/70 bg-warnTint/40 text-foreground',
      [OrderStatusEnum.enum.READY]: 'border-brandTint/60 bg-brandTint/30 text-foreground',
      [OrderStatusEnum.enum.SERVED]: 'border-border bg-muted text-muted-foreground',
      [OrderStatusEnum.enum.CANCELLED]: 'border-destructive/40 bg-destructive/10 text-destructive',
    };
    return (
      <Badge variant="outline" className={statusClasses[status] ?? ''}>
        {t(`status.order.${status}` as never)}
      </Badge>
    );
  };

  const lanes: Array<{
    id: string;
    title: string;
    statuses: OrderStatus[];
    action?: (order: Order) => { label: string; to: OrderStatus } | null;
  }> = [
    {
      id: 'new',
      title: t('kitchen.lanes.new'),
      statuses: [OrderStatusEnum.enum.NEW],
      action: () => ({ label: t('kitchen.actions.acceptOrder'), to: OrderStatusEnum.enum.ACCEPTED }),
    },
    {
      id: 'preparing',
      title: t('kitchen.lanes.preparing'),
      statuses: [OrderStatusEnum.enum.ACCEPTED, OrderStatusEnum.enum.IN_PROGRESS],
      action: (order) =>
        order.status === OrderStatusEnum.enum.ACCEPTED
          ? { label: t('kitchen.actions.startCooking'), to: OrderStatusEnum.enum.IN_PROGRESS }
          : { label: t('kitchen.actions.markReady'), to: OrderStatusEnum.enum.READY },
    },
    { id: 'ready', title: t('kitchen.lanes.ready'), statuses: [OrderStatusEnum.enum.READY] },
    { id: 'served', title: t('kitchen.lanes.served'), statuses: [OrderStatusEnum.enum.SERVED] },
  ];

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
          <Card className="w-full space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{t('common.roles.kitchen')}</div>
                <div className="text-xl font-semibold">{t('common.actions.signIn')}</div>
              </div>
              <Select value={lang} onValueChange={(val) => setLang(val as Language)}>
                <SelectTrigger className="w-24">
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
              <ChefHat className="h-4 w-4" />
              {t('common.roles.kitchen')}
            </div>
            <div className="text-2xl font-semibold">{t('kitchen.title')}</div>
            {user && <div className="text-sm text-muted-foreground">{user.email || user.phone}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Select value={lang} onValueChange={(val) => setLang(val as Language)}>
              <SelectTrigger className="w-24">
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

        {error && (
          <Card className="flex items-center justify-between border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <div>{error}</div>
            <Button size="sm" variant="outline" onClick={fetchOrders} disabled={loading}>
              {t('common.actions.refresh')}
            </Button>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-4">
          {lanes.map((lane) => {
            const laneOrders = orders.filter((o) => lane.statuses.includes(o.status));
            return (
              <Card key={lane.id} className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">{lane.title}</div>
                  <Badge variant="outline">{laneOrders.length}</Badge>
                </div>
                <ScrollArea className="max-h-[70vh] pr-1">
                  <div className="space-y-3">
                    {loading ? (
                      Array.from({ length: 2 }).map((_, idx) => (
                        <Card key={idx} className="space-y-3 border p-4 animate-pulse">
                          <div className="h-4 w-1/3 rounded bg-muted" />
                          <div className="h-3 w-1/2 rounded bg-muted" />
                          <div className="h-3 w-2/3 rounded bg-muted" />
                        </Card>
                      ))
                    ) : laneOrders.length === 0 ? (
                      <Card className="border-dashed p-4 text-sm text-muted-foreground">
                        {t('kitchen.emptyLane')}
                      </Card>
                    ) : (
                      laneOrders.map((order) => {
                        const action = lane.action?.(order);
                        const pending = pendingOrderIds.has(order.id);
                        return (
                          <Card key={order.id} className="space-y-3 border p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-base font-semibold">#{order.number}</div>
                              {renderStatus(order.status)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {t('common.labels.table')} {order.tableId}
                            </div>
                            <div className="space-y-1 text-sm">
                              {order.items.map((i) => (
                                <div key={i.id} className="flex items-center justify-between gap-2">
                                  <span>
                                    {i.qty} × {i.itemName}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {((i.unitPrice + i.modifiers.reduce((s, m) => s + m.priceDelta, 0)) / 100).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {action && (
                              <Button size="sm" onClick={() => updateStatus(order.id, action.to)} disabled={pending}>
                                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                                {action.label}
                              </Button>
                            )}
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
