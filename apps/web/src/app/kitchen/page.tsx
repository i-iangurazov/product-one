'use client';

import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Order, OrderStatusEnum, type OrderStatus } from '@qr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/useLanguage';
import { getTranslations, type Language } from '@/lib/i18n';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { ChefHat, CheckCircle2, Clock3, RefreshCw, UtensilsCrossed } from 'lucide-react';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';
const API_WS = process.env.NEXT_PUBLIC_API_WS ?? 'http://localhost:4000';
const VENUE_ID = process.env.NEXT_PUBLIC_VENUE_ID ?? 'venue-demo';

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const { lang, setLang } = useLanguage();
  const t = getTranslations(lang);
  const { accessToken, user, login, authorizedFetch, loading: authLoading, error: authError } = useStaffAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const res = await authorizedFetch(`${API_HTTP}/staff/orders?status=NEW,ACCEPTED,IN_PROGRESS,READY`);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err) {
      console.error(err);
      toast.error(t.noOrders);
    } finally {
      setLoading(false);
    }
  }, [accessToken, authorizedFetch, t.noOrders]);

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
      toast.error(t.errorGeneric);
    }
  };

  const renderStatus = (status: OrderStatus) => {
    const variant =
      status === OrderStatusEnum.enum.NEW
        ? 'outline'
        : status === OrderStatusEnum.enum.READY
          ? 'default'
          : 'secondary';
    return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
  };

  const lanes: Array<{ title: string; filter: OrderStatus; action?: { label: string; to: OrderStatus } }> = [
    { title: t.newOrders, filter: OrderStatusEnum.enum.NEW, action: { label: t.acceptOrder, to: OrderStatusEnum.enum.ACCEPTED } },
    {
      title: t.acceptedOrders,
      filter: OrderStatusEnum.enum.ACCEPTED,
      action: { label: t.startCooking, to: OrderStatusEnum.enum.IN_PROGRESS },
    },
    {
      title: t.inProgressOrders,
      filter: OrderStatusEnum.enum.IN_PROGRESS,
      action: { label: t.readyAction, to: OrderStatusEnum.enum.READY },
    },
    { title: t.readyOrders, filter: OrderStatusEnum.enum.READY },
  ];

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="p-4 space-y-3 w-full max-w-md">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{t.signIn}</div>
            <Select value={lang} onValueChange={(val) => setLang(val as Language)}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Lang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">RU</SelectItem>
                <SelectItem value="en">EN</SelectItem>
                <SelectItem value="kg">KG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder={t.email} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
          <Input
            placeholder={t.password}
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
              } catch {
                toast.error(authError ?? t.errorGeneric);
              }
            }}
          >
            {authLoading ? '…' : t.signIn}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            {t.roleKitchen}
          </div>
          <div className="text-2xl font-semibold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            {t.kitchen}
          </div>
          {user && <div className="text-xs text-muted-foreground">{user.email || user.phone}</div>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={lang} onValueChange={(val) => setLang(val as Language)}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Lang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">RU</SelectItem>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="kg">KG</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchOrders} disabled={loading} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t.refresh}
          </Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {lanes.map((lane) => (
          <Card key={lane.title} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                {lane.filter === OrderStatusEnum.enum.NEW && <Clock3 className="h-4 w-4" />}
                {lane.filter === OrderStatusEnum.enum.ACCEPTED && <RefreshCw className="h-4 w-4" />}
                {lane.filter === OrderStatusEnum.enum.IN_PROGRESS && <UtensilsCrossed className="h-4 w-4" />}
                {lane.filter === OrderStatusEnum.enum.READY && <CheckCircle2 className="h-4 w-4" />}
                {lane.title}
              </div>
              <Badge variant="secondary">{orders.filter((o) => o.status === lane.filter).length}</Badge>
            </div>
            <div className="space-y-2">
              {orders
                .filter((o) => o.status === lane.filter)
                .map((order) => (
                  <div key={order.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">#{order.number}</div>
                      {renderStatus(order.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">Стол {order.tableId}</div>
                    <div className="text-sm">
                      {order.items.map((i) => (
                        <div key={i.id} className="flex justify-between">
                          <span>
                            {i.qty} × {i.itemName}
                          </span>
                          <span className="text-muted-foreground">
                            {(i.unitPrice / 100).toFixed(2)} + {(i.modifiers.reduce((s, m) => s + m.priceDelta, 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {lane.action && (
                      <Button size="sm" onClick={() => updateStatus(order.id, lane.action!.to)}>
                        {lane.action.label}
                      </Button>
                    )}
                  </div>
                ))}
              {orders.filter((o) => o.status === lane.filter).length === 0 && (
                <div className="text-sm text-muted-foreground">Нет заказов</div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
