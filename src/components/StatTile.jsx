import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatTile({ label, value, icon: Icon, critical, active, onClick }) {
  const clickable = typeof onClick === 'function';
  return (
    <Card
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={cn(
        critical && 'border-status-critical/40',
        clickable && 'cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'ring-2 ring-primary border-primary/40'
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wide">{label}</CardTitle>
          {Icon && <Icon className={cn('h-4 w-4 text-muted-foreground', critical && 'text-status-critical', active && 'text-primary')} />}
        </div>
        <p className={cn('text-2xl font-semibold tabular-nums', critical && 'text-status-critical')}>{value}</p>
      </CardHeader>
    </Card>
  );
}
