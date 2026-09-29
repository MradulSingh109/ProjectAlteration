// Replaces endpoints:
// GET /api/v1/risk/{well_id}
// GET /api/v1/alerts
// POST /api/v1/alerts/{alert_id}/acknowledge

import riskData from '../data/risk.json';
import alertsData from '../data/alerts.json';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Keep a mutable copy of alerts in memory so we can acknowledge them
let mutableAlerts = [...alertsData];

export const getRisk = async (wellId) => {
  await delay();
  // Returning risk data for the well (in our synthetic data, it's all for the active well)
  return riskData;
};

export const getAlerts = async () => {
  await delay();
  return mutableAlerts;
};

export const acknowledgeAlert = async (alertId) => {
  await delay();
  mutableAlerts = mutableAlerts.map(a => 
    a.alert_id === alertId ? { ...a, status: 'acknowledged' } : a
  );
  return mutableAlerts.find(a => a.alert_id === alertId);
};
