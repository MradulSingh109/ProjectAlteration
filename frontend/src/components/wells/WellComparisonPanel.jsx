import { Link } from 'react-router-dom';

export default function WellComparisonPanel({ stats, loading, onClose, activeWellId }) {
  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[800px] bg-panel border-l border-line shadow-2xl z-[2000] flex flex-col items-center justify-center">
        <div className="text-normal font-bold">Loading comparison data...</div>
      </div>
    );
  }

  if (!stats || stats.length === 0) return null;

  const activeStat = stats.find(s => s.well_id === activeWellId);
  const otherStats = stats.filter(s => s.well_id !== activeWellId);
  
  // Combine into active first, then others
  const orderedStats = [activeStat, ...otherStats].filter(Boolean);

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] md:w-[600px] lg:w-[800px] bg-background border-l border-line shadow-2xl z-[2000] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-line bg-panel flex-shrink-0">
        <h2 className="text-lg font-bold text-foreground">Well Comparison</h2>
        <button
          onClick={onClose}
          className="text-dim hover:text-foreground transition-colors p-1"
          aria-label="Close"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content area: Grid of columns */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 flex gap-4">
        {orderedStats.map((stat, idx) => {
          const isActive = stat.well_id === activeWellId;
          const isFormationMatch = stat.formation_match;

          return (
            <div key={stat.well_id} className="flex-1 min-w-[220px] max-w-[280px] bg-panel border border-line rounded flex flex-col shadow-sm">
              {/* Header */}
              <div className="p-3 border-b border-line flex flex-col gap-1">
                {isActive && (
                  <span className="text-[10px] font-mono font-bold uppercase text-normal bg-normal/10 border border-normal/30 px-1.5 py-0.5 rounded self-start">
                    Active Target
                  </span>
                )}
                <Link
                  to={`/wells?id=${stat.well_id}`}
                  className="text-md font-bold text-foreground hover:text-normal transition-colors"
                >
                  {stat.name || stat.well_id}
                </Link>
                <div className="text-[11px] font-mono text-dim">{stat.well_id}</div>
              </div>

              {/* Rows */}
              <div className="flex-1 p-3 space-y-4 text-[12px]">
                {/* Formation */}
                <div>
                  <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Formation</div>
                  <div className={`font-semibold ${isFormationMatch ? 'text-normal' : 'text-foreground'}`}>
                    {stat.formation}
                  </div>
                  {!isFormationMatch && !isActive && (
                    <div className="text-[10px] text-dim mt-0.5 italic">
                      different formation — compare with caution
                    </div>
                  )}
                </div>

                {/* Distance & Similarity */}
                {!isActive && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Distance</div>
                      <div className="font-mono text-foreground">{(stat.distance_m / 1000).toFixed(1)} km</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Similarity</div>
                      <div className="font-mono text-foreground">{(stat.similarity_score * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                )}
                
                {isActive && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Distance</div>
                      <div className="font-mono text-dim">—</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Similarity</div>
                      <div className="font-mono text-dim">—</div>
                    </div>
                  </div>
                )}

                <div className="border-t border-line/50 pt-3" />

                {/* Events */}
                {stat.totalEvents === 0 ? (
                  <div className="text-dim italic">No recorded events for this well</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Total Events</div>
                        <div className="font-mono font-bold text-foreground text-sm">{stat.totalEvents}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Deepest Event</div>
                        <div className="font-mono text-foreground">{stat.deepest ? `${stat.deepest}m` : '—'}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-dim uppercase tracking-wider mb-2">Events by Severity</div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-danger" title="High Severity" />
                          <span className="font-mono text-foreground">{stat.severityCount.high || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-caution" title="Medium Severity" />
                          <span className="font-mono text-foreground">{stat.severityCount.medium || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-normal" title="Low Severity" />
                          <span className="font-mono text-foreground">{stat.severityCount.low || 0}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
