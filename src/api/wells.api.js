// Replaces endpoints:
// GET /api/v1/wells
// GET /api/v1/wells/{well_id}
// GET /api/v1/wells/{well_id}/nearby?radius_km=...
// GET /api/v1/wells/{well_id}/events
// GET /api/v1/wells/{well_id}/timeline?depth_from=...&depth_to=...

import wellsData from '../data/wells.json';
import nearbyData from '../data/nearby.json';
import eventsData from '../data/events.json';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const getWells = async () => {
  await delay();
  return wellsData;
};

export const getWell = async (wellId) => {
  await delay();
  return wellsData.find(w => w.well_id === wellId);
};

export const getNearbyWells = async (wellId, radiusKm) => {
  await delay();
  // Filter nearby.json by distance
  const maxDist = radiusKm * 1000;
  const filtered = nearbyData.filter(n => n.distance_m <= maxDist);
  
  // Merge lat/lon/name/formation from wells.json
  return filtered.map(n => {
    const wellInfo = wellsData.find(w => w.well_id === n.well_id) || {};
    return {
      ...n,
      lat: wellInfo.lat,
      lon: wellInfo.lon,
      name: wellInfo.name,
      formation: wellInfo.formation
    };
  });
};

export const getWellEvents = async (wellId) => {
  await delay();
  return eventsData.filter(e => e.well_id === wellId);
};

export const getTimeline = async (wellId, depthFrom, depthTo) => {
  await delay();
  // Returns events from the nearby wells inside that depth range, sorted by depth
  // wellId here is the active well. We want events from nearby wells.
  const nearbyWellIds = nearbyData.map(n => n.well_id);
  
  const events = eventsData.filter(e => {
    const isNearby = nearbyWellIds.includes(e.well_id);
    const inRange = e.depth_md >= depthFrom && e.depth_md <= depthTo;
    return isNearby && inRange;
  });
  
  return events.sort((a, b) => a.depth_md - b.depth_md);
};

export const getWellComparisonStats = async (wellIds) => {
  await delay();
  return wellIds.map(id => {
    const wellProfile = wellsData.find(w => w.well_id === id) || {};
    const nearbyProfile = nearbyData.find(n => n.well_id === id) || {};
    const wellEvents = eventsData.filter(e => e.well_id === id);

    const severityCount = { high: 0, medium: 0, low: 0 };
    const typeCount = {};
    let deepest = null;
    let shallowest = null;

    wellEvents.forEach(e => {
      if (e.severity) {
        severityCount[e.severity] = (severityCount[e.severity] || 0) + 1;
      }
      if (e.type) {
        typeCount[e.type] = (typeCount[e.type] || 0) + 1;
      }
      
      if (e.depth_md !== undefined) {
        if (deepest === null || e.depth_md > deepest) deepest = e.depth_md;
        if (shallowest === null || e.depth_md < shallowest) shallowest = e.depth_md;
      }
    });

    return {
      well_id: id,
      name: wellProfile.name,
      formation: wellProfile.formation,
      status: wellProfile.status,
      distance_m: nearbyProfile.distance_m || 0,
      similarity_score: nearbyProfile.similarity_score || 0,
      formation_match: nearbyProfile.formation_match !== undefined ? nearbyProfile.formation_match : (wellProfile.formation ? true : false),
      totalEvents: wellEvents.length,
      severityCount,
      typeCount,
      deepest,
      shallowest
    };
  });
};
