import { apiRequest } from './client';

// Schema normalizer for well entities
function normalizeWell(w) {
  if (!w) return null;
  const formationName =
    w.formations && w.formations.length > 0
      ? w.formations[0].name
      : w.formation || 'Barail Sandstone';

  return {
    ...w,
    id: w.id,
    well_id: w.wellId || w.well_id,
    name: w.name || w.wellId || w.well_id,
    field: w.field || 'Duliajan',
    lat: Number(w.latitude !== undefined ? w.latitude : w.lat),
    lon: Number(w.longitude !== undefined ? w.longitude : w.lon),
    latitude: Number(w.latitude !== undefined ? w.latitude : w.lat),
    longitude: Number(w.longitude !== undefined ? w.longitude : w.lon),
    formation: formationName,
    status: (w.status || 'COMPLETED').toLowerCase() === 'drilling' ? 'active' : (w.status || 'completed').toLowerCase(),
    plannedDepthMd: w.plannedDepthMd ? Number(w.plannedDepthMd) : 3500,
  };
}

export const getWells = async () => {
  const data = await apiRequest('/wells');
  const wells = data.wells || data.items || data || [];
  return wells.map(normalizeWell);
};

export const getWell = async (wellId) => {
  const data = await apiRequest(`/wells/${encodeURIComponent(wellId)}`);
  const well = data.well || data;
  return normalizeWell(well);
};

export const getNearbyWells = async (wellId, radiusKm = 25) => {
  try {
    const data = await apiRequest(`/wells/${encodeURIComponent(wellId)}/offsets?radiusKm=${radiusKm}`);
    const items = data.items || [];

    return items.map((n) => {
      const off = n.offsetWell || {};
      const formationName =
        n.formationMatches && n.formationMatches.length > 0
          ? n.formationMatches[0].formation
          : 'Barail Sandstone';

      return {
        well_id: off.wellId,
        name: off.name || off.wellId,
        field: off.field,
        lat: Number(off.latitude),
        lon: Number(off.longitude),
        distance_m: Math.round((n.distanceKm || 0) * 1000),
        similarity_score: Number((n.relevanceScore?.score ?? 0).toFixed(2)),
        formation_match: (n.formationMatches || []).length > 0,
        formation: formationName,
        status: (off.status || 'COMPLETED').toLowerCase(),
        totalEvents: n.historicalEvents?.totalEvents ?? 0,
        severityCount: n.historicalEvents?.bySeverity || {},
        typeCount: n.historicalEvents?.byEventType || {},
      };
    });
  } catch (err) {
    console.warn(`[Wells API] Failed to fetch offsets for ${wellId}:`, err.message);
    return [];
  }
};

export const getWellEvents = async (wellId) => {
  try {
    const data = await apiRequest(`/wells/${encodeURIComponent(wellId)}/events`);
    const events = data.events || data.items || [];
    return events.map((e) => ({
      ...e,
      event_id: e.eventId || e.event_id || e.id,
      well_id: e.wellId || e.well_id || wellId,
      type: (e.eventType || e.type || '').toLowerCase(),
      depth_md: Number(e.depthMd !== undefined ? e.depthMd : e.depth_md),
      formation: e.formation || 'Barail Sandstone',
      severity: (e.severity || 'low').toLowerCase(),
      evidence: e.evidence || {
        document: e.sourceDocument || 'DDR',
        page: e.sourcePage || 1,
        note: e.mitigation || e.description || '',
      },
    }));
  } catch (err) {
    console.warn(`[Wells API] Failed to fetch events for ${wellId}:`, err.message);
    return [];
  }
};

export const getTimeline = async (wellId, depthFrom = 0, depthTo = 5000) => {
  try {
    const nearby = await getNearbyWells(wellId, 50);
    const nearbyWellIds = nearby.map((n) => n.well_id);

    // Fetch events across all wells via /events
    const data = await apiRequest(`/events?depth_from=${depthFrom}&depth_to=${depthTo}`);
    const allEvents = data.events || data.items || [];

    const filtered = allEvents.filter((e) => {
      const isNearby = nearbyWellIds.includes(e.well_id) || e.well_id === wellId;
      const inRange = e.depth_md >= depthFrom && e.depth_md <= depthTo;
      return isNearby && inRange;
    });

    return filtered.sort((a, b) => a.depth_md - b.depth_md);
  } catch (err) {
    console.warn('[Wells API] Failed to fetch timeline:', err.message);
    return [];
  }
};

export const getWellComparisonStats = async (wellIds = []) => {
  const results = [];
  for (const id of wellIds) {
    try {
      const [well, events] = await Promise.all([getWell(id), getWellEvents(id)]);
      const severityCount = { high: 0, medium: 0, low: 0 };
      const typeCount = {};
      let deepest = null;
      let shallowest = null;

      events.forEach((e) => {
        const sev = (e.severity || 'low').toLowerCase();
        if (severityCount[sev] !== undefined) severityCount[sev]++;
        if (e.type) typeCount[e.type] = (typeCount[e.type] || 0) + 1;
        if (e.depth_md !== undefined) {
          if (deepest === null || e.depth_md > deepest) deepest = e.depth_md;
          if (shallowest === null || e.depth_md < shallowest) shallowest = e.depth_md;
        }
      });

      results.push({
        well_id: id,
        name: well?.name || id,
        formation: well?.formation || 'Barail Sandstone',
        status: well?.status || 'completed',
        distance_m: 0,
        similarity_score: 1.0,
        formation_match: true,
        totalEvents: events.length,
        severityCount,
        typeCount,
        deepest: deepest ?? 0,
        shallowest: shallowest ?? 0,
      });
    } catch (e) {
      console.warn(`[Wells API] Compare failed for ${id}:`, e.message);
    }
  }
  return results;
};
