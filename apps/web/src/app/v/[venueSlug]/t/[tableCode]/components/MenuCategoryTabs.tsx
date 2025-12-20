import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { MenuCategory } from '@qr/types';

type Props = {
  categories: MenuCategory[];
  activeCategoryId?: string;
  onCategoryChange: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
};

export function MenuCategoryTabs({
  categories,
  activeCategoryId,
  onCategoryChange,
  search,
  onSearchChange,
  searchPlaceholder,
}: Props) {
  return (
    <div className="space-y-3">
      <Tabs value={activeCategoryId} onValueChange={onCategoryChange}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full justify-start overflow-x-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="whitespace-nowrap text-sm">
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full sm:w-64 text-sm"
          />
        </div>
        {categories.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} />
        ))}
      </Tabs>
    </div>
  );
}
