/**
 * DrillingChart — "Wind Energy" style bar+line chart from the reference.
 * Adapted to show Drilling Parameters (ROP / Torque over time).
 * Uses inline SVG for the chart since no chart library is installed.
 * All colors read from CSS custom properties for theme compatibility.
 */
export default function DrillingChart({ realtime = [] }) {
  const rop = realtime.find(r => r.parameter === 'ROP');
  const torque = realtime.find(r => r.parameter === 'torque');

  // Generate synthetic time-series data for visualization
  const hours = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00'];
  const ropBase = rop ? rop.value : 12.5;
  const torqueBase = torque ? torque.value : 1850;

  // Synthetic bar data (ROP variation over the day)
  const ropData = [
    ropBase * 0.7,
    ropBase * 0.9,
    ropBase * 1.1,
    ropBase * 0.85,
    ropBase * 1.0,
    ropBase * 0.6,
    ropBase * 0.75,
  ];

  // Synthetic line data (Torque trend)
  const torqueData = [
    torqueBase * 0.8,
    torqueBase * 0.95,
    torqueBase * 1.05,
    torqueBase * 0.9,
    torqueBase * 1.1,
    torqueBase * 0.85,
    torqueBase * 0.7,
  ];

  const maxRop = Math.max(...ropData) * 1.2;
  const maxTorque = Math.max(...torqueData) * 1.2;

  const chartW = 400;
  const chartH = 120;
  const barW = 24;
  const gap = (chartW - barW * hours.length) / (hours.length + 1);

  // Build torque line path
  const linePoints = torqueData.map((val, i) => {
    const x = gap + i * (barW + gap) + barW / 2;
    const y = chartH - (val / maxTorque) * chartH;
    return `${x},${y}`;
  });
  const linePath = `M${linePoints.join(' L')}`;

  return (
    <div className="h-full flex flex-col p-3 bg-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-foreground">Drilling Parameters</h3>
      </div>

      {/* Y-axis labels + Chart */}
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Y labels */}
        <div className="flex flex-col justify-between text-[9px] font-mono py-0.5 text-dim">
          <span>15</span>
          <span>10</span>
          <span>5</span>
          <span>0</span>
        </div>

        {/* SVG Chart */}
        <div className="flex-1 min-w-0">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full" preserveAspectRatio="none">
            {/* Horizontal grid lines */}
            {[0, 0.33, 0.66, 1].map((pct, i) => (
              <line
                key={i}
                x1="0" y1={chartH * pct} x2={chartW} y2={chartH * pct}
                stroke="var(--line)" strokeWidth="0.5" strokeDasharray="3 3"
              />
            ))}

            {/* ROP bars — use steel at moderate opacity */}
            {ropData.map((val, i) => {
              const x = gap + i * (barW + gap);
              const h = (val / maxRop) * chartH;
              const y = chartH - h;
              return (
                <rect
                  key={i}
                  x={x} y={y}
                  width={barW} height={h}
                  rx="2"
                  fill="var(--steel)"
                  opacity="0.45"
                />
              );
            })}

            {/* Torque line — use ochre */}
            <path d={linePath} fill="none" stroke="var(--ochre)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Torque dots */}
            {torqueData.map((val, i) => {
              const x = gap + i * (barW + gap) + barW / 2;
              const y = chartH - (val / maxTorque) * chartH;
              return <circle key={i} cx={x} cy={y} r="3" fill="var(--ochre)" />;
            })}
          </svg>
        </div>

        {/* Right Y labels (kW/torque) */}
        <div className="flex flex-col justify-between text-[9px] font-mono py-0.5 text-dim">
          <span>kW</span>
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between px-6 mt-1">
        {hours.map(h => (
          <span key={h} className="text-[9px] font-mono text-dim">{h}</span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-[10px] text-dim">
          <span className="w-4 h-[2px] rounded bg-normal opacity-60" />
          ROP (m/hr)
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-dim">
          <span className="w-4 h-[2px] rounded bg-caution" />
          Torque (ft-lbs)
        </div>
      </div>
    </div>
  );
}
