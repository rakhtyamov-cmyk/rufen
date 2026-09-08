import { ChevronDown, Search, TriangleAlert, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

function GeoMultiSelect({ geos, selected, onToggle, onClear }) {
  const label = selected.length === 0 ? 'Все гео' : selected.length === 1 ? selected[0] : `Гео (${selected.length})`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('h-9 gap-1.5 font-normal', selected.length > 0 && 'border-primary/50 text-foreground')}>
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuLabel>Гео (несколько сразу)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {geos.map((g) => (
          <DropdownMenuCheckboxItem key={g} checked={selected.includes(g)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => onToggle(g)}>
            {g}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <button type="button" onClick={onClear} className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent">
              <X className="h-3.5 w-3.5" /> Сбросить гео
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Filters({
  geos,
  search, onSearch, searchInputRef,
  selectedGeos, onToggleGeo, onClearGeos,
  sortBy, onSortBy,
  onlyAttention, onToggleOnlyAttention, attentionCount,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b pb-4">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="search"
          placeholder="Поиск: кампания, гео, аккаунт… (/)"
          aria-label="Поиск"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <Button
        type="button"
        variant={onlyAttention ? 'default' : 'outline'}
        size="sm"
        aria-pressed={onlyAttention}
        onClick={() => onToggleOnlyAttention(!onlyAttention)}
        className={cn(!onlyAttention && 'text-muted-foreground')}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        Только требуют внимания
        <span className={cn('ml-0.5 rounded-full px-1.5 text-xs tabular-nums', onlyAttention ? 'bg-primary-foreground/20' : 'bg-muted')}>
          {attentionCount}
        </span>
      </Button>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <GeoMultiSelect geos={geos} selected={selectedGeos} onToggle={onToggleGeo} onClear={onClearGeos} />

        <Select value={sortBy} onValueChange={onSortBy}>
          <SelectTrigger className="w-auto min-w-[9rem]" aria-label="Сортировка">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency">По срочности</SelectItem>
            <SelectItem value="roasD3">ROAS d3 ↑</SelectItem>
            <SelectItem value="roasD3desc">ROAS d3 ↓</SelectItem>
            <SelectItem value="budget">Бюджет ↓</SelectItem>
            <SelectItem value="geo">Гео A→Я</SelectItem>
            <SelectItem value="name">Имя A→Я</SelectItem>
          </SelectContent>
        </Select>

        <ThemeToggle />
      </div>
    </div>
  );
}
