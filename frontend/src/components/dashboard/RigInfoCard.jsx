/**
 * RigInfoCard — Displays rig type, max depth, and load capacity
 * in a floating card style similar to the reference design.
 * Shows an SVG drilling rig illustration.
 * All SVG colors use var(--token) for theme compatibility.
 */
export default function RigInfoCard({ wellId }) {
  return (
    <div className="relative bg-background border border-line rounded overflow-hidden">
      {/* Rig Illustration SVG */}
      <div className="h-[140px] flex items-end justify-center px-4 pt-3 pb-0 relative overflow-hidden">
        <RigIllustration />
      </div>

      {/* Info overlay card */}
      <div className="bg-panel border-t border-line p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[11px] text-dim font-mono mb-0.5">OIL#{wellId?.replace('DLJ-', '') || '114'}</div>
            <div className="text-sm font-bold text-foreground leading-tight">Land Drilling Rig,<br />Truss Structure</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-sm bg-foreground/70 flex-shrink-0" />
            <span className="text-dim">Max Depth:</span>
            <span className="font-mono font-semibold text-foreground">4,000 meters</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-sm bg-normal flex-shrink-0" />
            <span className="text-dim">Load Capacity:</span>
            <span className="font-mono font-semibold text-foreground">2,000 HP</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simplified drilling rig SVG illustration — uses CSS vars for all colors */
function RigIllustration() {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
      {/* Ground line */}
      <line x1="20" y1="135" x2="180" y2="135" stroke="var(--line)" strokeWidth="1" />

      {/* Rig base platform */}
      <rect x="50" y="120" width="100" height="15" rx="1" fill="var(--panel2)" stroke="var(--line)" strokeWidth="0.5" />

      {/* Left support leg */}
      <line x1="60" y1="120" x2="80" y2="20" stroke="var(--steel)" strokeWidth="2" />
      {/* Right support leg */}
      <line x1="140" y1="120" x2="120" y2="20" stroke="var(--steel)" strokeWidth="2" />

      {/* Cross braces */}
      <line x1="65" y1="100" x2="135" y2="100" stroke="var(--line)" strokeWidth="1" />
      <line x1="70" y1="80" x2="130" y2="80" stroke="var(--line)" strokeWidth="1" />
      <line x1="75" y1="60" x2="125" y2="60" stroke="var(--line)" strokeWidth="1" />
      <line x1="80" y1="40" x2="120" y2="40" stroke="var(--line)" strokeWidth="1" />

      {/* Diagonal braces */}
      <line x1="65" y1="100" x2="130" y2="80" stroke="var(--line)" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="135" y1="100" x2="70" y2="80" stroke="var(--line)" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="70" y1="80" x2="125" y2="60" stroke="var(--line)" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="130" y1="80" x2="75" y2="60" stroke="var(--line)" strokeWidth="0.5" strokeOpacity="0.6" />

      {/* Derrick mast (vertical) */}
      <rect x="96" y="10" width="8" height="110" rx="1" fill="var(--panel2)" stroke="var(--steel)" strokeWidth="1" />

      {/* Top crown block */}
      <rect x="88" y="6" width="24" height="8" rx="1" fill="var(--panel2)" stroke="var(--steel)" strokeWidth="1" />

      {/* Drill string line */}
      <line x1="100" y1="14" x2="100" y2="135" stroke="var(--ink-dim)" strokeWidth="0.8" strokeDasharray="3 2" />

      {/* Mud house / engine room */}
      <rect x="145" y="105" width="30" height="15" rx="1" fill="var(--panel2)" stroke="var(--line)" strokeWidth="0.5" />
      <rect x="148" y="108" width="5" height="5" rx="0.5" fill="var(--line)" />

      {/* Small rig floor detail */}
      <rect x="85" y="115" width="30" height="5" rx="0.5" fill="var(--line)" />

      {/* Flag at top */}
      <line x1="100" y1="6" x2="100" y2="0" stroke="var(--steel)" strokeWidth="0.8" />
      <polygon points="100,0 112,3 100,6" fill="var(--rust)" opacity="0.8" />
    </svg>
  );
}
