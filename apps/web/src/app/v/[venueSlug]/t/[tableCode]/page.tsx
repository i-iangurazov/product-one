'use client';

import { use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  CartItem,
  CartTotals,
  JoinSessionResponse,
  MenuItem,
  ModifierSelection,
  Order,
  OrderStatus,
  OrderStatusEnum,
  PaymentIntent,
  PaymentCreateResponse,
  PaymentStatusEnum,
  PublicMenuResponse,
  SessionState,
} from '@qr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/useLanguage';
import { getTranslations, type Language } from '@/lib/i18n';
import { BellRing, CircleCheck, ListCheck, Pin, Soup, UtensilsCrossed } from 'lucide-react';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';
const API_WS = process.env.NEXT_PUBLIC_API_WS ?? 'http://localhost:4000';


function getDeviceHash() {
  if (typeof window === 'undefined') return '';
  const key = 'qr_device_hash';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const v = crypto.randomUUID();
  localStorage.setItem(key, v);
  return v;
}

type SelectionMap = Record<string, string[]>;

function computeTotals(cart: CartItem[]): CartTotals {
  const subtotal = cart.reduce((sum, item) => {
    const modSum = item.modifiers.reduce((m, mod) => m + mod.priceDelta, 0);
    return sum + (item.unitPrice + modSum) * item.qty;
  }, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  return { subtotal, total: subtotal, itemCount };
}

function computeOrderAmount(order: Order) {
  return order.items.reduce((sum, item) => {
    const modSum = item.modifiers.reduce((m, mod) => m + mod.priceDelta, 0);
    return sum + (item.unitPrice + modSum) * item.qty;
  }, 0);
}

function computeOrdersTotal(list: Order[]) {
  return list.reduce((sum, order) => sum + computeOrderAmount(order), 0);
}

function computeCartItemsTotal(list: CartItem[]) {
  return list.reduce((sum, item) => {
    const modSum = item.modifiers.reduce((m, mod) => m + mod.priceDelta, 0);
    return sum + (item.unitPrice + modSum) * item.qty;
  }, 0);
}

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function TablePage({ params }: { params: Promise<{ venueSlug: string; tableCode: string }> }) {
  const resolvedParams = use(params);
  const { venueSlug, tableCode } = resolvedParams;
  const { lang, setLang } = useLanguage();
  const t = getTranslations(lang);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartTotals, setCartTotals] = useState<CartTotals>(() => ({ subtotal: 0, total: 0, itemCount: 0 }));
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentIntent[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [menuVersion, setMenuVersion] = useState<string | null>(null);
  const [peopleCount, setPeopleCount] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'EVEN' | 'ITEMS'>('FULL');
  const [selectedItemsForPayment, setSelectedItemsForPayment] = useState<Set<string>>(new Set());
  const [splitCount, setSplitCount] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selection, setSelection] = useState<SelectionMap>({});
  const [note, setNote] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [sessionClosed, setSessionClosed] = useState<string | null>(null);
  const sessionId = sessionState?.session.id;
  const sessionPeopleCount = sessionState?.session.peopleCount;
  const fetchSessionState = useCallback(async () => {
    if (!sessionId || !sessionToken) return;
    try {
      const res = await fetch(`${API_HTTP}/public/sessions/${sessionId}/state`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) return;
      const data: SessionState = await res.json();
      setSessionState(data);
      setCart(data.cart);
      setOrders(data.ordersActive);
      setPayments(data.payments ?? []);
      setCartTotals(computeTotals(data.cart));
      setMenuVersion(data.menuVersion ?? null);
      if (data.session.peopleCount) {
        setSplitCount(String(data.session.peopleCount));
      }
      setSessionClosed(null);
    } catch (err) {
      console.error(err);
    }
  }, [sessionId, sessionToken]);

  useEffect(() => {
    const s = io(API_WS);
    setSocket(s);
    setIsOffline(false);

    const onState = (payload: SessionState) => {
      setSessionState(payload);
      setCart(payload.cart);
      setOrders(payload.ordersActive);
      setPayments(payload.payments ?? []);
      setCartTotals(computeTotals(payload.cart));
      setSessionClosed(null);
      setMenuVersion(payload.menuVersion ?? null);
    };

    const onCart = (payload: { cart: CartItem[]; totals: CartTotals }) => {
      setCart(payload.cart);
      setCartTotals(payload.totals);
    };

    const onOrderCreated = (payload: { order: Order }) => {
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === payload.order.id);
        const next = exists ? prev : [...prev, payload.order];
        const sorted = [...next].sort((a, b) => a.number - b.number);
        return sorted;
      });
      toast.success(`${t.orderSent}: #${payload.order.number}`);
    };

    const onOrderUpdated = (payload: { order: Order }) => {
      setOrders((prev) => {
        const prevOrder = prev.find((o) => o.id === payload.order.id);
        const replaced = prev.map((o) => (o.id === payload.order.id ? payload.order : o));
        const sorted = [...replaced].sort((a, b) => a.number - b.number);
        if (payload.order.status === OrderStatusEnum.enum.READY && prevOrder?.status !== OrderStatusEnum.enum.READY) {
          toast.success(`${t.orderReady}: #${payload.order.number}`);
        }
        return sorted;
      });
    };

    const onError = (err: { code: string; message: string }) => {
      toast.error(err.message ?? t.errorGeneric);
    };

    const onPaymentUpdated = (payload: { payment: PaymentIntent }) => {
      setPayments((prev) => {
        const existing = prev.find((p) => p.id === payload.payment.id);
        if (!existing) return [...prev, payload.payment];
        return prev.map((p) => (p.id === payload.payment.id ? payload.payment : p));
      });
      if (payload.payment.status === PaymentStatusEnum.enum.PAID) {
        toast.success(t.paymentConfirmed);
      }
    };

    const onMenuUpdated = async (payload: { version: string }) => {
      if (payload.version === menuVersion) return;
      try {
        const res = await fetch(`${API_HTTP}/public/venues/${venueSlug}/menu`);
        const data: PublicMenuResponse = await res.json();
        setMenu(data);
        setMenuVersion(payload.version);
        toast.success(t.menu);
      } catch (err) {
        console.error(err);
        toast.error(t.menuLoadFailed);
      }
    };

    const onDisconnected = () => {
      setIsOffline(true);
    };

    const onConnected = () => {
      setIsOffline(false);
      if (sessionToken && sessionId) {
        const deviceHash = getDeviceHash();
        s.emit('session.join', {
          sessionId,
          venueSlug,
          tableCode,
          deviceHash,
          peopleCount: sessionPeopleCount,
          token: sessionToken,
        });
        fetchSessionState();
      }
    };

    const onSessionClosed = (payload: { sessionId: string; reason?: string }) => {
      setSessionClosed(payload.reason ?? 'closed');
      setSessionToken(null);
    };

    s.on('session.state', onState);
    s.on('cart.updated', onCart);
    s.on('order.created', onOrderCreated);
    s.on('order.updated', onOrderUpdated);
    s.on('error', onError);
    s.on('payment.updated', onPaymentUpdated);
    s.on('menu.updated', onMenuUpdated);
    s.on('disconnect', onDisconnected);
    s.on('connect', onConnected);
    s.on('session.closed', onSessionClosed);

    return () => {
      s.off('session.state', onState);
      s.off('cart.updated', onCart);
      s.off('order.created', onOrderCreated);
      s.off('order.updated', onOrderUpdated);
      s.off('error', onError);
      s.off('payment.updated', onPaymentUpdated);
      s.off('menu.updated', onMenuUpdated);
      s.off('disconnect', onDisconnected);
      s.off('connect', onConnected);
      s.off('session.closed', onSessionClosed);
      s.disconnect();
    };
  }, [
    tableCode,
    venueSlug,
    sessionToken,
    sessionId,
    sessionPeopleCount,
    menuVersion,
    fetchSessionState,
    t.orderReady,
    t.orderSent,
    t.paymentConfirmed,
    t.errorGeneric,
    t.menu,
    t.menuLoadFailed,
  ]);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch(`${API_HTTP}/public/venues/${venueSlug}/menu`);
        const data: PublicMenuResponse = await res.json();
        setMenu(data);
      } catch (err) {
        toast.error(t.menuLoadFailed);
        console.error(err);
      }
    };
    fetchMenu();
  }, [venueSlug, t.menuLoadFailed]);

  useEffect(() => {
    if (!socket || !sessionToken || !sessionId) return;
    const deviceHash = getDeviceHash();
    socket.emit('session.join', {
      sessionId,
      venueSlug,
      tableCode,
      deviceHash,
      peopleCount: sessionPeopleCount,
      token: sessionToken,
    });
  }, [socket, sessionToken, sessionId, sessionPeopleCount, venueSlug, tableCode]);

  useEffect(() => {
    if (!socket || !sessionToken || !sessionId) return;
    const deviceHash = getDeviceHash();
    const id = setInterval(() => {
      socket.emit('guest.ping', { sessionId, deviceHash, token: sessionToken });
    }, 15000);
    return () => clearInterval(id);
  }, [socket, sessionToken, sessionId]);

  const handleJoin = async () => {
    const countNum = Number(peopleCount);
    if (!countNum || countNum <= 0) {
      toast.error(t.peoplePlaceholder);
      return;
    }
    setJoining(true);
    try {
      const deviceHash = getDeviceHash();
      const res = await fetch(`${API_HTTP}/public/sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueSlug,
          tableCode,
          deviceHash,
          peopleCount: countNum,
        }),
      });
      if (!res.ok) throw new Error('Failed to join session');
      const data: JoinSessionResponse = await res.json();
      setSessionToken(data.token);
      setSessionState(data);
      setCart(data.cart);
      setOrders(data.ordersActive);
      setPayments(data.payments ?? []);
      setCartTotals(computeTotals(data.cart));
      if (data.session.peopleCount) {
        setSplitCount(String(data.session.peopleCount));
      }
      setSessionClosed(null);
      setMenuVersion(data.menuVersion ?? null);
      if (socket) {
        socket.emit('session.join', {
          sessionId: data.sessionId,
          venueSlug,
          tableCode,
          deviceHash,
          peopleCount: countNum || data.session.peopleCount,
          token: data.token,
        });
      }
      toast.success(t.connected);
    } catch (err) {
      console.error(err);
      toast.error(t.offline);
    } finally {
      setJoining(false);
    }
  };

  const handleSelectModifier = (groupId: string, optionId: string, maxSelect: number) => {
    setSelection((prev) => {
      const current = prev[groupId] ?? [];
      const exists = current.includes(optionId);
      let next = current;
      if (maxSelect === 1) {
        next = exists ? [] : [optionId];
      } else if (exists) {
        next = current.filter((id) => id !== optionId);
      } else {
        next = current.length >= maxSelect ? current : [...current, optionId];
      }
      return { ...prev, [groupId]: next };
    });
  };

  const selectedModifiers = useMemo((): ModifierSelection[] => {
    if (!selectedItem) return [];
    const mods: ModifierSelection[] = [];
    selectedItem.modifiers.forEach((group) => {
      const selectedIds = selection[group.id] ?? [];
      group.options.forEach((opt) => {
        if (selectedIds.includes(opt.id)) {
          mods.push({ optionId: opt.id, optionName: opt.name, priceDelta: opt.priceDelta });
        }
      });
    });
    return mods;
  }, [selection, selectedItem]);

  const canAddSelectedItem = useMemo(() => {
    if (!selectedItem) return false;
    return selectedItem.modifiers.every((group) => {
      const selectedIds = selection[group.id] ?? [];
      if (group.isRequired && selectedIds.length === 0) return false;
      if (selectedIds.length < group.minSelect) return false;
      if (selectedIds.length > group.maxSelect) return false;
      return true;
    });
  }, [selection, selectedItem]);

  const payableAmount = useMemo(() => {
    const paid = payments.filter((p) => p.status === PaymentStatusEnum.enum.PAID).reduce((sum, p) => sum + p.amount, 0);
    const baseTotal = orders.length ? computeOrdersTotal(orders) : cartTotals.total;
    const remaining = Math.max(baseTotal - paid, 0);

    if (paymentMode === 'FULL') {
      return remaining;
    }

    if (paymentMode === 'EVEN') {
      const count = Number(splitCount) > 0 ? Number(splitCount) : sessionState?.session.peopleCount ?? 1;
      const share = Math.ceil(remaining / Math.max(count, 1));
      return Math.max(share, 0);
    }

    if (paymentMode === 'ITEMS') {
      const selectedCartItems = cart.filter((c) => selectedItemsForPayment.has(c.id));
      const amount = computeCartItemsTotal(selectedCartItems);
      return Math.max(Math.min(amount, remaining), 0);
    }

    return remaining;
  }, [payments, paymentMode, orders, cartTotals.total, splitCount, sessionState?.session.peopleCount, cart, selectedItemsForPayment]);

  const handleAddToCart = () => {
    if (!socket || !sessionState || !sessionToken || !selectedItem) {
      toast.error(t.offline);
      return;
    }
    socket.emit('cart.addItem', {
      sessionId: sessionState.session.id,
      menuItemId: selectedItem.id,
      qty: 1,
      modifiers: selectedModifiers,
      note: note || undefined,
      token: sessionToken,
    });
    setSelectedItem(null);
    setSelection({});
    setNote('');
  };

  const updateQty = (cartItemId: string, qty: number) => {
    if (!socket || !sessionState || !sessionToken) {
      toast.error(t.offline);
      return;
    }
    socket.emit('cart.updateItemQty', {
      sessionId: sessionState.session.id,
      cartItemId,
      qty,
      token: sessionToken,
    });
  };

  const removeItem = (cartItemId: string) => {
    if (!socket || !sessionState || !sessionToken) {
      toast.error(t.offline);
      return;
    }
    socket.emit('cart.removeItem', { sessionId: sessionState.session.id, cartItemId, token: sessionToken });
  };

  const submitOrder = () => {
    if (!socket || !sessionState || !sessionToken) {
      toast.error(t.offline);
      return;
    }
    socket.emit('order.submit', { sessionId: sessionState.session.id, clientOrderKey: crypto.randomUUID(), token: sessionToken });
  };

  const callWaiter = (message?: string) => {
    if (!socket || !sessionState || !sessionToken) {
      toast.error(t.offline);
      return;
    }
    socket.emit('table.assistanceRequested', {
      sessionId: sessionState.session.id,
      deviceHash: getDeviceHash(),
      message: message ?? t.callWaiter,
      token: sessionToken,
    });
    toast.success(t.waiterNotified);
  };

  const toggleItemForPayment = (id: string) => {
    setSelectedItemsForPayment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createPayment = async () => {
    if (!sessionState || !sessionToken) {
      toast.error(t.offline);
      return;
    }
    if (payableAmount <= 0) {
      toast.info(t.nothingToPay);
      return;
    }
    setPaying(true);
    try {
      const res = await fetch(`${API_HTTP}/public/sessions/${sessionState.session.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          sessionId: sessionState.session.id,
          amount: paymentMode === 'FULL' ? payableAmount : undefined,
          mode: paymentMode,
          items: paymentMode === 'ITEMS' ? Array.from(selectedItemsForPayment) : undefined,
          splitCount: paymentMode === 'EVEN' ? (splitCount ? Number(splitCount) : sessionState.session.peopleCount) : undefined,
          paidByDeviceHash: getDeviceHash(),
          token: sessionToken,
        }),
      });
      if (!res.ok) throw new Error('Failed to create payment');
      const data: PaymentCreateResponse = await res.json();
      setPayments((prev) => {
        const exists = prev.find((p) => p.id === data.payment.id);
        if (exists) return prev.map((p) => (p.id === data.payment.id ? data.payment : p));
        return [...prev, data.payment];
      });
      toast.success(t.paymentCreated);
    } catch (err) {
      console.error(err);
      toast.error(t.paymentCreateFailed);
    } finally {
      setPaying(false);
    }
  };

  const renderStatus = (status: OrderStatus) => {
    const variant =
      status === OrderStatusEnum.enum.NEW
        ? 'outline'
        : status === OrderStatusEnum.enum.READY
          ? 'default'
          : status === OrderStatusEnum.enum.SERVED
            ? 'secondary'
            : 'secondary';
    const icon =
      status === OrderStatusEnum.enum.NEW
        ? <Pin className="h-3.5 w-3.5" />
        : status === OrderStatusEnum.enum.ACCEPTED
          ? <ListCheck className="h-3.5 w-3.5" />
          : status === OrderStatusEnum.enum.IN_PROGRESS
            ? <UtensilsCrossed className="h-3.5 w-3.5" />
            : status === OrderStatusEnum.enum.READY
              ? <CircleCheck className="h-3.5 w-3.5" />
              : <Soup className="h-3.5 w-3.5" />;
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {icon}
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const hasSession = !!sessionState && !!sessionToken;
  const currency = t.currency;
  const cartBarVisible = hasSession;

  const CartSheet = ({
    trigger,
    side = 'bottom',
    open,
    onOpenChange,
  }: { trigger?: ReactNode; side?: 'bottom' | 'right'; open?: boolean; onOpenChange?: (next: boolean) => void }) => {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          {trigger ?? (
            <Button variant="outline">
              {t.cart} ({cartTotals.itemCount})
            </Button>
          )}
        </SheetTrigger>
        <SheetContent side={side} className={side === 'bottom' ? 'h-[75vh] w-full sm:w-[520px]' : 'w-full sm:w-[420px]'}>
          <SheetHeader>
            <SheetTitle>{t.cart}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 p-4">
            <div className="space-y-2 rounded-md border p-3">
              <div className="text-sm font-medium">{t.payments}</div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="pay-mode" value="FULL" checked={paymentMode === 'FULL'} onChange={() => setPaymentMode('FULL')} />
                  <span>{t.payFull}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="pay-mode" value="EVEN" checked={paymentMode === 'EVEN'} onChange={() => setPaymentMode('EVEN')} />
                  <span>{t.splitEven}</span>
                </label>
                {paymentMode === 'EVEN' && (
                  <div className="flex items-center gap-2 pl-6">
                    <input
                      type="number"
                      min={1}
                      value={splitCount}
                      onChange={(e) => setSplitCount(e.target.value)}
                      placeholder={`${t.peoplePlaceholder} (${sessionState?.session.peopleCount ?? 1})`}
                      className="h-8 w-32 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="pay-mode" value="ITEMS" checked={paymentMode === 'ITEMS'} onChange={() => setPaymentMode('ITEMS')} />
                  <span>{t.paySelected}</span>
                </label>
              </div>
            </div>
            {cart.length === 0 && <div className="text-sm text-muted-foreground">{t.empty}</div>}
            {cart.map((item) => {
              const modifiersPrice = item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
              return (
                <div key={item.id} className="space-y-2 rounded-lg border p-3">
                  {paymentMode === 'ITEMS' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedItemsForPayment.has(item.id)} onChange={() => toggleItemForPayment(item.id)} />
                      <span>{t.payThis}</span>
                    </label>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{item.itemName}</div>
                    <div className="text-sm text-muted-foreground">{formatMoney(item.unitPrice, currency)}</div>
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {item.modifiers.map((m) => m.optionName).join(', ')} (+{formatMoney(modifiersPrice, currency)})
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="icon-sm" variant="outline" onClick={() => updateQty(item.id, item.qty - 1)}>
                      −
                    </Button>
                    <div className="w-8 text-center text-sm">{item.qty}</div>
                    <Button size="icon-sm" variant="outline" onClick={() => updateQty(item.id, item.qty + 1)}>
                      +
                    </Button>
                    <Button size="icon-sm" variant="destructive" aria-label={t.payThis} onClick={() => removeItem(item.id)}>
                      ×
                    </Button>
                  </div>
                </div>
              );
            })}
            {payments.length > 0 && (
              <div className="space-y-2 border-t pt-2">
                <div className="text-sm font-medium">{t.payments}</div>
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>{formatMoney(p.amount, currency)}</div>
                    <Badge variant={p.status === PaymentStatusEnum.enum.PAID ? 'default' : 'outline'}>{p.status}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span>{t.total}</span>
              <span className="font-semibold">{formatMoney(cartTotals.total, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{t.toPay}</span>
              <span className="font-semibold">{formatMoney(payableAmount, currency)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={createPayment} variant="secondary" disabled={!sessionState || !sessionToken || payableAmount <= 0 || paying}>
                {paying ? t.payingInProgress : `${t.pay} ${formatMoney(payableAmount, currency)}`}
              </Button>
              <Button onClick={submitOrder} disabled={!sessionState || !sessionToken || cart.length === 0}>
                {t.sendToKitchen}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  return (
    <div className="p-6 space-y-6 pb-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {/* <Siren className="h-4 w-4" /> */}
            {t.table}
          </div>
          <div className="text-2xl font-semibold flex items-center gap-2">
            {/* <ShoppingCart className="h-5 w-5" /> */}
            {venueSlug} / {tableCode}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          {hasSession && (
            <Badge className="rounded-full bg-primary text-primary-foreground">
              {t.connected}
            </Badge>
          )}
        </div>
      </div>

      {isOffline && (
        <Card className="border-destructive/50 bg-destructive/10 p-4">
          <div className="font-semibold">{t.offline}</div>
          <div className="text-sm text-muted-foreground">{t.offlineHint}</div>
        </Card>
      )}

      {sessionClosed && (
        <Card className="border-amber-300 bg-amber-100 p-4">
          <div className="font-semibold">{t.sessionClosed}</div>
          <div className="text-sm text-muted-foreground">
            {t.reason}: {sessionClosed}
          </div>
        </Card>
      )}

      {!hasSession ? (
        <div className="flex justify-center">
          <Card className="w-full max-w-lg space-y-4 p-6 text-center shadow-lg">
            <div className="space-y-1">
              <div className="text-xl font-semibold">{t.connectTitle}</div>
              <div className="text-sm text-muted-foreground">{t.connectHint}</div>
            </div>
            <div className="space-y-2">
              <input
                type="number"
                min={1}
                placeholder={t.peoplePlaceholder}
                value={peopleCount}
                onChange={(e) => setPeopleCount(e.target.value)}
                className="h-11 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <Button
                className="w-full h-11 text-base"
                onClick={handleJoin}
                disabled={joining || !peopleCount || Number(peopleCount) <= 0}
              >
                {joining ? '...' : t.start}
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">{t.menu}</div>
                <div className="text-xs text-muted-foreground">{t.menuHint}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 rounded-full border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                onClick={() => callWaiter(t.requestBill)}
              >
                <BellRing className="h-4 w-4" />
                {t.callWaiter}
              </Button>
            </div>
            {menu ? (
              <Tabs defaultValue={menu.categories[0]?.id}>
                <TabsList className="w-full overflow-x-auto">
                  {menu.categories.map((cat) => (
                    <TabsTrigger key={cat.id} value={cat.id}>
                      {cat.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {menu.categories.map((cat) => (
                  <TabsContent key={cat.id} value={cat.id} className="grid gap-3 sm:grid-cols-2">
                    {cat.items.map((item) => (
                      <Card key={item.id} className="space-y-2 p-4 transition-shadow hover:shadow-md">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-28 w-full rounded-md object-cover" />
                        ) : (
                          <div className="h-28 w-full rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
                        )}
                        <div className="flex items-center justify-between">
                          <div className="font-semibold flex items-center gap-2">
                            {/* {item.modifiers.length ? <Soup className="h-4 w-4" /> : <Leaf className="h-4 w-4" />} */}
                            {item.name}
                          </div>
                          <div className="text-sm text-muted-foreground">{formatMoney(item.price, currency)}</div>
                        </div>
                        {item.description && <div className="text-sm text-muted-foreground">{item.description}</div>}
                        <Button size="sm" className="w-full" onClick={() => setSelectedItem(item)}>
                          {t.add}
                        </Button>
                      </Card>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="text-sm text-muted-foreground">{t.offlineHint}</div>
            )}
          </Card>
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t.orderStatus}</div>
              <div className="text-xs text-muted-foreground">NEW → ACCEPTED → IN_PROGRESS → READY → SERVED</div>
            </div>
            <div className="space-y-2">
              {orders.length === 0 && <div className="text-sm text-muted-foreground">{t.noOrders}</div>}
              {orders.map((order) => (
                <div key={order.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {t.orderNumber} #{order.number}
                    </div>
                    {renderStatus(order.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.table}: {order.tableId}
                  </div>
                  <div className="space-y-1 text-sm">
                    {order.items.map((i) => {
                      const modSum = i.modifiers.reduce((s, m) => s + m.priceDelta, 0);
                      return (
                        <div key={i.id} className="flex justify-between">
                          <span>
                            {i.qty} × {i.itemName}
                          </span>
                          <span className="text-muted-foreground">
                            {formatMoney((i.unitPrice + modSum) * i.qty, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {cartBarVisible && (
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <div className="fixed bottom-4 left-4 right-4 z-40">
            <div className="mx-auto max-w-4xl rounded-full border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t.toPay}:{' '}
                  <span className="font-semibold text-foreground">{formatMoney(payableAmount, currency)}</span>
                </div>
                <SheetTrigger asChild>
                  <Button className="gap-2 rounded-full" type="button">
                    {t.cart} · {cartTotals.itemCount}
                  </Button>
                </SheetTrigger>
              </div>
            </div>
          </div>
        <SheetContent side="bottom" className="h-[85vh] w-full sm:w-[520px] flex flex-col gap-0">
          <SheetHeader>
            <SheetTitle>{t.cart}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 p-4">
              <div className="space-y-2 rounded-md border p-3">
                <div className="text-sm font-medium">{t.payments}</div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="pay-mode" value="FULL" checked={paymentMode === 'FULL'} onChange={() => setPaymentMode('FULL')} />
                    <span>{t.payFull}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="pay-mode" value="EVEN" checked={paymentMode === 'EVEN'} onChange={() => setPaymentMode('EVEN')} />
                    <span>{t.splitEven}</span>
                  </label>
                  {paymentMode === 'EVEN' && (
                    <div className="flex items-center gap-2 pl-6">
                      <input
                        type="number"
                        min={1}
                        value={splitCount}
                        onChange={(e) => setSplitCount(e.target.value)}
                        placeholder={`${t.peoplePlaceholder} (${sessionState?.session.peopleCount ?? 1})`}
                        className="h-8 w-32 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="pay-mode" value="ITEMS" checked={paymentMode === 'ITEMS'} onChange={() => setPaymentMode('ITEMS')} />
                    <span>{t.paySelected}</span>
                  </label>
                </div>
              </div>
              {cart.length === 0 && <div className="text-sm text-muted-foreground">{t.empty}</div>}
              {cart.map((item) => {
                const modifiersPrice = item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
                return (
                  <div key={item.id} className="space-y-2 rounded-lg border p-3">
                    {paymentMode === 'ITEMS' && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedItemsForPayment.has(item.id)} onChange={() => toggleItemForPayment(item.id)} />
                        <span>{t.payThis}</span>
                      </label>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground">{formatMoney(item.unitPrice, currency)}</div>
                    </div>
                    {item.modifiers.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {item.modifiers.map((m) => m.optionName).join(', ')} (+{formatMoney(modifiersPrice, currency)})
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="icon-sm" variant="outline" onClick={() => updateQty(item.id, item.qty - 1)}>
                        −
                      </Button>
                      <div className="w-8 text-center text-sm">{item.qty}</div>
                      <Button size="icon-sm" variant="outline" onClick={() => updateQty(item.id, item.qty + 1)}>
                        +
                      </Button>
                      <Button size="icon-sm" variant="destructive" aria-label={t.payThis} onClick={() => removeItem(item.id)}>
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
              {payments.length > 0 && (
                <div className="space-y-2 border-t pt-2">
                  <div className="text-sm font-medium">{t.payments}</div>
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div>{formatMoney(p.amount, currency)}</div>
                      <Badge variant={p.status === PaymentStatusEnum.enum.PAID ? 'default' : 'outline'}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{t.total}</span>
                <span className="font-semibold">{formatMoney(cartTotals.total, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t.toPay}</span>
                <span className="font-semibold">{formatMoney(payableAmount, currency)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={createPayment} variant="secondary" disabled={!sessionState || !sessionToken || payableAmount <= 0 || paying}>
                  {paying ? t.payingInProgress : `${t.pay} ${formatMoney(payableAmount, currency)}`}
                </Button>
                <Button onClick={submitOrder} disabled={!sessionState || !sessionToken || cart.length === 0}>
                  {t.sendToKitchen}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )}

      <Dialog open={!!selectedItem} onOpenChange={(open) => (!open ? setSelectedItem(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
            <DialogDescription>{selectedItem?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedItem?.modifiers.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{group.name}</div>
                  <div className="text-muted-foreground">
                    {group.isRequired ? t.modifiersRequired : t.modifiersOptional} · {group.minSelect}-{group.maxSelect}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => {
                    const selectedIds = selection[group.id] ?? [];
                    const checked = selectedIds.includes(opt.id);
                    return (
                      <Button
                        key={opt.id}
                        size="sm"
                        variant={checked ? 'default' : 'outline'}
                        onClick={() => handleSelectModifier(group.id, opt.id, group.maxSelect)}
                      >
                        {opt.name} {opt.priceDelta ? `(+${formatMoney(opt.priceDelta, currency)})` : ''}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.commentPlaceholder}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleAddToCart} disabled={!canAddSelectedItem}>
              {t.addToCart}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
