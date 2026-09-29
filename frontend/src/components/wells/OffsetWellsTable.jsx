/**
 * OffsetWellsTable — Small table listing nearby offset wells with key metrics.
 * Shown below the RadiusFilter in the left control panel.
 */
export default function OffsetWellsTable({ wells }) {
  if (!wells || wells.length === 0) {
    return (
      <div className="bg-panel border border-line rounded p-4">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-2">Offset Wells</div>
        <div className="text-sm text-dim">No wells in range.</div>
      </div>
    );
  }

  // Sort by similarity descending
  const sorted = [...wells].sort((a, b) => b.similarity_score - a.similarity_score);

  return (
    <div className="bg-panel border border-line rounded p-4">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Offset Wells in Range</div>
      <div className="space-y-1.5">
        {sorted.map(w => (
          <div
            key={w.well_id}
            className="flex items-center justify-between py-1.5 px-2 bg-background border border-line rounded hover:border-normal/40 transition-colors cursor-default"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: w.formation_match ? '#5f7f8f' : '#a89a83' }}
              />
              <span className="text-[13px] font-mono font-medium">{w.well_id}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-dim">{(w.distance_m / 1000).toFixed(1)} km</span>
              <span className={`text-[12px] font-mono font-bold ${
                w.similarity_score >= 0.8 ? 'text-normal' : 'text-dim'
              }`}>
                {(w.similarity_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[11px] text-dim">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-normal" />
          <span>Formation match</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-dim" />
          <span>No match</span>
        </div>
      </div>
    </div>
  );
}
