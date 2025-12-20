import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MenuItem } from '@qr/types';

type Props = {
  item: MenuItem;
  currency: string;
  onAdd: () => void;
  addLabel: string;
  unavailableLabel: string;
  noImageLabel: string;
  outLabel: string;
};

export function MenuItemCard({
  item,
  currency,
  onAdd,
  addLabel,
  unavailableLabel,
  noImageLabel,
  outLabel,
}: Props) {
  const priceLabel = `${(item.price / 100).toFixed(2)} ${currency}`;
  return (
    <Card className="group flex h-full flex-col gap-3 border bg-card p-4 shadow-sm transition hover:shadow-md">
      {item.imageUrl ? (
        <div className="relative h-32 w-full overflow-hidden rounded-lg bg-muted">
          <Image src={item.imageUrl} alt={item.name} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {noImageLabel}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-base font-semibold">{item.name}</div>
            {item.description && <div className="text-sm text-muted-foreground line-clamp-2">{item.description}</div>}
          </div>
          {!item.isInStock && (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              {outLabel}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-primary">{priceLabel}</div>
          <Button size="sm" onClick={onAdd} disabled={!item.isActive || !item.isInStock}>
            {item.isActive && item.isInStock ? addLabel : unavailableLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
