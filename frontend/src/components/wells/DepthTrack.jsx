/**
 * DepthTrack — Custom SVG component plotting historical events
 * on a vertical depth axis alongside simulated lithology and curves.
 * All colors use var(--token) CSS custom properties for theme compatibility.
 */
export default function DepthTrack({ events = [], currentDepth, selectedEventId, onSelectEvent }) {
  // Determine full depth range
  let minDepth = 2500;
  let maxDepth = 3200;
  if (events.length > 0) {
    minDepth = Math.min(...events.map(e => e.depth_md));
    maxDepth = Math.max(...events.map(e => e.depth_md));
  }
  if (currentDepth) {
    minDepth = Math.min(minDepth, currentDepth);
    maxDepth = Math.max(maxDepth, currentDepth);
  }

  // Pad by ~50m and round to nearest 50
  const topDepth = Math.floor((minDepth - 50) / 50) * 50;
  const bottomDepth = Math.ceil((maxDepth + 50) / 50) * 50;
  const depthRange = bottomDepth - topDepth;
  
  // 2 SVG units per meter
  const chartH = depthRange * 2;

  // demo flavor, not in shared contract, static/synthetic
  // Derive lithology zones from events (grouping contiguous formations)
  const sortedByDepth = [...events].sort((a,b) => a.depth_md - b.depth_md);
  const zones = [];
  if (sortedByDepth.length > 0) {
    let currentFormation = sortedByDepth[0].formation;
    let startDepth = topDepth;
    
    for (let i = 1; i < sortedByDepth.length; i++) {
      if (sortedByDepth[i].formation !== currentFormation) {
        const midPoint = (sortedByDepth[i-1].depth_md + sortedByDepth[i].depth_md) / 2;
        zones.push({ name: currentFormation, start: startDepth, end: midPoint });
        currentFormation = sortedByDepth[i].formation;
        startDepth = midPoint;
      }
    }
    zones.push({ name: currentFormation, start: startDepth, end: bottomDepth });
  } else {
    zones.push({ name: 'Unknown Formation', start: topDepth, end: bottomDepth });
  }

  function getLithoPattern(name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('sand')) return 'url(#pat-sand)';
    if (lower.includes('clay')) return 'url(#pat-clay)';
    if (lower.includes('shale') || lower.includes('kopili')) return 'url(#pat-shale)';
    return 'none';
  }

  // Generate synthetic curve data (ROP & Torque)
  function pseudoRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  const ropPoints = [];
  const torquePoints = [];
  for (let d = topDepth; d <= bottomDepth; d += 2) {
    const y = (d - topDepth) * 2;
    const baseRop = 15 + Math.sin(d / 50) * 5;
    const baseTorque = 8 + Math.cos(d / 80) * 3;
    const noise1 = (pseudoRandom(d) - 0.5) * 8;
    const noise2 = (pseudoRandom(d + 1000) - 0.5) * 4;
    const valRop = Math.max(0, Math.min(40, baseRop + noise1));
    const valTorque = Math.max(0, Math.min(20, baseTorque + noise2));
    
    // Map to 220-1000 X range
    ropPoints.push(`${220 + (valRop/40)*780},${y}`);
    torquePoints.push(`${220 + (valTorque/20)*780},${y}`);
  }
  const ropPath = `M${ropPoints.join(' L')}`;
  const torquePath = `M${torquePoints.join(' L')}`;

  // Process event marker placements with stagger to prevent label overlap
  let lastY = -100;
  const minGap = 45; // SVG units to ensure labels don't collide
  const eventPlacements = sortedByDepth.map(event => {
    const markerY = (event.depth_md - topDepth) * 2;
    let labelY = markerY;
    if (labelY < lastY + minGap) {
      labelY = lastY + minGap;
    }
    lastY = labelY;
    return { ...event, markerY, labelY };
  });

  function getMarkerShape(severity, cx, cy) {
    const s = severity?.toLowerCase();
    if (s === 'high') {
      return <polygon points={`${cx},${cy-7} ${cx+7},${cy} ${cx},${cy+7} ${cx-7},${cy}`} fill="var(--rust)" stroke="var(--ink)" strokeWidth="1.5" />;
    } else if (s === 'medium') {
      return <circle cx={cx} cy={cy} r="6" fill="var(--ochre)" stroke="var(--ink)" strokeWidth="1.5" />;
    } else {
      return <circle cx={cx} cy={cy} r="4" fill="var(--steel)" stroke="var(--ink)" strokeWidth="1" />;
    }
  }

  return (
    <div className="flex flex-col h-full bg-background rounded border border-line shadow-lg overflow-hidden">
      {/* ── Headers ── */}
      <div className="flex border-b border-line bg-panel flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-dim">
        <div style={{ width: '15%' }} className="p-3 text-right border-r border-line">MD (m)</div>
        <div style={{ width: '7%' }} className="p-3 text-center border-r border-line">Litho</div>
        <div style={{ width: '78%' }} className="p-3 flex gap-6">
          <span className="text-normal">ROP 0–40 m/hr</span>
          <span className="text-caution">Torque 0–20 kN·m</span>
        </div>
      </div>

      {/* ── Track Area ── */}
      <div className="flex-1 overflow-y-auto shadow-[inset_0_4px_12px_rgba(0,0,0,0.2),inset_0_-4px_12px_rgba(0,0,0,0.2)] bg-background">
        <svg viewBox={`0 0 1000 ${chartH}`} className="w-full" style={{ height: `${chartH}px` }}>
          <defs>
            {/* Lithology patterns — use ink-dim for markings over panel2 background */}
            <pattern id="pat-sand" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="1.5" fill="var(--ink-dim)" opacity="0.4"/>
              <circle cx="14" cy="14" r="1.5" fill="var(--ink-dim)" opacity="0.4"/>
              <circle cx="4" cy="14" r="1" fill="var(--ink-dim)" opacity="0.3"/>
              <circle cx="14" cy="4" r="1" fill="var(--ink-dim)" opacity="0.3"/>
            </pattern>
            <pattern id="pat-clay" width="20" height="20" patternUnits="userSpaceOnUse">
              <line x1="2" y1="5" x2="8" y2="5" stroke="var(--ink-dim)" strokeWidth="1.5" opacity="0.4"/>
              <line x1="12" y1="15" x2="18" y2="15" stroke="var(--ink-dim)" strokeWidth="1.5" opacity="0.4"/>
            </pattern>
            <pattern id="pat-shale" width="20" height="8" patternUnits="userSpaceOnUse">
              <line x1="0" y1="4" x2="20" y2="4" stroke="var(--ink-dim)" strokeWidth="1" opacity="0.4"/>
            </pattern>
          </defs>

          {/* Backgrounds */}
          <rect x="0" y="0" width="150" height={chartH} fill="var(--bg)" />
          <rect x="150" y="0" width="70" height={chartH} fill="var(--panel)" />
          
          {/* Vertical dividers */}
          <line x1="150" y1="0" x2="150" y2={chartH} stroke="var(--line)" strokeWidth="2" />
          <line x1="220" y1="0" x2="220" y2={chartH} stroke="var(--line)" strokeWidth="2" />

          {/* Ticks & Gridlines */}
          {Array.from({ length: Math.floor(depthRange / 10) + 1 }).map((_, i) => {
            const d = topDepth + i * 10;
            const y = i * 20; // (d - topDepth)*2
            const isMajor = d % 50 === 0;

            return (
              <g key={d}>
                {isMajor ? (
                  <>
                    <line x1="120" y1={y} x2="150" y2={y} stroke="var(--ink-dim)" strokeWidth="2" />
                    <text x="110" y={y + 5} fill="var(--ink)" fontSize="14" fontFamily="monospace" textAnchor="end" fontWeight="bold">
                      {d}
                    </text>
                    <line x1="150" y1={y} x2="1000" y2={y} stroke="var(--line)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                  </>
                ) : (
                  <line x1="135" y1={y} x2="150" y2={y} stroke="var(--ink-dim)" strokeWidth="1" opacity="0.5" />
                )}
              </g>
            );
          })}

          {/* Lithology Zones */}
          {zones.map((zone, i) => {
            const y1 = (zone.start - topDepth) * 2;
            const h = (zone.end - zone.start) * 2;
            const midY = y1 + h / 2;
            const pattern = getLithoPattern(zone.name);
            
            return (
              <g key={i}>
                <line x1="150" y1={y1} x2="220" y2={y1} stroke="var(--line)" strokeWidth="2" />
                {pattern !== 'none' && (
                  <rect x="150" y={y1} width="70" height={h} fill={pattern} />
                )}
                <text 
                  x="185" 
                  y={midY} 
                  transform={`rotate(-90, 185, ${midY})`} 
                  textAnchor="middle" 
                  fill="var(--ink)" 
                  fontSize="13" 
                  fontWeight="bold"
                  letterSpacing="2"
                  opacity="0.8"
                >
                  {zone.name.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Curves */}
          <path d={ropPath} fill="none" stroke="var(--steel)" strokeWidth="1.5" strokeLinejoin="bevel" />
          <path d={torquePath} fill="none" stroke="var(--ochre)" strokeWidth="1.5" strokeLinejoin="bevel" />

          {/* Events */}
          {eventPlacements.map(ev => {
            const { markerY, labelY, severity, type, well_id, depth_md, evidence, event_id } = ev;
            const isSelected = selectedEventId === event_id;
            
            return (
              <g key={event_id} className="cursor-pointer" onClick={() => onSelectEvent(ev)}>
                {/* Leader line */}
                <line x1="250" y1={markerY} x2="280" y2={labelY} stroke="var(--ink-dim)" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
                <line x1="280" y1={labelY} x2="295" y2={labelY} stroke="var(--ink-dim)" strokeWidth="1.5" opacity="0.6" />

                {/* Marker */}
                {getMarkerShape(severity, 250, markerY)}

                {/* Highlight if selected */}
                {isSelected && (
                  <rect x="300" y={labelY - 14} width="680" height="36" fill="var(--ink-dim)" opacity="0.1" rx="4" />
                )}

                {/* Label Group */}
                <text x="305" y={labelY + 4} fontSize="14" fontFamily="sans-serif">
                  <tspan fill="var(--ink)" fontWeight="bold">{type.replace(/_/g, ' ').toUpperCase()}</tspan>
                  <tspan fill="var(--ink-dim)"> · {well_id} · {depth_md}m</tspan>
                </text>
                {evidence && (
                  <text x="305" y={labelY + 20} fontSize="12" fill="var(--ink-dim)" opacity="0.8" fontStyle="italic">
                    "{evidence.note}"
                  </text>
                )}
              </g>
            );
          })}

          {/* Current Depth Indicator — uses CSS var glow so it's theme-aware */}
          {currentDepth && currentDepth >= topDepth && currentDepth <= bottomDepth && (
            <g>
              <line 
                x1="0" 
                x2="1000" 
                y1={(currentDepth - topDepth) * 2} 
                y2={(currentDepth - topDepth) * 2} 
                stroke="var(--ochre)" 
                strokeWidth="2.5" 
                strokeDasharray="8 4" 
                style={{ filter: 'var(--glow-ochre)' }} 
              />
              <g transform={`translate(1000, ${(currentDepth - topDepth) * 2})`}>
                <rect x="-170" y="-12" width="170" height="24" rx="4" fill="var(--panel)" stroke="var(--ochre)" strokeWidth="1.5" />
                <text x="-85" y="4" fill="var(--ochre)" fontSize="12" fontWeight="bold" textAnchor="middle" letterSpacing="1">
                  CURRENT · {currentDepth} MD
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
