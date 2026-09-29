import { apiRequest } from './client';

export const getEvents = async (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.well_id) params.append('wellId', filters.well_id);
  if (filters.type) params.append('type', filters.type);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.formation) params.append('formation', filters.formation);
  if (filters.depth_from !== undefined && filters.depth_from !== '') {
    params.append('depth_from', filters.depth_from);
  }
  if (filters.depth_to !== undefined && filters.depth_to !== '') {
    params.append('depth_to', filters.depth_to);
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const data = await apiRequest(`/events${queryString}`);
  const events = data.events || data.items || data || [];

  return events.map((e) => ({
    ...e,
    event_id: e.eventId || e.event_id || e.id,
    well_id: e.wellId || e.well_id,
    well_name: e.wellName || e.wellId || e.well_id,
    type: (e.eventType || e.type || '').toLowerCase(),
    depth_md: Number(e.depthMd !== undefined ? e.depthMd : e.depth_md),
    formation: e.formation || 'Barail Sandstone',
    severity: (e.severity || 'low').toLowerCase(),
    description: e.description || '',
    evidence: e.evidence || {
      document: e.sourceDocument || 'DDR',
      page: e.sourcePage || 1,
      note: e.mitigation || e.description || '',
    },
    reviewStatus: e.reviewStatus || 'APPROVED',
  }));
};
