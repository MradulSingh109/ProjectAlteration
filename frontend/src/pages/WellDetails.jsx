import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getWell, getNearbyWells, getWellEvents } from '../api/wells.api';
import { getRealtime } from '../api/realtime.api';
import DepthTrack from '../components/wells/DepthTrack';
import EventDetailCard from '../components/events/EventDetailCard';

export default function WellDetails() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialWellId = searchParams.get('id') || 'DLJ-07';
  const autoEventId = searchParams.get('event') || null;
  
  const [wellId, setWellId] = useState(initialWellId);
  const [well, setWell] = useState(null);
  const [nearbyWells, setNearbyWells] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentDepth, setCurrentDepth] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const [comparedWellIds, setComparedWellIds] = useState([]);
  const [comparedWellsData, setComparedWellsData] = useState([]);

  useEffect(() => {
    // Reset comparison when main well changes
    setComparedWellIds([]);
  }, [wellId]);

  useEffect(() => {
    // Update URL if wellId changes internally via click
    setSearchParams({ id: wellId }, { replace: true });

    async function loadData() {
      setLoading(true);
      const w = await getWell(wellId);
      const nb = await getNearbyWells(wellId, 15); // 15km radius for offset wells list
      const evs = await getWellEvents(wellId);
      const rt = await getRealtime(wellId);
      
      setWell(w);
      setNearbyWells(nb);
      setEvents(evs);
      setCurrentDepth(rt?.length > 0 ? rt[0].depth : null);
      // Auto-select event if ?event= param is present
      if (autoEventId) {
        const found = evs.find(e => e.event_id === autoEventId);
        setSelectedEvent(found || null);
      } else {
        setSelectedEvent(null);
      }
      setLoading(false);
    }
    loadData();
  }, [wellId, setSearchParams]);

  useEffect(() => {
    async function loadComparedWells() {
      const data = [];
      for (const id of comparedWellIds) {
        const w = await getWell(id);
        const evs = await getWellEvents(id);
        const rt = await getRealtime(id);
        data.push({
          well: w,
          events: evs,
          currentDepth: rt?.length > 0 ? rt[0].depth : null,
        });
      }
      setComparedWellsData(data);
    }
    loadComparedWells();
  }, [comparedWellIds]);

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* ══════ LEFT PANEL (Well Profile) ══════ */}
      <div className="w-[340px] flex-shrink-0 bg-panel border-r border-line flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-line">
          {loading ? (
            <div className="text-sm text-dim">Loading well profile...</div>
          ) : well ? (
            <>
              <div className="flex items-center gap-1.5 text-dim text-[13px] mb-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{well.field}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground leading-tight mb-4">
                {well.name}
              </h1>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Formation</span>
                  <span className="font-semibold text-foreground">{well.formation}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dim">Status</span>
                  <span className="font-mono text-[12px] uppercase bg-background px-2 py-0.5 rounded border border-line text-dim">
                    {well.status}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-dim">Well not found.</div>
          )}
        </div>

        {/* Nearby / Offset Wells List */}
        <div className="p-4 flex-1">
          <div className="text-[11px] text-dim uppercase tracking-wider font-semibold mb-3">
            Offset Wells
          </div>
          <div className="space-y-2">
            {nearbyWells.map(nb => {
              const isCompared = comparedWellIds.includes(nb.well_id);
              return (
              <div
                key={nb.well_id}
                className="w-full text-left p-2.5 rounded border border-line bg-background hover:border-dim transition-colors group"
              >
                <div className="flex justify-between items-center mb-1">
                  <button 
                    onClick={() => setWellId(nb.well_id)}
                    className="font-bold text-sm text-foreground hover:text-normal transition-colors text-left"
                  >
                    {nb.name || nb.well_id}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-dim">
                      {(nb.distance_m / 1000).toFixed(1)} km
                    </span>
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 bg-background border-line rounded-sm text-normal focus:ring-normal focus:ring-offset-background cursor-pointer"
                      checked={isCompared}
                      onChange={() => {
                        setComparedWellIds(prev => 
                          prev.includes(nb.well_id) 
                            ? prev.filter(id => id !== nb.well_id) 
                            : [...prev, nb.well_id]
                        )
                      }}
                      title="Compare Depth Track"
                    />
                  </div>
                </div>
                <div className="text-[12px] text-dim">
                  {nb.formation}
                </div>
              </div>
            )})}
            {nearbyWells.length === 0 && !loading && (
              <div className="text-sm text-dim italic">No offset wells in radius.</div>
            )}
          </div>
        </div>
      </div>

      {/* ══════ CENTER PANEL (Depth Track) ══════ */}
      <div className="flex-1 flex overflow-x-auto min-w-0 bg-background">
        {/* Main Well */}
        <div className="flex-1 flex flex-col min-w-[450px] max-w-[800px] relative border-r border-line shrink-0">
          <div className="px-4 py-3 bg-panel border-b border-line flex-shrink-0 flex justify-between items-center">
            <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              {well?.name || wellId} (Active)
            </h2>
            <span className="text-[11px] font-mono text-dim px-2 py-0.5 border border-line rounded">
              {events.length} Events
            </span>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <span className="text-dim text-sm font-semibold">Loading events...</span>
              </div>
            ) : null}
            <DepthTrack 
              events={events} 
              currentDepth={currentDepth}
              selectedEventId={selectedEvent?.event_id}
              onSelectEvent={setSelectedEvent}
            />
          </div>
        </div>
        
        {/* Compared Wells */}
        {comparedWellsData.map(cw => (
          <div key={cw.well.well_id} className="flex-1 flex flex-col min-w-[450px] max-w-[800px] relative border-r border-line shrink-0">
            <div className="px-4 py-3 bg-panel border-b border-line flex-shrink-0 flex justify-between items-center">
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                {cw.well.name} (Compared)
              </h2>
              <button 
                onClick={() => setComparedWellIds(prev => prev.filter(id => id !== cw.well.well_id))}
                className="text-dim hover:text-danger text-[11px] font-semibold"
              >
                Close ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <DepthTrack 
                events={cw.events} 
                currentDepth={cw.currentDepth}
                selectedEventId={selectedEvent?.event_id}
                onSelectEvent={setSelectedEvent}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ══════ RIGHT PANEL (Event Detail) ══════ */}
      <div className="w-[320px] flex-shrink-0 border-l border-line bg-panel flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-line">
          <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
            Event Detail
          </h2>
        </div>

        <div className="p-4 flex-1">
          {!selectedEvent ? (
            <div className="text-sm text-dim italic text-center mt-10">
              Select an event on the depth track to see details.
            </div>
          ) : (
            <EventDetailCard event={selectedEvent} />
          )}
        </div>
      </div>
    </div>
  );
}

