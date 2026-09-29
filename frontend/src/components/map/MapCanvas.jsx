import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, Circle, Rectangle } from 'react-leaflet';
import { Link } from 'react-router-dom';

/**
 * MapCanvas — Leaflet map centered on Upper Assam / Duliajan.
 * Shows active well with pulsing marker, radius circle, and offset wells.
 * Uses a topographic/terrain tile layer matching the reference design.
 * Leaflet pathOptions colors use hardcoded hex (Leaflet doesn't read CSS vars
 * at path-draw time) — values match the active theme tokens for both themes.
 * The tile layer CSS filter is set in index.css via .map-tiles-grayscale and
 * reads var(--map-filter), which is tuned per theme.
 */

// We must pass actual hex values to Leaflet (it doesn't interpolate CSS vars).
// These should match the corresponding CSS token values.
const COLORS = {
  rust:  '#c1440e', // var(--rust) dark — acceptable for both themes (Leaflet can't read vars)
  steel: '#5f7f8f', // var(--steel) dark
  dim:   '#a89a83', // var(--ink-dim) dark
  ink:   '#ece3d3', // var(--ink) dark
};

export default function MapCanvas({ activeWell, nearbyWells, radius }) {
  const center = [27.35, 95.30];

  // Selection rectangle bounds (visual indicator around active drilling area)
  const selectionBounds = activeWell
    ? [
        [activeWell.lat - 0.06, activeWell.lon - 0.08],
        [activeWell.lat + 0.06, activeWell.lon + 0.08],
      ]
    : null;

  return (
    <MapContainer
      center={center}
      zoom={11}
      className="h-full w-full"
      zoomControl={true}
      attributionControl={false}
    >
      {/* Topographic/terrain tile — grayscale filter from CSS var(--map-filter) */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        className="map-tiles-grayscale"
      />

      {/* Selection rectangle (dashed border like the reference) */}
      {selectionBounds && (
        <Rectangle
          bounds={selectionBounds}
          pathOptions={{
            color: COLORS.rust,
            fillColor: COLORS.rust,
            fillOpacity: 0.03,
            weight: 1.5,
            dashArray: '8 5',
          }}
        />
      )}

      {/* Radius circle */}
      {activeWell && (
        <Circle
          center={[activeWell.lat, activeWell.lon]}
          radius={radius * 1000}
          pathOptions={{
            color: COLORS.steel,
            fillColor: COLORS.steel,
            fillOpacity: 0.04,
            weight: 1,
            dashArray: '6 4',
          }}
        />
      )}

      {/* Active well marker — distinct styling */}
      {activeWell && (
        <>
          {/* Outer pulse ring */}
          <CircleMarker
            center={[activeWell.lat, activeWell.lon]}
            radius={14}
            pathOptions={{
              color: COLORS.rust,
              fillColor: COLORS.rust,
              fillOpacity: 0.15,
              weight: 1,
            }}
          />
          {/* Core marker */}
          <CircleMarker
            center={[activeWell.lat, activeWell.lon]}
            radius={7}
            pathOptions={{
              color: COLORS.ink,
              fillColor: COLORS.rust,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -12]}>
              {activeWell.name} (Active)
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {/* Nearby wells */}
      {nearbyWells.map(well => {
        const isMatch = well.formation_match;
        const highSim = well.similarity_score >= 0.8;
        const color = isMatch ? COLORS.steel : COLORS.dim;

        return (
          <CircleMarker
            key={well.well_id}
            center={[well.lat, well.lon]}
            radius={highSim ? 6 : 5}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: highSim ? 0.9 : 0.5,
              weight: highSim ? 2 : 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {well.name || well.well_id}
            </Tooltip>
            <Popup>
              <div className="text-sm leading-relaxed">
                <div className="font-bold text-foreground mb-1">{well.name || well.well_id}</div>
                <div className="space-y-0.5 text-[13px] mb-2">
                  <div><span className="text-dim">Formation:</span> {well.formation}</div>
                  <div><span className="text-dim">Similarity:</span> <span className="font-mono font-bold">{(well.similarity_score * 100).toFixed(0)}%</span></div>
                  <div><span className="text-dim">Distance:</span> <span className="font-mono">{(well.distance_m / 1000).toFixed(1)} km</span></div>
                  <div>
                    <span className="text-dim">Match:</span>{' '}
                    <span className={isMatch ? 'text-normal' : 'text-dim'}>{isMatch ? 'Yes' : 'No'}</span>
                  </div>
                </div>
                <Link
                  to={`/wells?id=${well.well_id}`}
                  className="block text-center bg-background border border-line text-foreground text-xs py-1 rounded hover:bg-panel-alt transition-colors"
                >
                  View Details
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
