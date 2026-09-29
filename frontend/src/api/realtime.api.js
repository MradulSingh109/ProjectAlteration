// Replaces: GET /api/v1/wells/{well_id}/realtime
import realtimeData from '../data/realtime.json';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const getRealtime = async (wellId) => {
  await delay();
  return realtimeData.filter(r => r.well_id === wellId);
};
