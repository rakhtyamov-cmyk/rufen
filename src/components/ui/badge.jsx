import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Стандартные shadcn-варианты + наши статус-варианты (ACTIONS.status из manage.gs:
// good/warning/serious/critical/neutral) — цвет = 15% фон + полноцветный текст/бордер,
// не заливка, чтобы бейдж не спорил по громкости с остальным UI.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        good: 'border-status-good/30 bg-status-good/10 text-status-good',
        warning: 'border-status-warning/40 bg-status-warning/15 text-status-warning',
        serious: 'border-status-serious/30 bg-status-serious/10 text-status-serious',
        critical: 'border-status-critical/30 bg-status-critical/10 text-status-critical',
        neutral: 'border-status-neutral/30 bg-status-neutral/10 text-status-neutral',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

// forwardRef — нужен, чтобы Badge можно было класть внутрь Radix-триггеров
// (Tooltip/DropdownMenu asChild), которые прокидывают ref в дочерний элемент.
// См. ModerationAlert в CampaignCard.jsx — первое место, где это понадобилось.
const Badge = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(badgeVariants({ variant, className }))} {...props} />
));
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
