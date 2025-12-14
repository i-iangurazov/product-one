'use client';

import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Order, OrderStatusEnum } from '@qr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/useLanguage';
import { getTranslations, type Language } from '@/lib/i18n';
import { useStaffAuth } from '@/lib/useStaffAuth';
import { Bell, RefreshCw, ShoppingBag } from 'lucide-react';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';
const API_WS = process.env.NEXT_PUBLIC_API_WS ?? 'http://localhost:4000';
// Should match venue slug/id used by sessions; defaults to demo slug
const VENUE_ID = process.env.NEXT_PUBLIC_VENUE_ID ?? 'venue-demo';

export default function WaiterPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [assistance, setAssistance] = useState<Array<{ tableId: string; message?: string; time: string }>>([]);
  const { lang, setLang } = useLanguage();
  const t = getTranslations(lang);
  const { accessToken, user, loading: authLoading, error: authError, login, authorizedFetch } = useStaffAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    try {
      const res = await authorizedFetch(`${API_HTTP}/staff/orders?status=READY`);
      const data = await res.json();
      setOrders((data.orders ?? []).filter((o: Order) => o.status === OrderStatusEnum.enum.READY));
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
          toast.success(`${t.readyServeTitle}: #${payload.order.number} (${t.table} ${payload.order.tableId})`);
        }
      }
    };

    const onAssistance = (payload: { sessionId: string; tableId: string; message?: string }) => {
      toast.info(`${t.callWaiter}: ${t.table} ${payload.tableId}${payload.message ? ` — ${payload.message}` : ''}`);
      setAssistance((prev) => [{ tableId: payload.tableId, message: payload.message, time: new Date().toLocaleTimeString() }, ...prev]);
    };

    s.on('order.updated', onOrderUpdated);
    s.on('table.assistanceRequested', onAssistance);

    return () => {
      s.off('connect', onConnect);
      s.off('order.updated', onOrderUpdated);
      s.off('table.assistanceRequested', onAssistance);
      s.disconnect();
    };
  }, [accessToken, fetchOrders, t.callWaiter, t.readyServeTitle, t.table]);

  const markServed = async (orderId: string) => {
    if (!accessToken) {
      toast.error(t.errorGeneric);
      return;
    }
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
      toast.error(t.errorGeneric);
    }
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="p-4 space-y-3 w-full max-w-md">
          <div className="text-lg font-semibold">{t.signIn}</div>
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
            <Bell className="h-4 w-4" />
            {t.roleWaiter}
          </div>
          <div className="text-2xl font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {t.readyServeTitle}
          </div>
          {user && <div className="text-xs text-muted-foreground">{user.email || user.phone}</div>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={lang} onValueChange={(val) => setLang(val as Language)}>
            <SelectTrigger className="w-28">
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
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{t.guestCalls}</div>
          <Badge variant="secondary">{assistance.length}</Badge>
        </div>
        {assistance.length === 0 && <div className="text-sm text-muted-foreground">{t.noCalls}</div>}
        <div className='grid grid-cols-1 gap-2'>
          {assistance.map((a, idx) => (
            <div key={`${a.tableId}-${idx}`} className="border rounded-md p-2 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {t.table} {a.tableId}
                </span>
                <span className="text-xs text-muted-foreground">{a.time}</span>
              </div>
              {a.message && <div className="text-muted-foreground text-xs">{a.message}</div>}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4 space-y-3">
        {orders.length === 0 && <div className="text-sm text-muted-foreground">{t.readyListEmpty}</div>}
        {orders.map((order) => (
          <div key={order.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">#{order.number}</div>
              <Badge>{order.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {t.table} {order.tableId}
            </div>
            <div className="text-sm">
              {order.items.map((i) => (
                <div key={i.id}>
                  {i.qty} × {i.itemName}
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={() => markServed(order.id)}>
              {t.markServed}
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
