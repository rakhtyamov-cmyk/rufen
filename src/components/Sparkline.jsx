// Тонкий bar-спарклайн: закруглённый data-end, зазор между барами,
// последний (самый свежий) день — акцентным цветом (series-1 / muted-foreground пара).
export function Sparkline({ values }) {
  const w = 84;
  const h = 26;
  const gap = 2;
  const n = values.length;
  const barW = (w - gap * (n - 1)) / n;
  const max = Math.max(1, ...values);
  const title = `Инсталлы за 7д: ${values.join(' / ')}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" tabIndex={0} aria-label={title}>
      <title>{title}</title>
      {values.map((v, i) => {
        const barH = Math.max(v > 0 ? 2 : 0, (v / max) * (h - 2));
        const x = i * (barW + gap);
        const y = h - barH;
        const isLast = i === n - 1;
        const r = Math.min(4, barW / 2, barH);
        return (
          <rect
            key={i}
            x={x.toFixed(1)}
            y={y.toFixed(1)}
            width={barW.toFixed(1)}
            height={barH.toFixed(1)}
            rx={r.toFixed(1)}
            className={isLast ? 'fill-primary' : 'fill-primary/30'}
          />
        );
      })}
    </svg>
  );
}
