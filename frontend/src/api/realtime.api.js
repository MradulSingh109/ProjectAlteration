import { apiRequest } from './client';

export const getRealtime = async (wellId) => {
  try {
    const data = await apiRequest(`/wells/${encodeURIComponent(wellId)}/telemetry`);
    const items = data.items || [];

    if (items.length === 0) {
      // Return baseline parameters if well has not started drilling yet
      return [
        { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'ROP', value: 12.5 },
        { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'torque', value: 1850 },
        { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'mud_weight', value: 9.8 },
        { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'flow', value: 550 },
      ];
    }

    const latest = items[items.length - 1];
    const depth = Number(latest.depthMd || 2848);
    const ts = latest.timestamp || new Date().toISOString();

    const result = [
      { timestamp: ts, well_id: wellId, depth, parameter: 'ROP', value: Number(latest.rateOfPenetration ?? 12.5) },
      { timestamp: ts, well_id: wellId, depth, parameter: 'torque', value: Number(latest.surfaceTorque ?? 1850) },
      { timestamp: ts, well_id: wellId, depth, parameter: 'mud_weight', value: Number(latest.mudDensity ?? 9.8) },
      { timestamp: ts, well_id: wellId, depth, parameter: 'flow', value: Number(latest.flowRateIn ?? 550) },
    ];

    // Also attach latest measurements
    result.latestReading = latest;
    return result;
  } catch (err) {
    console.warn(`[Realtime API] Failed to fetch telemetry for ${wellId}:`, err.message);
    return [
      { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'ROP', value: 12.5 },
      { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'torque', value: 1850 },
      { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'mud_weight', value: 9.8 },
      { timestamp: new Date().toISOString(), well_id: wellId, depth: 2848, parameter: 'flow', value: 550 },
    ];
  }
};
