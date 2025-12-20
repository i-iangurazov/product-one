import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Props = {
  onCallWaiter: () => void;
  onRequestBill: () => void;
  callWaiterLabel: string;
  requestBillLabel: string;
  pending?: { callWaiter: boolean; requestBill: boolean };
  disabled?: boolean;
};

export function AssistanceActions({
  onCallWaiter,
  onRequestBill,
  callWaiterLabel,
  requestBillLabel,
  pending,
  disabled,
}: Props) {
  const callPending = pending?.callWaiter ?? false;
  const billPending = pending?.requestBill ?? false;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onCallWaiter}
        disabled={disabled || callPending}
      >
        {callPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {callWaiterLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={onRequestBill}
        disabled={disabled || billPending}
      >
        {billPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {requestBillLabel}
      </Button>
    </div>
  );
}
