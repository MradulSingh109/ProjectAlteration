/**
 * IntegrityStatus — Right panel showing Well Integrity Status
 * as a stacked bar chart (by hour) and a summary paragraph.
 * Matches the reference design's dark-background right panel.
 */
import { Link } from 'react-router-dom';

export default function IntegrityStatus({ alerts = [], highAlerts = [] }) {
  // demo flavor, not in shared contract, static/synthetic
  // Synthetic hourly integrity data:
  // Each bar shows stacked segments for Normal, Warning, Critical statuses
  const hours = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00'];

  const integrityData = [
    { normal: 70, warning: 20, critical: 10 },
    { normal: 65, warning: 25, critical: 10 },
    { normal: 60, warning: 25, critical: 15 },
    { normal: 75, warning: 15, critical: 10 },
    { normal: 55, warning: 30, critical: 15 },
    { normal: 80, warning: 10, critical: 10 },
    { normal: 70, warning: 20, critical: 10 },
  ];

  const barW = 20;
  const chartW = 260;
  const chartH = 100;
  const gap = (chartW - barW * hours.length) / (hours.length + 1);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-line flex-shrink-0">
        <h3 className="text-sm font-bold text-foreground italic">Well Integrity Status</h3>
      </div>

      {/* Stacked bar chart */}
      <div className="px-4 pt-4 pb-2">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ height: '120px' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
            <line
              key={i}
              x1="0" y1={chartH * (1 - pct)} x2={chartW} y2={chartH * (1 - pct)}
              stroke="var(--line)" strokeWidth="0.5" strokeDasharray="3 3"
            />
          ))}

          {/* Bars */}
          {integrityData.map((d, i) => {
            const total = d.normal + d.warning + d.critical;
            const x = gap + i * (barW + gap);

            const normalH = (d.normal / total) * chartH;
            const warningH = (d.warning / total) * chartH;
            const criticalH = (d.critical / total) * chartH;

            return (
              <g key={i}>
                {/* Normal (bottom) */}
                <rect
                  x={x} y={chartH - normalH}
                  width={barW} height={normalH}
                  rx="1" fill="var(--steel)" opacity="0.8"
                />
                {/* Warning (middle) */}
                <rect
                  x={x} y={chartH - normalH - warningH}
                  width={barW} height={warningH}
                  rx="1" fill="var(--ochre)" opacity="0.8"
                />
                {/* Critical (top) */}
                <rect
                  x={x} y={chartH - normalH - warningH - criticalH}
                  width={barW} height={criticalH}
                  rx="1" fill="var(--rust)" opacity="0.8"
                />
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between px-1 mt-1.5">
          {hours.map(h => (
            <span key={h} className="text-[9px] font-mono text-dim">{h}</span>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1 text-[10px] text-dim">
            <span className="w-2.5 h-2.5 rounded-sm bg-normal" />
            Normal
          </div>
          <div className="flex items-center gap-1 text-[10px] text-dim">
            <span className="w-2.5 h-2.5 rounded-sm bg-caution" />
            Warning
          </div>
          <div className="flex items-center gap-1 text-[10px] text-dim">
            <span className="w-2.5 h-2.5 rounded-sm bg-danger" />
            Critical
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-line mx-4" />

      {/* Summary text */}
      <div className="p-4 flex-1">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-normal/15 border border-normal/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-normal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          </div>
          <p className="text-[12px] text-dim leading-relaxed">
            Well integrity remains stable with pressure levels staying within
            operational limits, showing {highAlerts.length > 0 ? (
              <span className="text-danger font-semibold">{highAlerts.length} critical anomal{highAlerts.length === 1 ? 'y' : 'ies'}</span>
            ) : (
              <span className="text-normal font-semibold">no critical anomalies</span>
            )} throughout the monitoring period.
          </p>
        </div>

        {/* Active alerts summary */}
        {alerts.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-[11px] text-dim uppercase tracking-wider font-semibold">Active Alerts</div>
            {alerts.slice(0, 3).map(alert => (
              <Link
                key={alert.alert_id}
                to={`/wells?id=${alert.well_id}`}
                className={`block p-2 rounded border text-[12px] hover:brightness-125 transition-all cursor-pointer active:scale-[0.98] ${
                  alert.level === 'HIGH'
                    ? 'border-danger/40 bg-danger/5'
                    : 'border-caution/40 bg-caution/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${alert.level === 'HIGH' ? 'text-danger' : 'text-caution'}`}>
                    {alert.risk_type.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-dim text-[10px]">{alert.well_id}</span>
                </div>
                <div className="flex gap-3 mt-1 text-dim text-[11px]">
                  <span>Depth: <span className="font-mono text-foreground">{alert.depth}m</span></span>
                  <span>Prob: <span className="font-mono text-foreground">{(alert.probability * 100).toFixed(0)}%</span></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
