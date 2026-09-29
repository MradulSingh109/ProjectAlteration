/**
 * KpiTiles — 2×2 grid of key performance indicators
 * matching the reference design: Rig Availability, Water Usage,
 * Cost per Barrel, Mud Weight. Uses realtime data where available.
 */
export default function KpiTiles({ realtime = [] }) {
  // Extract mud weight from realtime data if available
  const mudWeight = realtime.find(r => r.parameter === 'mud_weight');
  const mudWeightVal = mudWeight ? mudWeight.value.toFixed(1) : '9.6';

  // demo flavor, not in shared contract, static/synthetic
  const tiles = [
    {
      label: 'Rig Availability',
      value: '98.2',
      unit: '%',
      highlight: true,
    },
    {
      label: 'Water Usage',
      value: '1,250',
      unit: 'm³/day',
      highlight: false,
    },
    {
      label: 'Cost per Barrel',
      value: '$27.4',
      unit: '',
      highlight: false,
    },
    {
      label: 'Mud Weight',
      value: mudWeightVal,
      unit: 'ppg',
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={`rounded p-3 border ${
            tile.highlight
              ? 'bg-normal/10 border-normal/30'
              : 'bg-background border-line'
          }`}
        >
          <div className="text-[11px] text-dim uppercase tracking-wide mb-1.5">{tile.label}</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-bold font-mono ${tile.highlight ? 'text-normal' : 'text-foreground'}`}>
              {tile.value}
            </span>
            {tile.unit && (
              <span className="text-[11px] text-dim">{tile.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
