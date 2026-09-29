import fs from 'fs';
import path from 'path';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const dataPath = path.resolve('./src/data/wells.json');
const outPath = path.resolve('./src/data/nearby.json');

const wells = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const activeWell = wells.find(w => w.status === 'active');
const completedWells = wells.filter(w => w.status === 'completed');

const similarityScores = {
  'DLJ-098': 0.88, // Near, same formation, high score
  'DLJ-101': 0.92, // Far, same formation, high score
  'DLJ-105': 0.85, // Same formation
  'DLJ-110': 0.81, // Same formation
  'DLJ-080': 0.30, // Near, diff formation, low score
  'DLJ-092': 0.15,
  'DLJ-112': 0.25
};

const nearby = completedWells.map(w => {
  const distance = Math.round(haversine(activeWell.lat, activeWell.lon, w.lat, w.lon));
  return {
    well_id: w.well_id,
    distance_m: distance,
    similarity_score: similarityScores[w.well_id] || 0.5,
    formation_match: w.formation === activeWell.formation
  };
});

fs.writeFileSync(outPath, JSON.stringify(nearby, null, 2));
console.log(`Wrote ${nearby.length} nearby wells to ${outPath}`);
