'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CartItem, CartTotals, Order, PaymentIntent, PaymentStatusEnum } from '@qr/types';
import { OutstandingBanner } from './OutstandingBanner';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  cart: CartItem[];
  totals: CartTotals;
  payments: PaymentIntent[];
  currency: string;
  pendingIds: Set<string>;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onSubmitOrder: () => void;
  onCreatePayment: () => void;
  submittingOrder: boolean;
  paying: boolean;
  outstandingRemaining: number;
  orders: Order[];
  paymentMode: 'FULL' | 'EVEN' | 'SELECTED';
  onPaymentModeChange: (mode: 'FULL' | 'EVEN' | 'SELECTED') => void;
  splitCount: string;
  onSplitCountChange: (value: string) => void;
  sharesToPay: string;
  onSharesToPayChange: (value: string) => void;
  itemsModeDisabled: boolean;
  tipOption: 'NONE' | '2' | '5' | '10' | 'CUSTOM';
  onTipOptionChange: (value: 'NONE' | '2' | '5' | '10' | 'CUSTOM') => void;
  customTip: string;
  onCustomTipChange: (value: string) => void;
  tipAmount: number;
  totalWithTip: number;
  selectedItemsForPayment: Set<string>;
  onToggleItemForPayment: (id: string) => void;
  payableItems: {
    id: string;
    orderId: string;
    orderNumber: number;
    amount: number;
    label: string;
    status: string;
    totalCents?: number;
    paidCents?: number;
    remainingCents?: number;
  }[];
  paymentQuote: {
    amount: number;
    currency: string;
    mode: 'FULL' | 'EVEN' | 'SELECTED';
    splitPlanId?: string;
    sharesToPay?: number;
    selectedOrderItemIds?: string[];
    breakdown?: Record<string, unknown>;
  } | null;
  quotePending: boolean;
  quoteStale: boolean;
  onRefreshQuote: () => void;
  displayAmount: number;
  quoteUpdatedAt?: number | null;
};

export function CartSheet({
  open,
  onOpenChange,
  trigger,
  cart,
  totals,
  payments,
  currency,
  pendingIds,
  onInc,
  onDec,
  onRemove,
  onSubmitOrder,
  onCreatePayment,
  submittingOrder,
  paying,
  outstandingRemaining,
  orders,
  paymentMode,
  onPaymentModeChange,
  splitCount,
  onSplitCountChange,
  sharesToPay,
  onSharesToPayChange,
  itemsModeDisabled,
  tipOption,
  onTipOptionChange,
  customTip,
  onCustomTipChange,
  tipAmount,
  totalWithTip,
  selectedItemsForPayment,
  onToggleItemForPayment,
  payableItems,
  paymentQuote,
  quotePending,
  quoteStale,
  onRefreshQuote,
  displayAmount,
  quoteUpdatedAt,
}: Props) {
  const t = useTranslations();
  const formatMoney = (cents: number) => `${(cents / 100).toFixed(2)} ${currency}`;
  const shareCosts = paymentQuote?.breakdown?.shareCosts as number[] | undefined;
  const selectedBreakdownItems =
    paymentQuote?.breakdown?.items as Array<{ label?: string; orderItemId?: string }> | undefined;
  const quoteUpdatedLabel = quoteUpdatedAt ? new Date(quoteUpdatedAt).toLocaleTimeString() : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col p-0 gap-0 sm:max-w-xl">
        <div className="space-y-3 border-b">
          <SheetHeader className="text-left">
            <SheetTitle>{t('guest.cart.title')}</SheetTitle>
            <p className="text-sm text-muted-foreground">{t('guest.cart.subtitle')}</p>
          </SheetHeader>
          <OutstandingBanner remainingCents={outstandingRemaining} currency={currency} />
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">{t('guest.cart.draftTitle')}</div>
                <Badge variant="outline">{t('guest.cart.itemsCount', { count: cart.length })}</Badge>
              </div>
              {cart.length === 0 ? (
                <Card className="border-dashed p-4 text-sm text-muted-foreground">{t('guest.cart.draftEmpty')}</Card>
              ) : (
                cart.map((item) => {
                  const disabled = pendingIds.has(item.id);
                  const modifiersPrice = item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
                  const line = (item.unitPrice + modifiersPrice) * item.qty;
                  return (
                    <Card key={item.id} className="space-y-3 border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-base font-semibold">{item.itemName}</div>
                          {item.modifiers.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {item.modifiers.map((m) => m.optionName).join(', ')} (+{formatMoney(modifiersPrice)})
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{formatMoney(line)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => onDec(item.id)}
                          aria-label={t('guest.cart.decreaseQty')}
                          title={t('guest.cart.decreaseQty')}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </Button>

                        <div className="w-8 text-center text-sm">{item.qty}</div>

                        <Button
                          size="icon-sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => onInc(item.id)}
                          aria-label={t('guest.cart.increaseQty')}
                          title={t('guest.cart.increaseQty')}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </Button>

                        <Button
                          size="icon-sm"
                          variant="default"
                          disabled={disabled}
                          onClick={() => onRemove(item.id)}
                          aria-label={t('guest.cart.removeItem')}
                          title={t('guest.cart.removeItem')}
                        >
                          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">{t('guest.cart.sentTitle')}</div>
                <Badge variant="outline">{orders.length}</Badge>
              </div>
              {orders.length === 0 ? (
                <Card className="border-dashed p-4 text-sm text-muted-foreground">{t('guest.cart.sentEmpty')}</Card>
              ) : (
                orders.map((order) => (
                  <Card key={order.id} className="space-y-3 border p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-base font-semibold">
                        {t('common.labels.order')} #{order.number}
                      </div>
                      <Badge variant="outline">{t(`status.order.${order.status}` as never)}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      {order.items.map((itm) => {
                        const modifiersPrice = itm.modifiers.reduce((s, m) => s + m.priceDelta, 0);
                        const totalCents = (itm.unitPrice + modifiersPrice) * itm.qty;
                        const remaining = itm.remainingCents ?? totalCents;
                        const paid = itm.paidCents ?? Math.max(totalCents - remaining, 0);
                        const fullyPaid = remaining <= 0;
                        return (
                          <div key={itm.id} className="flex items-center justify-between gap-3">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {itm.qty} × {itm.itemName}
                              </span>
                              {paid > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  {t('guest.orders.paidAmount', { amount: formatMoney(paid) })}
                                </span>
                              )}
                            </div>
                            <Badge variant={fullyPaid ? 'secondary' : 'outline'}>
                              {fullyPaid
                                ? t('guest.orders.paidStatus')
                                : t('guest.orders.remainingAmount', { amount: formatMoney(remaining) })}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))
              )}
            </section>

            <section className="space-y-4">
              <div className="text-base font-semibold">{t('guest.cart.paymentTitle')}</div>
              <Card className="space-y-3 border p-4">
                <div className="text-sm font-medium">{t('guest.cart.paymentModeTitle')}</div>
                <RadioGroup
                  value={paymentMode}
                  onValueChange={(val) => onPaymentModeChange(val as Props['paymentMode'])}
                  className="gap-2"
                >
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="FULL" id="pay-full-bottom" />
                      <span>{t('guest.cart.fullBill')}</span>
                    </div>
                  </label>
                  <div className="rounded-lg border px-3 py-2">
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="EVEN" id="pay-even-bottom" />
                      <span>{t('guest.cart.splitEvenly')}</span>
                    </label>
                    {paymentMode === 'EVEN' && (
                      <div className="mt-2 flex flex-col gap-2 pl-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min={2}
                            value={splitCount}
                            onChange={(e) => onSplitCountChange(e.target.value)}
                            placeholder={t('forms.placeholders.totalShares')}
                            className="h-9 w-32"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={sharesToPay}
                            onChange={(e) => onSharesToPayChange(e.target.value)}
                            placeholder={t('forms.placeholders.sharesToPay')}
                            className="h-9 w-32"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('guest.cart.splitHelp')}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="SELECTED" id="pay-items-bottom" disabled={itemsModeDisabled} />
                      <span className={itemsModeDisabled ? 'text-muted-foreground' : ''}>
                        {t('guest.cart.paySelectedItems')}
                      </span>
                    </label>
                    {paymentMode === 'SELECTED' && (
                      <div className="mt-2 space-y-2 pl-6">
                        {itemsModeDisabled ? (
                          <div className="text-sm text-muted-foreground">{t('guest.cart.addItemsFirst')}</div>
                        ) : (
                          payableItems.map((itm) => (
                            <label
                              key={itm.id}
                              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedItemsForPayment.has(itm.id)}
                                  onChange={() => onToggleItemForPayment(itm.id)}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{itm.label}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {t('common.labels.order')} #{itm.orderNumber} · {t(`status.order.${itm.status}` as never)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">{formatMoney(itm.amount)}</div>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </Card>

              <Card className="space-y-3 border p-4">
                <div className="text-sm font-medium">{t('common.labels.tip')}</div>
                <RadioGroup
                  value={tipOption}
                  onValueChange={(val) => onTipOptionChange(val as Props['tipOption'])}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <RadioGroupItem value="NONE" id="tip-none-bottom" />
                    <span>{t('guest.cart.tipNone')}</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <RadioGroupItem value="2" id="tip-2-bottom" />
                    <span>{t('guest.cart.tipPercent', { percent: 2 })}</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <RadioGroupItem value="5" id="tip-5-bottom" />
                    <span>{t('guest.cart.tipPercent', { percent: 5 })}</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <RadioGroupItem value="10" id="tip-10-bottom" />
                    <span>{t('guest.cart.tipPercent', { percent: 10 })}</span>
                  </label>
                  <div className="col-span-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-3">
                    <RadioGroupItem value="CUSTOM" id="tip-custom-bottom" />
                    <span>{t('guest.cart.tipCustom')}</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={customTip}
                      onChange={(e) => onCustomTipChange(e.target.value)}
                      placeholder={t('forms.placeholders.tipCustom')}
                      className="h-9 w-24"
                      disabled={tipOption !== 'CUSTOM'}
                    />
                  </div>
                </RadioGroup>
              </Card>

              <Card className="space-y-2 border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('guest.cart.quoteTitle')}</span>
                  <Button size="sm" variant="outline" onClick={onRefreshQuote} disabled={quotePending}>
                    {quotePending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('guest.cart.refreshQuote')}
                  </Button>
                </div>
                {paymentQuote && !quoteStale ? (
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {paymentQuote.mode === 'FULL'
                            ? t('guest.cart.fullBill')
                            : paymentQuote.mode === 'EVEN'
                              ? paymentQuote.sharesToPay
                                ? `${t('guest.cart.splitEvenly')} · ${t('guest.cart.shareCount', { count: paymentQuote.sharesToPay })}`
                                : t('guest.cart.splitEvenly')
                              : t('guest.cart.selectedItems')}
                        </div>
                        {paymentQuote.mode === 'EVEN' && shareCosts && (
                          <div className="text-sm text-muted-foreground">
                            {t('guest.cart.quoteShares', {
                              shares: shareCosts.join(' + '),
                              total: formatMoney(shareCosts.reduce((s, v) => s + v, 0)),
                            })}
                          </div>
                        )}
                        {paymentQuote.mode === 'SELECTED' && selectedBreakdownItems && (
                          <div className="text-sm text-muted-foreground">
                            {selectedBreakdownItems.map((itm) => itm.label ?? itm.orderItemId ?? '').join(', ')}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold">{formatMoney(paymentQuote.amount)}</span>
                    </div>
                    {quoteUpdatedLabel && (
                      <div className="text-sm text-muted-foreground">
                        {t('guest.cart.quoteUpdated', { time: quoteUpdatedLabel })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{t('guest.cart.quoteEmpty')}</div>
                )}
              </Card>

              {payments.length > 0 && (
                <Card className="space-y-2 border p-4">
                  <div className="text-sm font-medium">{t('common.labels.payments')}</div>
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div>{formatMoney(p.amount)}</div>
                      <Badge variant={p.status === PaymentStatusEnum.enum.PAID ? 'secondary' : 'outline'}>
                        {t(`status.payment.${p.status}` as never)}
                      </Badge>
                    </div>
                  ))}
                </Card>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{t('common.labels.items')}</span>
                  <span className="font-semibold">{formatMoney(totals.total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('common.labels.tip')}</span>
                  <span className="font-semibold">{formatMoney(tipAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>{t('common.labels.toPay')}</span>
                  <span>{formatMoney(totalWithTip)}</span>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="space-y-2 border-t bg-background px-4 py-4">
          <Button className="mr-2" onClick={onSubmitOrder} disabled={submittingOrder || cart.length === 0}>
            {submittingOrder && <Loader2 className="h-4 w-4 animate-spin" />}
            {submittingOrder ? t('guest.cart.sending') : t('common.actions.sendToKitchen')}
          </Button>
          <Button variant="secondary" onClick={onCreatePayment} disabled={paying || outstandingRemaining <= 0}>
            {paying && <Loader2 className="h-4 w-4 animate-spin" />}
            {paying
              ? t('guest.cart.processing')
              : t('guest.cart.payAmount', { amount: formatMoney(displayAmount) })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
