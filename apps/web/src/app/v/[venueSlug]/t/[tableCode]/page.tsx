'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type SessionStateWithToken,
} from '@qr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CartSheet } from './components/CartSheet';
import { OutstandingBanner } from './components/OutstandingBanner';
import { GuestHeader } from './components/GuestHeader';
import { MenuPanel } from './components/MenuPanel';
import { AssistanceActions } from './components/AssistanceActions';
import { toastApiError, toastInfo, toastSuccess } from '@/lib/toast';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/lib/useLanguage';
import type { Language } from '@/lib/i18n';
import { ensureDefaultSelection, type ModifierSelectionMap } from '@/lib/cartSelection';
import { CircleCheck, ListCheck, Pin, Soup, UtensilsCrossed, Loader2 } from 'lucide-react';

const API_HTTP = process.env.NEXT_PUBLIC_API_HTTP ?? 'http://localhost:4000';
const API_WS = process.env.NEXT_PUBLIC_API_WS ?? 'http://localhost:4000';
const isGuestDebug = process.env.NEXT_PUBLIC_GUEST_DEBUG === 'true';


function getDeviceHash() {
  if (typeof window === 'undefined') return '';
  const key = 'qr_device_hash';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const v = crypto.randomUUID();
  localStorage.setItem(key, v);
  return v;
}

type SelectionMap = ModifierSelectionMap;

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

function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function TablePage({ params }: { params: Promise<{ venueSlug: string; tableCode: string }> }) {
  const resolvedParams = use(params);
  const { venueSlug, tableCode } = resolvedParams;
  const { lang, setLang } = useLanguage();
  const t = useTranslations();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [stateVersion, setStateVersion] = useState<number>(0);
  const [lastStateTs, setLastStateTs] = useState<number>(0);
  const [lastEventTs, setLastEventTs] = useState<number>(0);
  const [lastRefetchTs, setLastRefetchTs] = useState<number>(0);
  const [lastRefetchMs, setLastRefetchMs] = useState<number>(0);

  const showDebug = process.env.NEXT_PUBLIC_REALTIME_DEBUG === 'true';
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pendingCartItemIds, setPendingCartItemIds] = useState<Set<string>>(new Set());
  const [cartTotals, setCartTotals] = useState<CartTotals>(() => ({ subtotal: 0, total: 0, itemCount: 0 }));
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<PaymentIntent[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [peopleCount, setPeopleCount] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'EVEN' | 'SELECTED'>('FULL');
  const [selectedItemsForPayment, setSelectedItemsForPayment] = useState<Set<string>>(new Set());
  const [splitCount, setSplitCount] = useState<string>('');
  const [sharesToPay, setSharesToPay] = useState<string>('1');
  const [splitPlan, setSplitPlan] = useState<{
    id: string;
    totalShares: number;
    paidShares: number;
    remainingShares: number;
    stateVersion: number;
  } | null>(null);
  const [paymentQuote, setPaymentQuote] = useState<{
    id: string;
    amount: number;
    currency: string;
    mode: 'FULL' | 'EVEN' | 'SELECTED';
    splitPlanId?: string;
    sharesToPay?: number;
    selectedOrderItemIds?: string[];
    breakdown?: Record<string, unknown>;
    stateVersion?: number;
  } | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selection, setSelection] = useState<SelectionMap>({});
  const [note, setNote] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [sessionClosed, setSessionClosed] = useState<string | null>(null);
  const [tipOption, setTipOption] = useState<'NONE' | '2' | '5' | '10' | 'CUSTOM'>('NONE');
  const [customTip, setCustomTip] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>();
  const [menuSearch, setMenuSearch] = useState('');
  const [assistancePending, setAssistancePending] = useState({ callWaiter: false, requestBill: false });
  const [addingToCart, setAddingToCart] = useState(false);
  const [refreshingState, setRefreshingState] = useState(false);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinInFlightRef = useRef(false);
  const sessionId = sessionState?.session.id;
  const sessionPeopleCount = sessionState?.session.peopleCount;
  const currency = t('common.labels.currency');

  const applyState = useCallback((data: SessionStateWithToken | SessionState) => {
    setSessionState(data);
    setCart(data.cart);
    setOrders(data.ordersActive);
    setPayments(data.payments ?? []);
    setCartTotals(computeTotals(data.cart));
    if (data.session.peopleCount) {
      setSplitCount(String(data.session.peopleCount));
    }
    setSessionClosed(null);
    const nextVersion = data.session.stateVersion ?? data.stateVersion ?? 1;
    setStateVersion((prev) => Math.max(prev, nextVersion));
    setLastStateTs(Date.now());
  }, []);

  const fetchSessionState = useCallback(async () => {
    if (!sessionId || !sessionToken) return;
    try {
      const start = performance.now();
      const res = await fetch(`${API_HTTP}/public/sessions/${sessionId}/state`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) return;
      const data: SessionState = await res.json();
      applyState(data);
      setLastRefetchTs(Date.now());
      setLastRefetchMs(Math.round(performance.now() - start));
    } catch (err) {
      console.error(err);
    }
  }, [sessionId, sessionToken, applyState]);

  const queueJoin = useCallback(() => {
    if (!socket || !sessionToken || !sessionId) return;
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = setTimeout(async () => {
      if (joinInFlightRef.current) return;
      joinInFlightRef.current = true;
      try {
        const deviceHash = getDeviceHash();
        socket.emit('session.join', {
          sessionId,
          venueSlug,
          tableCode,
          deviceHash,
          peopleCount: sessionPeopleCount,
          token: sessionToken,
        });
        await fetchSessionState();
      } finally {
        joinInFlightRef.current = false;
      }
    }, 800);
  }, [socket, sessionToken, sessionId, sessionPeopleCount, venueSlug, tableCode, fetchSessionState]);

  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    setMenuError(null);
    try {
      const res = await fetch(`${API_HTTP}/public/venues/${venueSlug}/menu`);
      if (!res.ok) {
        throw new Error(t('guest.errors.menuLoadFailed'));
      }
      const data: PublicMenuResponse = await res.json();
      setMenu(data);
    } catch (err) {
      console.error(err);
      setMenuError(t('guest.errors.menuLoadFailed'));
      toastApiError(err, t('guest.errors.menuLoadFailed'));
    } finally {
      setMenuLoading(false);
    }
  }, [venueSlug, t]);

  const handleGlobalRefresh = useCallback(async () => {
    setRefreshingState(true);
    try {
      await Promise.all([fetchSessionState(), loadMenu()]);
    } finally {
      setRefreshingState(false);
    }
  }, [fetchSessionState, loadMenu]);

  useEffect(() => {
    if (socket) return;
    const s = io(API_WS);
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    setSocket(s);
    setIsOffline(false);

    const onState = (payload: SessionState) => {
      setSessionState(payload);
      setCart(payload.cart);
      setOrders(payload.ordersActive);
      setPayments(payload.payments ?? []);
      setCartTotals(computeTotals(payload.cart));
      setSessionClosed(null);
    };

    const onCart = (payload: { cart: CartItem[]; totals: CartTotals }) => {
      setCart(payload.cart);
      setCartTotals(payload.totals);
    };

    const onOrderCreated = (payload: { order: Order }) => {
      setSubmittingOrder(false);
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === payload.order.id);
        const next = exists ? prev : [...prev, payload.order];
        const sorted = [...next].sort((a, b) => a.number - b.number);
        return sorted;
      });
      toastSuccess(t('guest.toasts.orderSent', { number: payload.order.number }));
      fetchSessionState();
    };

    const onOrderUpdated = (payload: { order: Order }) => {
      setOrders((prev) => {
        const prevOrder = prev.find((o) => o.id === payload.order.id);
        const replaced = prev.map((o) => (o.id === payload.order.id ? payload.order : o));
        const sorted = [...replaced].sort((a, b) => a.number - b.number);
        if (payload.order.status === OrderStatusEnum.enum.READY && prevOrder?.status !== OrderStatusEnum.enum.READY) {
          toastSuccess(t('guest.toasts.orderReady', { number: payload.order.number }));
        }
        return sorted;
      });
    };

    const onError = (err: { code: string; message: string }) => {
      toastApiError(err, t('errors.generic'));
    };

    const onPaymentUpdated = (payload: { payment: PaymentIntent }) => {
      setPayments((prev) => {
        const existing = prev.find((p) => p.id === payload.payment.id);
        if (!existing) return [...prev, payload.payment];
        return prev.map((p) => (p.id === payload.payment.id ? payload.payment : p));
      });
      if (payload.payment.status === PaymentStatusEnum.enum.PAID) {
        toastSuccess(t('guest.toasts.paymentConfirmed'));
      }
      fetchSessionState();
    };

    const onTableStateChanged = (payload: { sessionId: string; reason?: string }) => {
      if (payload.sessionId !== sessionId) return;
      if (isGuestDebug) {
        console.log('table.stateChanged', payload);
      }
      setLastEventTs(Date.now());
      fetchSessionState();
    };

    const onDisconnected = () => {
      setIsOffline(true);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      reconnectTimer = null;
    };

    const onConnected = () => {
      setIsOffline(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        queueJoin();
        fetchSessionState();
      }, 400);
    };

    const onSessionClosed = (payload: { sessionId: string; reason?: string }) => {
      setSessionClosed(payload.reason ?? t('guest.sessionClosed.defaultReason'));
      setSessionToken(null);
    };

    const onAssistanceRequested = (payload: { message?: string; deviceHash?: string }) => {
      const description = payload.message ?? t('common.actions.callWaiter');
      if (description === t('common.actions.requestBill')) {
        toastSuccess(t('guest.toasts.waiterNotified'), { description, duration: 2000, id: 'waiter-request' });
      }
    };

    s.on('session.state', onState);
    s.on('cart.updated', onCart);
    s.on('order.created', onOrderCreated);
    s.on('order.updated', onOrderUpdated);
    s.on('table.stateChanged', onTableStateChanged);
    s.on('error', onError);
    s.on('payment.updated', onPaymentUpdated);
    s.on('disconnect', onDisconnected);
    s.on('connect', onConnected);
    s.on('session.closed', onSessionClosed);
    s.on('table.assistanceRequested', onAssistanceRequested);

    return () => {
      s.off('session.state', onState);
      s.off('cart.updated', onCart);
      s.off('order.created', onOrderCreated);
      s.off('order.updated', onOrderUpdated);
      s.off('table.stateChanged', onTableStateChanged);
      s.off('error', onError);
      s.off('payment.updated', onPaymentUpdated);
      s.off('disconnect', onDisconnected);
      s.off('connect', onConnected);
      s.off('session.closed', onSessionClosed);
      s.off('table.assistanceRequested', onAssistanceRequested);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
      s.disconnect();
    };
  }, [
    socket,
    tableCode,
    venueSlug,
    sessionToken,
    sessionId,
    sessionPeopleCount,
    fetchSessionState,
    t,
    loadMenu,
    queueJoin,
  ]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    if (!menu || activeCategoryId) return;
    if (menu.categories.length > 0) {
      setActiveCategoryId(menu.categories[0].id);
    }
  }, [menu, activeCategoryId]);

  useEffect(() => {
    if (!selectedItem) return;
    setSelection((prev) => ensureDefaultSelection(selectedItem, prev));
  }, [selectedItem]);

  useEffect(() => {
    queueJoin();
  }, [queueJoin]);

  useEffect(() => {
    if (!isOffline) return;
    const id = setInterval(() => {
      fetchSessionState();
    }, 8000);
    return () => clearInterval(id);
  }, [isOffline, fetchSessionState]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!sessionId || !sessionToken) return;
      // If we haven't seen a state event in 10s, refetch
      if (Date.now() - Math.max(lastEventTs, lastStateTs) > 10_000) {
        fetchSessionState();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [sessionId, sessionToken, lastEventTs, lastStateTs, fetchSessionState]);

  useEffect(() => {
    if (!socket || !sessionToken || !sessionId) return;
    const deviceHash = getDeviceHash();
    const id = setInterval(() => {
      socket.emit('guest.ping', { sessionId, deviceHash, token: sessionToken });
    }, 15000);
    return () => clearInterval(id);
  }, [socket, sessionToken, sessionId]);

  const joinSession = useCallback(
    async (count?: number) => {
      const countNum = Number(count ?? peopleCount);
      if (!countNum || countNum <= 0) {
        throw new Error(t('forms.validation.peopleCountRequired'));
      }
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
      if (!res.ok) {
        throw new Error(t('guest.errors.joinSessionFailed'));
      }
      const data: JoinSessionResponse = await res.json();
      if (isGuestDebug) console.log('session.join response', data);
      setSessionToken(data.token);
      applyState(data);
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
      return data;
    },
    [peopleCount, tableCode, venueSlug, socket, t, applyState]
  );

  const handleJoin = async () => {
    setJoining(true);
    try {
      await joinSession();
      toastSuccess(t('common.states.connected'));
    } catch (err) {
      console.error(err);
      toastApiError(err, t('errors.offline'));
    } finally {
      setJoining(false);
    }
  };

  const ensureSessionReady = useCallback(async () => {
    if (sessionState?.session?.id && sessionToken) {
      return { sessionId: sessionState.session.id, token: sessionToken };
    }
    try {
      const data = await joinSession();
      applyState(data);
      return { sessionId: data.sessionId, token: data.token };
    } catch {
      toastApiError(t('errors.offline'), t('errors.offline'));
      return null;
    }
  }, [applyState, joinSession, sessionState?.session?.id, sessionToken, t]);

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

  const outstandingBase = useMemo(() => {
    if (sessionState?.outstanding?.base !== undefined) return sessionState.outstanding.base;
    return computeOrdersTotal(orders);
  }, [sessionState?.outstanding?.base, orders]);

  const payableOrderItems = useMemo(() => {
    const list: {
      id: string;
      orderId: string;
      orderNumber: number;
      amount: number;
      label: string;
      status: OrderStatus;
      totalCents: number;
      paidCents: number;
      remainingCents: number;
    }[] = [];
    orders.forEach((order) => {
      if (order.status === OrderStatusEnum.enum.CANCELLED) return;
      order.items.forEach((itm) => {
        const modSum = itm.modifiers.reduce((m, mod) => m + mod.priceDelta, 0);
        const totalCents = (itm.unitPrice + modSum) * itm.qty;
        const remainingCents = itm.remainingCents ?? totalCents;
        if (remainingCents <= 0) return;
        list.push({
          id: itm.id,
          orderId: order.id,
          orderNumber: order.number,
          amount: remainingCents,
          label: `${itm.itemName} ×${itm.qty}`,
          status: order.status,
          totalCents,
          paidCents: itm.paidCents ?? Math.max(totalCents - remainingCents, 0),
          remainingCents,
        });
      });
    });
    return list;
  }, [orders]);

  const paidBase = useMemo(() => {
    if (sessionState?.outstanding?.paid !== undefined) return sessionState.outstanding.paid;
    return 0;
  }, [sessionState?.outstanding?.paid]);

  const outstandingRemaining = useMemo(
    () => sessionState?.outstanding?.remaining ?? Math.max(outstandingBase - paidBase, 0),
    [sessionState?.outstanding?.remaining, outstandingBase, paidBase]
  );

  const payableAmount = outstandingRemaining;

  const filteredCategories = useMemo(() => {
    if (!menu) return [];
    const term = menuSearch.toLowerCase().trim();
    return menu.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          const text = `${item.name} ${item.description ?? ''}`.toLowerCase();
          return term ? text.includes(term) : true;
        }),
      }))
      .filter((cat) => cat.items.length > 0 || cat.id === activeCategoryId);
  }, [menu, menuSearch, activeCategoryId]);

  const activeCategory = filteredCategories.find((c) => c.id === activeCategoryId) ?? filteredCategories[0];
  const menuItems = activeCategory?.items ?? [];

  useEffect(() => {
    if (!filteredCategories.length) return;
    if (!activeCategoryId || !filteredCategories.some((cat) => cat.id === activeCategoryId)) {
      setActiveCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, activeCategoryId]);

  useEffect(() => {
    if (paymentMode === 'SELECTED' && payableOrderItems.length === 0) {
      setPaymentMode('FULL');
      setSelectedItemsForPayment(new Set());
    }
  }, [paymentMode, payableOrderItems.length]);

  const withCartPending = async (cartItemId: string, action: () => Promise<void>) => {
    setPendingCartItemIds((prev) => new Set(prev).add(cartItemId));
    try {
      await action();
    } finally {
      setPendingCartItemIds((prev) => {
        const next = new Set(prev);
        next.delete(cartItemId);
        return next;
      });
    }
  };

  const handleAddToCart = async () => {
    if (!selectedItem || addingToCart) return;
    const ensured = await ensureSessionReady();
    if (!socket || !ensured) {
      toastApiError(t('errors.offline'), t('errors.offline'));
      return;
    }
    if (!canAddSelectedItem) {
      toastApiError(t('guest.errors.modifiersRequired'), t('errors.generic'));
      return;
    }
    setAddingToCart(true);
    try {
      const res = await fetch(`${API_HTTP}/public/sessions/${ensured.sessionId}/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ensured.token}`,
        },
        body: JSON.stringify({
          menuItemId: selectedItem.id,
          qty: 1,
          modifiers: selectedModifiers,
          note: note || undefined,
          token: ensured.token,
        }),
      });
      if (!res.ok) {
        throw new Error(t('guest.errors.addToCartFailed'));
      }
      const data = await res.json();
      if (data.state) {
        applyState(data.state);
      } else {
        setCart(data.cart ?? []);
        setCartTotals(data.totals ?? computeTotals([]));
      }
      toastSuccess(t('guest.toasts.addedToCart'));
      if (isGuestDebug) {
        console.log('cart.addItem', {
          sessionId: ensured.sessionId,
          menuItemId: selectedItem.id,
          modifiers: selectedModifiers,
          cartSize: data.cart?.length ?? data.state?.cart?.length,
        });
      }
    } catch (err) {
      toastApiError(err, t('errors.generic'));
    } finally {
      setAddingToCart(false);
    }
    setSelectedItem(null);
    setSelection({});
    setNote('');
  };

  const updateQty = async (cartItemId: string, qty: number) => {
    if (qty <= 0) return removeItem(cartItemId);
    const ensured = await ensureSessionReady();
    if (!ensured) {
      toastApiError(t('errors.offline'), t('errors.offline'));
      return;
    }
    await withCartPending(cartItemId, async () => {
      try {
        const res = await fetch(`${API_HTTP}/public/sessions/${ensured.sessionId}/cart/items/${cartItemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ensured.token}`,
          },
          body: JSON.stringify({ qty, token: ensured.token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(t('guest.errors.updateCartFailed'));
        }
        if (data.state) {
          applyState(data.state);
        } else {
          setCart(data.cart ?? []);
          setCartTotals(data.totals ?? computeTotals([]));
        }
      } catch (err) {
        toastApiError(err, t('errors.generic'));
      }
    });
  };

  const removeItem = async (cartItemId: string) => {
    const ensured = await ensureSessionReady();
    if (!ensured) {
      toastApiError(t('errors.offline'), t('errors.offline'));
      return;
    }
    await withCartPending(cartItemId, async () => {
      try {
        const res = await fetch(`${API_HTTP}/public/sessions/${ensured.sessionId}/cart/items/${cartItemId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${ensured.token}`,
          },
          body: JSON.stringify({ token: ensured.token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(t('guest.errors.removeItemFailed'));
        }
        if (data.state) {
          applyState(data.state);
        } else {
          setCart(data.cart ?? []);
          setCartTotals(data.totals ?? computeTotals([]));
        }
      } catch (err) {
        toastApiError(err, t('errors.generic'));
      }
    });
  };

  const submitOrder = async () => {
    if (submittingOrder) return;
    const ensured = await ensureSessionReady();
    if (!ensured) {
      toastApiError(t('errors.offline'), t('errors.offline'));
      return;
    }
    setSubmittingOrder(true);
    try {
      const res = await fetch(`${API_HTTP}/public/sessions/${ensured.sessionId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ensured.token}`,
        },
        body: JSON.stringify({
          sessionId: ensured.sessionId,
          clientOrderKey: crypto.randomUUID(),
          token: ensured.token,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (!data?.order && !data?.state)) {
        throw new Error(t('guest.errors.submitOrderFailed'));
      }
      if (data.state) {
        applyState(data.state);
      } else {
        setCart([]);
        setCartTotals({ subtotal: 0, total: 0, itemCount: 0 });
      }
      toastSuccess(t('guest.toasts.orderSent', { number: data.order.number }));
      if (isGuestDebug) console.log('order.submit', { orderId: data.order.id, number: data.order.number });
    } catch (err) {
      toastApiError(err, t('errors.generic'));
    } finally {
      setSubmittingOrder(false);
    }
  };

  const requestAssistance = async (message: string, key: 'callWaiter' | 'requestBill') => {
    const ensured = await ensureSessionReady();
    if (!ensured) return;
    setAssistancePending((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${API_HTTP}/public/sessions/${ensured.sessionId}/assistance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ensured.token}`,
        },
        body: JSON.stringify({
          message,
          deviceHash: getDeviceHash(),
          token: ensured.token,
        }),
      });
      if (!res.ok) {
        throw new Error(t('guest.errors.notifyStaffFailed'));
      }
      toastSuccess(t('guest.toasts.waiterNotified'), { description: message, id: 'waiter-request' });
      if (isGuestDebug) console.log('callWaiter', { sessionId: ensured.sessionId, message });
    } catch (err) {
      toastApiError(err, t('errors.offline'));
    } finally {
      setAssistancePending((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleCallWaiter = () => requestAssistance(t('common.actions.callWaiter'), 'callWaiter');
  const handleRequestBill = () => requestAssistance(t('common.actions.requestBill'), 'requestBill');

  const toggleItemForPayment = (id: string) => {
    setSelectedItemsForPayment((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refreshQuote = useCallback(async () => {
    if (!sessionState || !sessionToken) {
      toastApiError(t('errors.offline'), t('errors.offline'));
      return null;
    }
    if (outstandingRemaining <= 0) {
      toastInfo(t('guest.payment.nothingToPay'));
      return null;
    }
    const stateVersion = sessionState.session.stateVersion ?? sessionState.stateVersion ?? 1;
    let splitPlanId = paymentQuote?.splitPlanId ?? splitPlan?.id;
    if (paymentMode === 'EVEN') {
      const totalShares = Number(splitCount) > 0 ? Number(splitCount) : sessionState.session.peopleCount ?? 2;
      if (!totalShares || totalShares < 2) {
        toastApiError(t('forms.validation.totalSharesRequired'), t('forms.validation.totalSharesRequired'));
        return null;
      }
      try {
        const planRes = await fetch(`${API_HTTP}/public/sessions/${sessionState.session.id}/payments/split-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ totalShares, token: sessionToken }),
        });
        const planData = await planRes.json().catch(() => null);
        if (!planRes.ok) {
          throw new Error(t('guest.errors.splitPlanFailed'));
        }
        setSplitPlan({
          id: planData.splitPlanId,
          totalShares: planData.totalShares,
          paidShares: planData.paidShares ?? 0,
          remainingShares: planData.remainingShares ?? planData.totalShares,
          stateVersion: planData.stateVersion ?? stateVersion,
        });
        splitPlanId = planData.splitPlanId;
      } catch (err) {
        toastApiError(err, t('guest.errors.paymentCreateFailed'));
        return null;
      }
    }
    const selectedIds = paymentMode === 'SELECTED' ? Array.from(selectedItemsForPayment) : undefined;
    if (paymentMode === 'SELECTED' && (!selectedIds || selectedIds.length === 0)) {
      toastApiError(t('guest.payment.selectItemsRequired'), t('guest.payment.selectItemsRequired'));
      return null;
    }
    const sharesToPayNumber = paymentMode === 'EVEN' ? Math.max(Number(sharesToPay) || 1, 1) : undefined;
    const tipPercent =
      tipOption === 'CUSTOM' || tipOption === 'NONE' ? undefined : (Number(tipOption) as number | undefined);
    const tipCents =
      tipOption === 'CUSTOM'
        ? Math.max(Math.round((Number(customTip) || 0) * 100), 0)
        : tipOption === 'NONE'
          ? 0
          : undefined;
    setQuotePending(true);
    try {
      const quoteRes = await fetch(`${API_HTTP}/public/sessions/${sessionState.session.id}/payments/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          mode: paymentMode,
          stateVersion,
          splitPlanId,
          sharesToPay: sharesToPayNumber,
          selectedOrderItemIds: selectedIds,
          tipPercent,
          tipCents,
        }),
      });
      const quoteData = await quoteRes.json().catch(() => null);
      if (!quoteRes.ok) {
        if (quoteData?.code === 'STALE_STATE') {
          if (quoteData.state) applyState(quoteData.state);
          toastInfo(t('guest.toasts.paymentQuoteUpdated'), { description: t('guest.payment.stateChanged') });
        } else if (quoteData?.code === 'ITEMS_ALREADY_PAID') {
          if (quoteData.state) applyState(quoteData.state);
          setSelectedItemsForPayment(new Set());
          toastInfo(t('guest.toasts.paymentQuoteUpdated'), { description: t('guest.payment.itemsAlreadyPaid') });
        } else {
          toastApiError(quoteData ?? quoteRes.statusText, t('guest.errors.paymentCreateFailed'));
        }
        return null;
      }
      const nextQuote = {
        id: quoteData.quoteId,
        amount: quoteData.amount,
        currency: quoteData.currency ?? currency,
        mode: quoteData.mode as 'FULL' | 'EVEN' | 'SELECTED',
        splitPlanId: quoteData.splitPlanId ?? splitPlanId,
        sharesToPay: quoteData.sharesToPay ?? sharesToPayNumber,
        selectedOrderItemIds: quoteData.selectedOrderItemIds,
        breakdown: quoteData.breakdown,
        stateVersion: quoteData.stateVersion,
      };
      setPaymentQuote(nextQuote);
      setQuoteUpdatedAt(Date.now());
      return nextQuote;
    } catch (err) {
      toastApiError(err, t('guest.errors.paymentCreateFailed'));
      return null;
    } finally {
      setQuotePending(false);
    }
  }, [
    applyState,
    currency,
    customTip,
    outstandingRemaining,
    paymentMode,
    paymentQuote?.splitPlanId,
    selectedItemsForPayment,
    sessionState,
    sessionToken,
    sharesToPay,
    splitCount,
    splitPlan?.id,
    t,
    tipOption,
  ]);

  const createPayment = async () => {
    if (!sessionState || !sessionToken) {
      toastApiError(t('errors.offline'), t('errors.offline'));
      return;
    }
    if (outstandingRemaining <= 0) {
      toastInfo(t('guest.payment.nothingToPay'));
      return;
    }
    let quoteToUse = paymentQuote;
    if (quoteStale || !paymentQuote) {
      const refreshed = await refreshQuote();
      if (!refreshed) return;
      quoteToUse = refreshed;
    }
    if (!quoteToUse) {
      toastApiError(t('guest.errors.paymentCreateFailed'), t('guest.errors.paymentCreateFailed'));
      return;
    }
    setPaying(true);
    const attemptKey = crypto.randomUUID();
    try {
      const res = await fetch(`${API_HTTP}/public/sessions/${sessionState.session.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
          'Idempotency-Key': attemptKey,
        },
        body: JSON.stringify({
          sessionId: sessionState.session.id,
          quoteId: quoteToUse?.id,
          paidByDeviceHash: getDeviceHash(),
          token: sessionToken,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409 && body?.state) {
          applyState(body.state);
          toastInfo(t('guest.toasts.paymentQuoteUpdated'), { description: t('guest.payment.stateChanged') });
        }
        throw new Error(t('guest.errors.paymentCreateFailed'));
      }
      const data: PaymentCreateResponse = await res.json();
      setPayments((prev) => {
        const exists = prev.find((p) => p.id === data.payment.id);
        if (exists) return prev.map((p) => (p.id === data.payment.id ? data.payment : p));
        return [...prev, data.payment];
      });
      toastSuccess(t('guest.toasts.paymentCreated', { amount: formatMoney(data.payment.amount, currency) }));
      setPaymentQuote(null);
      setQuoteUpdatedAt(null);
      fetchSessionState();
    } catch (err) {
      toastApiError(err, t('guest.errors.paymentCreateFailed'));
    } finally {
      setPaying(false);
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
      <Badge variant="outline" className={`flex items-center gap-1 ${statusClasses[status] ?? ''}`}>
        {icon}
        {t(`status.order.${status}` as never)}
      </Badge>
    );
  };

  const hasSession = !!sessionState && !!sessionToken;
  const cartBarVisible = hasSession;
  const itemsModeDisabled = payableOrderItems.length === 0;

  useEffect(() => {
    setPaymentQuote(null);
    setQuoteUpdatedAt(null);
  }, [stateVersion]);

  useEffect(() => {
    setSelectedItemsForPayment((prev) => {
      const allowed = new Set(payableOrderItems.map((p) => p.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [payableOrderItems]);

  const quoteStale = useMemo(() => {
    if (!paymentQuote || !sessionState) return true;
    if (paymentQuote.mode !== paymentMode) return true;
    if ((paymentQuote.stateVersion ?? 0) !== (sessionState.session.stateVersion ?? sessionState.stateVersion ?? 0)) return true;
    if (paymentMode === 'EVEN') {
      const desiredShares = Math.max(Number(sharesToPay) || 1, 1);
      if ((paymentQuote.sharesToPay ?? 1) !== desiredShares) return true;
      const planId = splitPlan?.id ?? paymentQuote.splitPlanId;
      if (paymentQuote.splitPlanId && planId && paymentQuote.splitPlanId !== planId) return true;
    }
    if (paymentMode === 'SELECTED') {
      const currentItems = Array.from(selectedItemsForPayment).sort().join('|');
      const quotedItems = (paymentQuote.selectedOrderItemIds ?? []).slice().sort().join('|');
      if (currentItems !== quotedItems) return true;
    }
    const quoteTip = paymentQuote.breakdown?.tipCents ?? 0;
    const desiredTipPercent = tipOption === 'CUSTOM' || tipOption === 'NONE' ? undefined : Number(tipOption);
    const desiredTipCents =
      tipOption === 'CUSTOM'
        ? Math.max(Math.round((Number(customTip) || 0) * 100), 0)
        : tipOption === 'NONE'
          ? 0
          : undefined;
    if (desiredTipPercent !== undefined && paymentQuote.breakdown?.tipPercent !== desiredTipPercent) return true;
    if (desiredTipCents !== undefined && quoteTip !== desiredTipCents) return true;
    return false;
  }, [paymentQuote, paymentMode, sessionState, sharesToPay, splitPlan?.id, selectedItemsForPayment, tipOption, customTip]);

  useEffect(() => {
    if (!isCartOpen) return;
    if (!paymentQuote) return;
    if (!quoteStale) return;
    if (quotePending) return;
    const timer = setTimeout(() => {
      refreshQuote();
    }, 300);
    return () => clearTimeout(timer);
  }, [isCartOpen, paymentQuote, quoteStale, refreshQuote, quotePending]);

  const quoteAmount = !quoteStale && paymentQuote ? paymentQuote.amount : undefined;
  const quoteBaseAmount =
    !quoteStale && paymentQuote
      ? ((paymentQuote.breakdown?.baseAmount as number | undefined) ?? paymentQuote.amount)
      : payableAmount;
  const quotedTip = !quoteStale && paymentQuote ? (paymentQuote.breakdown?.tipCents as number | undefined) : undefined;

  const tipAmount = useMemo(() => {
    if (quotedTip !== undefined) return quotedTip;
    if (tipOption === 'NONE') return 0;
    if (tipOption === 'CUSTOM') {
      const value = Number(customTip);
      if (!value || value < 0) return 0;
      return Math.round(value * 100);
    }
    const percent = Number(tipOption);
    return Math.max(Math.round((quoteBaseAmount * percent) / 100), 0);
  }, [quotedTip, tipOption, customTip, quoteBaseAmount]);

  const totalWithTip = (quoteAmount ?? quoteBaseAmount) + tipAmount;
  const displayAmount = quoteAmount ?? quoteBaseAmount + tipAmount;
  const venueName = menu?.venue.name ?? venueSlug;

  const statusTone = useMemo<'ordering' | 'preparing' | 'served' | 'outstanding'>(() => {
    if (outstandingRemaining > 0) return 'outstanding';
    if (orders.length === 0) return 'ordering';
    const hasActive = orders.some(
      (order) =>
        order.status !== OrderStatusEnum.enum.SERVED &&
        order.status !== OrderStatusEnum.enum.CANCELLED
    );
    return hasActive ? 'preparing' : 'served';
  }, [orders, outstandingRemaining]);

  const statusLabel =
    statusTone === 'ordering'
      ? t('status.guest.ordering')
      : statusTone === 'preparing'
        ? t('status.guest.preparing')
        : statusTone === 'served'
          ? t('status.guest.served')
          : t('status.guest.outstanding');
  const languageOptions = useMemo(
    () => [
      { value: 'en', label: t('common.language.options.en') },
      { value: 'ru', label: t('common.language.options.ru') },
      { value: 'kg', label: t('common.language.options.kg') },
    ],
    [t]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-28 pt-6">
        {showDebug && (
          <div className="fixed bottom-4 right-4 z-50 rounded-md border bg-white px-3 py-2 text-xs shadow">
            <div>
              {t('guest.debug.socket')}: {socket ? (socket.connected ? t('guest.debug.connected') : t('guest.debug.disconnected')) : t('guest.debug.none')}
            </div>
            <div>
              {t('guest.debug.session')}: {sessionId ?? t('common.states.notAvailable')}
            </div>
            <div>
              {t('guest.debug.stateVersion')}: {stateVersion}
            </div>
            <div>
              {t('guest.debug.lastEvent')}: {lastEventTs ? new Date(lastEventTs).toLocaleTimeString() : t('common.states.notAvailable')}
            </div>
            <div>
              {t('guest.debug.lastState')}: {lastStateTs ? new Date(lastStateTs).toLocaleTimeString() : t('common.states.notAvailable')}
            </div>
            <div>
              {t('guest.debug.lastRefetch')}:{' '}
              {lastRefetchTs
                ? `${new Date(lastRefetchTs).toLocaleTimeString()} (${lastRefetchMs}ms)`
                : t('common.states.notAvailable')}
            </div>
          </div>
        )}

        <GuestHeader
          venueName={venueName}
          tableCode={tableCode}
          tableLabel={t('common.labels.table')}
          statusLabel={statusLabel}
          statusTone={statusTone}
          lang={lang}
          onLangChange={(val) => setLang(val as Language)}
          connected={hasSession}
          connectedLabel={t('common.states.connected')}
          onRefresh={handleGlobalRefresh}
          refreshLabel={t('common.actions.refresh')}
          refreshing={refreshingState}
          languageLabel={t('common.language.label')}
          languageOptions={languageOptions}
        />

        {isOffline && (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <div className="text-base font-semibold">{t('errors.offline')}</div>
            <div className="text-sm text-muted-foreground">{t('errors.offlineHint')}</div>
          </Card>
        )}

        {sessionClosed && (
          <Card className="border-warnTint/80 bg-warnTint/40 p-4">
            <div className="text-base font-semibold">{t('guest.sessionClosed.title')}</div>
            <div className="text-sm text-muted-foreground">
              {t('common.labels.reason')}: {sessionClosed}
            </div>
          </Card>
        )}

        {!hasSession ? (
          <div className="flex justify-center">
            <Card className="w-full max-w-lg space-y-4 border bg-background p-6 text-center shadow-sm">
              <div className="space-y-1">
                <div className="text-xl font-semibold">{t('guest.connect.title')}</div>
                <div className="text-sm text-muted-foreground">{t('guest.connect.hint')}</div>
              </div>
              <div className="space-y-2">
                <Input
                  type="number"
                  min={1}
                  placeholder={t('forms.placeholders.peopleCount')}
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(e.target.value)}
                  className="h-11 text-base"
                />
                <Button
                  className="h-11 w-full text-base"
                  onClick={handleJoin}
                  disabled={joining || !peopleCount || Number(peopleCount) <= 0}
                >
                  {joining ? t('common.states.loading') : t('common.actions.start')}
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="space-y-4 p-4 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{t('common.labels.table')}</div>
                  <div className="text-xl font-semibold">
                    {venueName} · {tableCode}
                  </div>
                </div>
              </div>
              <OutstandingBanner remainingCents={outstandingRemaining} currency={currency} />
              <AssistanceActions
                onCallWaiter={handleCallWaiter}
                onRequestBill={handleRequestBill}
                callWaiterLabel={t('common.actions.callWaiter')}
                requestBillLabel={t('common.actions.requestBill')}
                pending={assistancePending}
              />
            </Card>

            <MenuPanel
              title={t('common.labels.menu')}
              subtitle={t('guest.menu.subtitle')}
              categories={filteredCategories}
              activeCategoryId={activeCategoryId}
              onCategoryChange={(id) => setActiveCategoryId(id)}
              search={menuSearch}
              onSearchChange={setMenuSearch}
              searchPlaceholder={t('forms.placeholders.searchMenu')}
              items={menuItems}
              currency={currency}
              loading={menuLoading}
              error={menuError}
              addLabel={t('common.actions.add')}
              unavailableLabel={t('common.states.unavailable')}
              noImageLabel={t('common.states.noImage')}
              outLabel={t('common.states.outOfStock')}
              emptyLabel={t('common.states.empty')}
              callWaiterLabel={t('common.actions.callWaiter')}
              onAddItem={(item) => {
                setSelectedItem(item);
                setSelection(ensureDefaultSelection(item, {}));
                setNote('');
              }}
              onCallWaiter={handleCallWaiter}
            />

            <Card className="space-y-4 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{t('guest.orders.title')}</div>
                  <div className="text-sm text-muted-foreground">{t('guest.orders.subtitle')}</div>
                </div>
                <Badge variant="outline">{orders.length}</Badge>
              </div>
              {orders.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
                  <div>{t('guest.orders.empty')}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-semibold">
                          {t('common.labels.order')} #{order.number}
                        </div>
                        {renderStatus(order.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t('common.labels.table')}: {order.tableId}
                      </div>
                      <div className="space-y-2 text-sm">
                        {order.items.map((i) => {
                          const modSum = i.modifiers.reduce((s, m) => s + m.priceDelta, 0);
                          const totalCents = (i.unitPrice + modSum) * i.qty;
                          const remaining = i.remainingCents ?? totalCents;
                          const paid = i.paidCents ?? Math.max(totalCents - remaining, 0);
                          const fullyPaid = remaining <= 0;
                          return (
                            <div key={i.id} className="flex items-center justify-between gap-3">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {i.qty} × {i.itemName}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {formatMoney(totalCents, currency)}
                                </span>
                                {paid > 0 && (
                                  <span className="text-sm text-muted-foreground">
                                    {t('guest.orders.paidAmount', { amount: formatMoney(paid, currency) })}
                                  </span>
                                )}
                              </div>
                              <Badge variant={fullyPaid ? 'secondary' : 'outline'}>
                                {fullyPaid
                                  ? t('guest.orders.paidStatus')
                                  : t('guest.orders.remainingAmount', { amount: formatMoney(remaining, currency) })}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {cartBarVisible && (
          <div className="fixed bottom-4 left-4 right-4 z-40">
            <div className="mx-auto max-w-4xl rounded-lg border bg-background/95 px-4 py-3 shadow-md backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t('common.labels.toPay')}:{' '}
                  <span className="font-semibold text-foreground">{formatMoney(outstandingRemaining, currency)}</span>
                </div>
                <CartSheet
                  open={isCartOpen}
                  onOpenChange={setIsCartOpen}
                  trigger={
                    <Button className="gap-2 rounded-full" type="button">
                      {t('common.labels.cart')} · {cartTotals.itemCount}
                    </Button>
                  }
                  cart={cart}
                  totals={cartTotals}
                  payments={payments}
                  currency={currency}
                  pendingIds={pendingCartItemIds}
                  onInc={(id) => updateQty(id, (cart.find((c) => c.id === id)?.qty ?? 1) + 1)}
                  onDec={(id) => updateQty(id, (cart.find((c) => c.id === id)?.qty ?? 1) - 1)}
                  onRemove={removeItem}
                  onSubmitOrder={submitOrder}
                  onCreatePayment={createPayment}
                  submittingOrder={submittingOrder}
                  paying={paying}
                  outstandingRemaining={outstandingRemaining}
                  orders={orders}
                  paymentMode={paymentMode}
                  onPaymentModeChange={(mode) => {
                    if (mode === 'SELECTED' && itemsModeDisabled) return;
                    setPaymentMode(mode);
                  }}
                  splitCount={splitCount}
                  onSplitCountChange={setSplitCount}
                  sharesToPay={sharesToPay}
                  onSharesToPayChange={setSharesToPay}
                  itemsModeDisabled={itemsModeDisabled}
                  tipOption={tipOption}
                  onTipOptionChange={setTipOption}
                  customTip={customTip}
                  onCustomTipChange={setCustomTip}
                  tipAmount={tipAmount}
                  totalWithTip={totalWithTip}
                  selectedItemsForPayment={selectedItemsForPayment}
                  onToggleItemForPayment={toggleItemForPayment}
                  payableItems={payableOrderItems}
                  paymentQuote={paymentQuote}
                  quotePending={quotePending}
                  quoteStale={quoteStale}
                  onRefreshQuote={refreshQuote}
                  displayAmount={displayAmount}
                  quoteUpdatedAt={quoteUpdatedAt}
                />
              </div>
            </div>
          </div>
        )}

        <Dialog open={!!selectedItem} onOpenChange={(open) => (!open ? setSelectedItem(null) : undefined)}>
          <DialogContent className="sm:max-w-lg">
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
                      {group.isRequired ? t('guest.menu.modifiersRequired') : t('guest.menu.modifiersOptional')} · {group.minSelect}-{group.maxSelect}
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
                placeholder={t('forms.placeholders.comment')}
                className="min-h-[96px] w-full rounded-md border px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleAddToCart} disabled={!canAddSelectedItem || addingToCart}>
                {addingToCart && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('common.actions.addToCart')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
