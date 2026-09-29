/**
 * PipelineTemp — Pipeline temperature strip chart matching
 * the reference design's compact horizontal heat strip.
 * Uses inline SVG to render a temperature gradient visualization.
 */
export default function PipelineTemp() {
  // demo flavor, not in shared contract, static/synthetic
  // Synthetic pipeline temperature data (°C) across 24 segments
  const temps = [
    62, 64, 68, 72, 75, 78, 82, 85, 83, 80,
    76, 73, 71, 74, 78, 81, 84, 79, 75, 72,
    68, 65, 63, 61,
  ];

  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);

  function tempColor(t) {
    const pct = (t - minTemp) / (maxTemp - minTemp);
    if (pct < 0.3) return 'var(--steel)'; // normal (cool)
    if (pct < 0.6) return 'var(--ochre)'; // caution (warm)
    return 'var(--rust)'; // danger (hot)
  }

  const segW = 100 / temps.length;

  return (
    <div className="h-full flex flex-col p-3 bg-background">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Pipeline Temperature (°C)</h3>
      </div>

      {/* Temperature strip */}
      <div className="flex-1 flex flex-col justify-center gap-3 min-h-0">
        <svg viewBox="0 0 100 12" className="w-full" preserveAspectRatio="none" style={{ height: '28px' }}>
          {temps.map((t, i) => (
            <rect
              key={i}
              x={i * segW}
              y="0"
              width={segW + 0.2}
              height="12"
              fill={tempColor(t)}
              opacity={0.65 + ((t - minTemp) / (maxTemp - minTemp)) * 0.35}
            />
          ))}
        </svg>

        {/* Legend scale */}
        <div className="flex justify-between text-[9px] text-dim font-mono">
          <span>{minTemp}°C</span>
          <span>{Math.round((minTemp + maxTemp) / 2)}°C</span>
          <span>{maxTemp}°C</span>
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-3 text-[10px] text-dim">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-normal" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-caution" />
            <span>Warm</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-danger" />
            <span>Hot</span>
          </div>
        </div>
      </div>
    </div>
  );
}
