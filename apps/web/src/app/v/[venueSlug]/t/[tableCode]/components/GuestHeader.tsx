import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Language } from '@/lib/i18n';
import { Loader2, RefreshCcw } from 'lucide-react';

type StatusTone = 'ordering' | 'preparing' | 'served' | 'outstanding';

type Props = {
  venueName: string;
  tableCode: string;
  tableLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  lang: Language;
  onLangChange: (lang: Language) => void;
  connected?: boolean;
  connectedLabel: string;
  onRefresh?: () => void;
  refreshLabel: string;
  refreshing?: boolean;
  languageLabel: string;
  languageOptions: Array<{ value: Language; label: string }>;
};

const statusClasses: Record<StatusTone, string> = {
  ordering: 'border-brandTint/60 bg-brandTint/30 text-foreground',
  preparing: 'border-warnTint/70 bg-warnTint/40 text-foreground',
  served: 'border-border bg-muted text-muted-foreground',
  outstanding: 'border-destructive/40 bg-warnTint/60 text-destructive',
};

export function GuestHeader({
  venueName,
  tableCode,
  tableLabel,
  statusLabel,
  statusTone,
  lang,
  onLangChange,
  connected,
  onRefresh,
  connectedLabel,
  refreshLabel,
  refreshing,
  languageLabel,
  languageOptions,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">{tableLabel}</div>
        <div className="text-2xl font-semibold">
          {venueName} · {tableCode}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusClasses[statusTone]}>{statusLabel}</Badge>
          {connected && <Badge variant="outline">{connectedLabel}</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {refreshLabel}
          </Button>
        )}
        <Select value={lang} onValueChange={(val) => onLangChange(val as Language)}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder={languageLabel} />
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
    </div>
  );
}
