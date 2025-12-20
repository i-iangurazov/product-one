import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MenuCategory, MenuItem } from '@qr/types';
import { MenuItemCard } from './MenuItemCard';
import { Search } from 'lucide-react';

type Props = {
  title: string;
  subtitle: string;
  categories: MenuCategory[];
  activeCategoryId?: string;
  onCategoryChange: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  items: MenuItem[];
  currency: string;
  loading: boolean;
  error?: string | null;
  addLabel: string;
  unavailableLabel: string;
  noImageLabel: string;
  outLabel: string;
  emptyLabel: string;
  callWaiterLabel: string;
  onAddItem: (item: MenuItem) => void;
  onCallWaiter: () => void;
};

export function MenuPanel({
  title,
  subtitle,
  categories,
  activeCategoryId,
  onCategoryChange,
  search,
  onSearchChange,
  searchPlaceholder,
  items,
  currency,
  loading,
  error,
  addLabel,
  unavailableLabel,
  noImageLabel,
  outLabel,
  emptyLabel,
  callWaiterLabel,
  onAddItem,
  onCallWaiter,
}: Props) {
  return (
    <Card className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <Tabs value={activeCategoryId} onValueChange={onCategoryChange}>
          <TabsList className="w-full justify-start gap-1 overflow-x-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="whitespace-nowrap text-sm">
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx} className="space-y-3 p-4 animate-pulse">
              <div className="h-32 w-full rounded-lg bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-9 w-full rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              currency={currency}
              onAdd={() => onAddItem(item)}
              addLabel={addLabel}
              unavailableLabel={unavailableLabel}
              noImageLabel={noImageLabel}
              outLabel={outLabel}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-3">
          <div>{error ?? emptyLabel}</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onCallWaiter}>
              {callWaiterLabel}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
