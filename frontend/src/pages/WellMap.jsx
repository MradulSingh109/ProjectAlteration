import { useEffect, useState } from 'react';
import { getWells, getNearbyWells } from '../api/wells.api';
import { getAlerts } from '../api/risk.api';
import { getRealtime } from '../api/realtime.api';
import { useSearchParams } from 'react-router-dom';
import MapCanvas from '../components/map/MapCanvas';
import RigInfoCard from '../components/dashboard/RigInfoCard';
import KpiTiles from '../components/dashboard/KpiTiles';
import DrillingChart from '../components/dashboard/DrillingChart';
import PipelineTemp from '../components/dashboard/PipelineTemp';
import IntegrityStatus from '../components/dashboard/IntegrityStatus';
import NearbyWellsList from '../components/wells/NearbyWellsList';

export default function WellMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [radius, setRadius] = useState(10);
  const activeWellId = searchParams.get('well') || 'DLJ-114';

  const setActiveWellId = (id) => {
    setSearchParams(prev => {
      prev.set('well', id);
      return prev;
    }, { replace: true });
  };

  const [allWells, setAllWells] = useState([]);
  const [activeWell, setActiveWell] = useState(null);
  const [nearbyWells, setNearbyWells] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [realtime, setRealtime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial load of all wells
  useEffect(() => {
    async function loadWells() {
      const wells = await getWells();
      setAllWells(wells);
    }
    loadWells();
  }, []);

  // Fetch active well data whenever activeWellId changes
  useEffect(() => {
    async function fetchActiveData() {
      if (allWells.length === 0) return;
      const active = allWells.find(w => w.well_id === activeWellId);
      setActiveWell(active);

      const activeAlerts = await getAlerts();
      setAlerts(activeAlerts.filter(a => a.status === 'open'));

      const rt = await getRealtime(activeWellId);
      setRealtime(rt);
    }
    fetchActiveData();
  }, [activeWellId, allWells]);

  useEffect(() => {
    async function fetchNearby() {
      setLoading(true);
      const nearby = await getNearbyWells(activeWellId, radius);
      setNearbyWells(nearby);
      setLoading(false);
    }
    fetchNearby();
  }, [radius]);

  const highAlerts = alerts.filter(a => a.level === 'HIGH');
  
  // Search logic for dropdown
  const searchHits = searchQuery.trim() 
    ? allWells.filter(w => 
        (w.name || w.well_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.formation.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="h-full flex overflow-hidden">
      {/* ══════ LEFT PANEL ══════ */}
      <div className="w-[340px] flex-shrink-0 bg-panel border-r border-line flex flex-col overflow-y-visible">
        {/* Search bar */}
        <div className="px-4 pt-4 pb-3 relative z-50">
          <div className="flex items-center bg-background border border-line rounded px-3 py-2 gap-2">
            <svg className="w-4 h-4 text-dim flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="search-well-model"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search wells to switch..."
              className="bg-transparent text-sm text-foreground placeholder:text-dim outline-none w-full"
            />
            <span className="text-dim text-[11px] border border-line rounded px-1.5 py-0.5 font-mono flex-shrink-0">⌘K</span>
          </div>

          {/* Autocomplete Dropdown */}
          {searchHits.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-1 bg-background border border-line rounded shadow-lg overflow-hidden flex flex-col">
              {searchHits.map(hit => (
                <button
                  key={hit.well_id}
                  className="px-3 py-2 text-left hover:bg-panel transition-colors flex items-center justify-between"
                  onClick={() => {
                    setActiveWellId(hit.well_id);
                    setSearchQuery('');
                  }}
                >
                  <span className="text-sm font-semibold text-foreground">{hit.name || hit.well_id}</span>
                  <span className="text-[10px] text-dim">{hit.formation}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Location header */}
        <div className="px-4 pb-4">
          {activeWell ? (
            <>
              <div className="flex items-center gap-1.5 text-dim text-[13px] mb-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Upper Assam, Duliajan Field</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground leading-tight mb-4">
                {activeWell.name}
              </h1>

              {/* Reserve stats */}
              {/* // demo flavor, not in shared contract, static/synthetic */}
              <div className="space-y-2.5 mb-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-foreground bg-danger/15 border border-danger/30 rounded px-2 py-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-danger" />
                    Estimated Oil Reserve
                  </span>
                  <span className="text-sm text-foreground font-mono">892,291,219 barrels</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-foreground bg-normal/15 border border-normal/30 rounded px-2 py-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-normal" />
                    Daily Production Rate
                  </span>
                  <span className="text-sm text-foreground font-mono">18,500 barrels/day</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-dim py-4">Loading well data...</div>
          )}
        </div>

        {/* Rig Info Card */}
        <div className="px-4 pb-4">
          <RigInfoCard wellId={activeWellId} />
        </div>

        {/* KPI Tiles */}
        <div className="px-4 pb-4 mt-auto">
          <KpiTiles realtime={realtime} />
        </div>
      </div>

      {/* ══════ CENTER + RIGHT ══════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map + right panel row */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Map */}
            <div className="flex-1 relative min-h-0">
              <MapCanvas activeWell={activeWell} nearbyWells={nearbyWells} radius={radius} />
              {loading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-[1000]">
                  <div className="text-normal font-bold bg-panel px-4 py-2 rounded border border-line shadow-lg">Loading Map Data...</div>
                </div>
              )}
              {/* Scale bar overlay */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500]">
                <ScaleBar />
              </div>
            </div>

            {/* Bottom charts row */}
            <div className="flex-shrink-0 flex border-t border-line" style={{ height: '220px' }}>
              {/* Drilling Parameters Chart */}
              <div className="flex-1 border-r border-line">
                <DrillingChart realtime={realtime} />
              </div>
              {/* Pipeline Temperature */}
              <div className="w-[340px] flex-shrink-0">
                <PipelineTemp />
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-[300px] flex-shrink-0 border-l border-line bg-panel flex flex-col overflow-y-auto">
            <IntegrityStatus alerts={alerts} highAlerts={highAlerts} />
            <NearbyWellsList nearbyWells={nearbyWells} activeWellId={activeWellId} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Scale bar overlay — mimics topographic map scale indicators. */
function ScaleBar() {
  const segments = [
    { label: '250,000', width: 40 },
    { label: '20,000', width: 50 },
    { label: '15,000', width: 50 },
    { label: '10,000', width: 50 },
    { label: '5,000', width: 50 },
    { label: '0', width: 0 },
  ];

  return (
    <div className="flex items-end">
      {segments.filter(s => s.width > 0).map((seg, i) => (
        <div key={i} className="flex flex-col items-center" style={{ width: seg.width }}>
          <span className="text-[9px] text-dim font-mono mb-0.5">{seg.label}</span>
          <div className={`w-full h-[3px] ${i % 2 === 0 ? 'bg-foreground/40' : 'bg-foreground/20'}`} />
        </div>
      ))}
      <div className="flex flex-col items-center">
        <span className="text-[9px] text-dim font-mono mb-0.5">0</span>
      </div>
    </div>
  );
}
