/**
 * AlertSidebar — Displays active critical alerts from risk.api.js.
 * Shows severity level, risk type, probability, depth, and evidence IDs.
 * HIGH alerts get a subtle pulsing border highlight.
 */
export default function AlertSidebar({ alerts }) {
  const openAlerts = alerts.filter(a => a.status === 'open');
  const highCount = openAlerts.filter(a => a.level === 'HIGH').length;
  const medCount = openAlerts.filter(a => a.level === 'MEDIUM').length;

  return (
    <div className="bg-panel border border-line rounded h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-line flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] text-dim uppercase tracking-wider font-semibold">Critical Alerts</div>
          <span className="text-[11px] font-mono text-danger font-bold">
            {openAlerts.length} OPEN
          </span>
        </div>
        {/* Summary badges */}
        <div className="flex gap-2">
          {highCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-danger/10 text-danger border border-danger/25 font-medium">
              {highCount} High
            </span>
          )}
          {medCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-caution/10 text-caution border border-caution/25 font-medium">
              {medCount} Medium
            </span>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {openAlerts.length === 0 ? (
          <p className="text-sm text-dim p-2">No active alerts.</p>
        ) : (
          openAlerts.map(alert => (
            <AlertCard key={alert.alert_id} alert={alert} />
          ))
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }) {
  const isHigh = alert.level === 'HIGH';
  const borderClass = isHigh ? 'border-danger/50 alert-highlight-high' : 'border-caution/40';
  const bgClass = isHigh ? 'bg-danger/5' : 'bg-caution/5';

  return (
    <div className={`p-3 rounded border ${borderClass} ${bgClass}`}>
      {/* Title row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isHigh && <div className="w-2 h-2 rounded-full bg-danger" />}
          <span className={`text-sm font-bold ${isHigh ? 'text-danger' : 'text-caution'}`}>
            {alert.risk_type.replace(/_/g, ' ')}
          </span>
        </div>
        <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
          isHigh
            ? 'text-danger border-danger/30 bg-danger/10'
            : 'text-caution border-caution/30 bg-caution/10'
        }`}>
          {alert.level}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-background/60 rounded p-2 border border-line/50">
          <div className="text-[10px] text-dim uppercase">Depth</div>
          <div className="font-mono font-bold text-sm">{alert.depth} m</div>
        </div>
        <div className="bg-background/60 rounded p-2 border border-line/50">
          <div className="text-[10px] text-dim uppercase">Probability</div>
          <div className="font-mono font-bold text-sm">{(alert.probability * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Evidence */}
      <div className="text-[11px] text-dim">
        <span className="uppercase tracking-wider mr-1">Evidence:</span>
        {alert.evidence && alert.evidence.length > 0 ? (
          <span className="inline-flex flex-wrap gap-1 ml-0.5">
            {alert.evidence.map(ev => (
              <span key={ev} className="font-mono bg-background px-1.5 py-0.5 rounded border border-line text-foreground/80">
                {ev}
              </span>
            ))}
          </span>
        ) : (
          <span>None</span>
        )}
      </div>

      {/* Source */}
      <div className="text-[10px] text-dim mt-1.5">
        Well {alert.well_id} · Model {alert.model_version}
      </div>
    </div>
  );
}
