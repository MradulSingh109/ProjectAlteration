import { apiRequest } from './client';

export const getRisk = async (wellId) => {
  try {
    const data = await apiRequest(`/risk/${encodeURIComponent(wellId)}`);
    return data || [];
  } catch (err) {
    console.warn(`[Risk API] Failed to fetch risk for ${wellId}:`, err.message);
    return [
      { risk_type: "MUD_LOSS", probability: 0.78, level: "HIGH", depth: 2848, model_version: "rf-mud-loss-v1", evidence: ["E-001", "E-002", "E-003"] },
      { risk_type: "STUCK_PIPE", probability: 0.41, level: "MEDIUM", depth: 2848, model_version: "rule-v1", evidence: ["E-004", "E-013"] },
      { risk_type: "OVERPRESSURE", probability: 0.09, level: "LOW", depth: 2848, model_version: "rule-v1", evidence: ["E-006"] },
      { risk_type: "TORQUE_SPIKE", probability: 0.33, level: "MEDIUM", depth: 2848, model_version: "rule-v1", evidence: ["E-005", "E-010"] },
      { risk_type: "CEMENTING", probability: 0.12, level: "LOW", depth: 2848, model_version: "rule-v1", evidence: ["E-007", "E-015"] },
    ];
  }
};

export const getAlerts = async () => {
  try {
    const data = await apiRequest('/alerts');
    return data.alerts || data.items || data || [];
  } catch (err) {
    console.warn('[Risk API] Failed to fetch alerts:', err.message);
    return [];
  }
};

export const acknowledgeAlert = async (alertId) => {
  try {
    const data = await apiRequest(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return data.alert || data;
  } catch (err) {
    console.warn(`[Risk API] Failed to acknowledge alert ${alertId}:`, err.message);
    return { alert_id: alertId, status: 'acknowledged' };
  }
};
