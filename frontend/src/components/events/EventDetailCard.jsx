/**
 * EventDetailCard — Shared component used by both WellDetails and EventExplorer.
 * Displays type, depth, severity, and evidence for a selected event.
 * Style matches the alert cards established on WellMap.
 */
import { Link } from 'react-router-dom';

export default function EventDetailCard({ event }) {
  const isHigh = event.severity === 'high';
  const isMedium = event.severity === 'medium';

  const borderClass = isHigh
    ? 'border-l-danger'
    : isMedium
    ? 'border-l-caution'
    : 'border-l-normal';

  const textClass = isHigh
    ? 'text-danger'
    : isMedium
    ? 'text-caution'
    : 'text-normal';

  const badgeClass = isHigh
    ? 'text-danger border-danger/30 bg-danger/10'
    : isMedium
    ? 'text-caution border-caution/30 bg-caution/10'
    : 'text-normal border-normal/30 bg-normal/10';

  return (
    <div className={`rounded border-l-4 ${borderClass} bg-panel border border-line shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-line">
        <span className={`text-sm font-bold uppercase tracking-wide ${textClass}`}>
          {event.type.replace(/_/g, ' ')}
        </span>
        <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${badgeClass}`}>
          {event.severity}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 p-4 pb-3">
        <div className="bg-background rounded p-2 border border-line/50">
          <div className="text-[10px] text-dim uppercase mb-1">Depth (MD)</div>
          <div className="font-mono font-bold text-sm text-foreground">{event.depth_md} m</div>
        </div>
        <div className="bg-background rounded p-2 border border-line/50">
          <div className="text-[10px] text-dim uppercase mb-1">Formation</div>
          <div className="font-mono font-bold text-xs text-foreground truncate" title={event.formation}>
            {event.formation}
          </div>
        </div>
        <div className="bg-background rounded p-2 border border-line/50">
          <div className="text-[10px] text-dim uppercase mb-1">Well</div>
          <div className="font-mono font-bold text-xs text-foreground">{event.well_id}</div>
        </div>
        <div className="bg-background rounded p-2 border border-line/50">
          <div className="text-[10px] text-dim uppercase mb-1">Event ID</div>
          <div className="font-mono text-xs text-dim">{event.event_id}</div>
        </div>
      </div>

      {/* Evidence */}
      {event.evidence && (
        <div className="px-4 pb-4 pt-1 border-t border-line/50">
          <div className="text-[11px] text-dim uppercase tracking-wider mb-2 font-semibold pt-3">Evidence</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-background px-2 py-1.5 rounded border border-line">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-dim flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-xs font-mono">{event.evidence.document}</span>
              </div>
              <span className="text-[10px] text-dim bg-panel px-1.5 rounded border border-line flex-shrink-0">
                Pg {event.evidence.page}
              </span>
            </div>
            <div className="bg-background p-2.5 rounded border border-line text-sm text-foreground/90 italic leading-relaxed">
              "{event.evidence.note}"
            </div>
          </div>
        </div>
      )}

      {/* View on depth track link */}
      <div className="px-4 pb-4">
        <Link
          to={`/wells?id=${event.well_id}&event=${event.event_id}`}
          className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded border border-line bg-background hover:border-dim hover:bg-panel text-sm text-dim hover:text-foreground transition-all active:scale-95 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
          </svg>
          View on well's depth track
        </Link>
      </div>
    </div>
  );
}
