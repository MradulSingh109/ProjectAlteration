import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getEvents } from '../api/events.api';
import { getWells } from '../api/wells.api';
import EventDetailCard from '../components/events/EventDetailCard';

// Event type color hints (illustrative — not severity from contract)
const EVENT_TYPE_META = {
  mud_loss:        { dot: 'var(--rust)' },  // typically high
  kick:            { dot: 'var(--rust)' },  // typically high
  stuck_pipe:      { dot: 'var(--rust)' },  // typically high
  fishing:         { dot: 'var(--rust)' },  // typically high
  torque_spike:    { dot: 'var(--ochre)' }, // typically medium
  cementing_issue: { dot: 'var(--ochre)' }, // typically medium
  npt:             { dot: 'var(--steel)' }, // typically low / neutral
};

const EVENT_TYPES = Object.keys(EVENT_TYPE_META);
const SEVERITY_META = { high: 'var(--rust)', medium: 'var(--ochre)', low: 'var(--steel)' };

const FORMATIONS = [
  'Barail Sandstone',
  'Tipam Sandstone',
  'Girujan Clay',
  'Kopili',
];

function SeverityDot({ severity }) {
  const color = SEVERITY_META[severity] || '#a89a83';
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="capitalize">{severity}</span>
    </span>
  );
}

export default function EventExplorer() {
  const [searchParams] = useSearchParams();
  // Pre-apply well filter from ?well= query param (set by Documents page link)
  const wellParamInit = searchParams.get('well') || '';

  const [allEvents, setAllEvents] = useState([]);
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [severityFilter, setSeverityFilter] = useState([]);
  const [formationFilter, setFormationFilter] = useState('');
  const [wellIdFilter, setWellIdFilter] = useState(wellParamInit);
  const [depthFrom, setDepthFrom] = useState('');
  const [depthTo, setDepthTo] = useState('');

  // Table state
  const [sortKey, setSortKey] = useState('depth_md');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Load all events + wells on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [evs, ws] = await Promise.all([getEvents(), getWells()]);
      setAllEvents(evs);
      setWells(ws);
      setLoading(false);
    }
    load();
  }, []);

  // Well ID → name lookup map
  const wellNameMap = useMemo(() => {
    const m = {};
    wells.forEach(w => { m[w.well_id] = w.name; });
    return m;
  }, [wells]);

  // Toggle helpers
  function toggleType(t) {
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }
  function toggleSeverity(s) {
    setSeverityFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function clearFilters() {
    setSearch('');
    setTypeFilter([]);
    setSeverityFilter([]);
    setFormationFilter('');
    setWellIdFilter('');
    setDepthFrom('');
    setDepthTo('');
  }

  // Sorting
  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // Derived filtered + sorted list
  const filtered = useMemo(() => {
    const sq = search.toLowerCase();
    let result = allEvents.filter(e => {
      if (typeFilter.length > 0 && !typeFilter.includes(e.type)) return false;
      if (severityFilter.length > 0 && !severityFilter.includes(e.severity)) return false;
      if (formationFilter && e.formation !== formationFilter) return false;
      if (wellIdFilter && e.well_id !== wellIdFilter) return false;
      if (depthFrom !== '' && e.depth_md < Number(depthFrom)) return false;
      if (depthTo !== '' && e.depth_md > Number(depthTo)) return false;
      if (sq) {
        const hit =
          e.type.includes(sq) ||
          e.formation.toLowerCase().includes(sq) ||
          (e.evidence?.note || '').toLowerCase().includes(sq) ||
          (wellNameMap[e.well_id] || '').toLowerCase().includes(sq);
        if (!hit) return false;
      }
      return true;
    });

    const severityOrder = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'depth_md') {
        cmp = a.depth_md - b.depth_md;
      } else if (sortKey === 'severity') {
        cmp = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allEvents, typeFilter, severityFilter, formationFilter, wellIdFilter, depthFrom, depthTo, search, sortKey, sortDir, wellNameMap]);

  function SortIndicator({ col }) {
    if (sortKey !== col) return <span className="text-dim/40 ml-1">↕</span>;
    return <span className="text-normal ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="h-full flex overflow-hidden bg-background">

      {/* ══════ LEFT PANEL — Filters ══════ */}
      <div className="w-[280px] flex-shrink-0 bg-panel border-r border-line flex flex-col overflow-y-auto">
        {/* Count header */}
        <div className="px-4 py-3 border-b border-line flex-shrink-0">
          <div className="text-[13px] text-dim">
            <span className="text-2xl font-bold text-foreground font-mono">{loading ? '—' : filtered.length}</span>
            {' '} events found
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Active well filter chip (set by Documents page) */}
          {wellIdFilter && (
            <div className="flex items-center justify-between bg-normal/10 border border-normal/30 rounded px-2.5 py-1.5">
              <span className="text-[12px] text-normal font-mono">{wellIdFilter}</span>
              <button
                onClick={() => setWellIdFilter('')}
                className="text-dim hover:text-foreground ml-2 text-sm leading-none cursor-pointer"
                aria-label="Remove well filter"
              >×</button>
            </div>
          )}

          {/* Search */}
          <div>
            <div className="flex items-center bg-background border border-line rounded px-3 py-2 gap-2">
              <svg className="w-4 h-4 text-dim flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type, formation, note…"
                className="bg-transparent text-sm text-foreground placeholder:text-dim outline-none w-full"
              />
              <span className="text-dim text-[11px] border border-line rounded px-1.5 py-0.5 font-mono flex-shrink-0">⌘K</span>
            </div>
          </div>

          {/* Event Type */}
          <div>
            <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-2">Event Type</div>
            <div className="space-y-1.5">
              {EVENT_TYPES.map(t => {
                const meta = EVENT_TYPE_META[t];
                const checked = typeFilter.includes(t);
                return (
                  <label key={t} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(t)}
                      className="sr-only"
                    />
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      checked ? 'bg-normal/20 border-normal' : 'border-line group-hover:border-dim'
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-normal" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dot }} />
                    <span className="text-sm text-foreground">{t.replace(/_/g, ' ')}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Severity */}
          <div>
            <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-2">Severity</div>
            <div className="space-y-1.5">
              {Object.entries(SEVERITY_META).map(([sev, color]) => {
                const checked = severityFilter.includes(sev);
                return (
                  <label key={sev} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={checked} onChange={() => toggleSeverity(sev)} className="sr-only" />
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      checked ? 'bg-normal/20 border-normal' : 'border-line group-hover:border-dim'
                    }`}>
                      {checked && (
                        <svg className="w-2.5 h-2.5 text-normal" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-foreground capitalize">{sev}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Formation */}
          <div>
            <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-2">Formation</div>
            <select
              value={formationFilter}
              onChange={e => setFormationFilter(e.target.value)}
              className="w-full bg-background border border-line rounded px-3 py-2 text-sm text-foreground outline-none hover:border-dim transition-colors cursor-pointer"
            >
              <option value="">All formations</option>
              {FORMATIONS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Depth Range */}
          <div>
            <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-2">Depth Range (m MD)</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={depthFrom}
                onChange={e => setDepthFrom(e.target.value)}
                placeholder="From"
                className="w-full bg-background border border-line rounded px-2 py-1.5 text-sm text-foreground outline-none hover:border-dim transition-colors font-mono"
              />
              <span className="text-dim text-sm flex-shrink-0">–</span>
              <input
                type="number"
                value={depthTo}
                onChange={e => setDepthTo(e.target.value)}
                placeholder="To"
                className="w-full bg-background border border-line rounded px-2 py-1.5 text-sm text-foreground outline-none hover:border-dim transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        {/* Clear filters */}
        <div className="px-4 py-3 border-t border-line flex-shrink-0">
          <button
            onClick={clearFilters}
            className="text-[12px] text-dim hover:text-foreground transition-colors cursor-pointer underline underline-offset-2"
          >
            Clear all filters
          </button>
        </div>
      </div>

      {/* ══════ CENTER PANEL — Results Table ══════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Table header bar */}
        <div className="px-4 py-2.5 bg-panel border-b border-line flex-shrink-0 flex items-center gap-3">
          <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Event Explorer</h2>
          <span className="text-[11px] font-mono text-dim px-2 py-0.5 border border-line rounded">
            {filtered.length} / {allEvents.length}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-panel border-b border-line">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Well</th>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Type</th>
                <th
                  className="text-right px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('depth_md')}
                >
                  Depth (MD) <SortIndicator col="depth_md" />
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Formation</th>
                <th
                  className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('severity')}
                >
                  Severity <SortIndicator col="severity" />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-dim text-sm">
                    Loading events…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-dim text-sm">
                    No events match these filters.
                  </td>
                </tr>
              ) : (
                filtered.map(event => {
                  const isSelected = selectedEvent?.event_id === event.event_id;
                  return (
                    <tr
                      key={event.event_id}
                      onClick={() => setSelectedEvent(event)}
                      className={`border-b border-line cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-normal/8 border-l-2 border-l-normal'
                          : 'hover:bg-panel'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
                        {wellNameMap[event.well_id] || event.well_id}
                      </td>
                      <td className="px-4 py-2.5 text-foreground whitespace-nowrap">
                        {event.type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground whitespace-nowrap">
                        {event.depth_md} m
                      </td>
                      <td className="px-4 py-2.5 text-dim text-xs whitespace-nowrap max-w-[160px] truncate" title={event.formation}>
                        {event.formation}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <SeverityDot severity={event.severity} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════ RIGHT PANEL — Selected Event Detail ══════ */}
      <div className="w-[320px] flex-shrink-0 border-l border-line bg-panel flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-line flex-shrink-0">
          <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Event Detail</h2>
        </div>
        <div className="p-4 flex-1">
          {!selectedEvent ? (
            <div className="text-sm text-dim italic text-center mt-10">
              Select an event from the table to see details.
            </div>
          ) : (
            <EventDetailCard event={selectedEvent} />
          )}
        </div>
      </div>
    </div>
  );
}
