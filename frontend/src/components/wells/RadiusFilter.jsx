/**
 * RadiusFilter — Compact slider to control the nearby-wells search radius (1–20 km).
 * Displays the current value and the count of offset wells in range.
 */
export default function RadiusFilter({ radius, onChange, wellCount }) {
  return (
    <div className="bg-panel border border-line rounded p-4">
      <div className="flex justify-between items-center mb-3">
        <div className="text-[11px] text-dim uppercase tracking-wider">Search Radius</div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-normal">{radius} km</span>
          {wellCount !== undefined && (
            <span className="text-[11px] text-dim border border-line rounded px-1.5 py-0.5">
              {wellCount} wells
            </span>
          )}
        </div>
      </div>

      <input
        id="radius-slider"
        type="range"
        min="1"
        max="20"
        value={radius}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
      />

      <div className="flex justify-between text-[11px] text-dim mt-1.5 font-mono">
        <span>1 km</span>
        <span>10 km</span>
        <span>20 km</span>
      </div>
    </div>
  );
}
