// Replaces endpoints:
// GET /api/v1/events

import eventsData from '../data/events.json';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const getEvents = async (filters = {}) => {
  await delay();
  let results = [...eventsData];
  
  if (filters.type) {
    results = results.filter(e => e.type === filters.type);
  }
  if (filters.formation) {
    results = results.filter(e => e.formation === filters.formation);
  }
  if (filters.depth_from !== undefined) {
    results = results.filter(e => e.depth_md >= filters.depth_from);
  }
  if (filters.depth_to !== undefined) {
    results = results.filter(e => e.depth_md <= filters.depth_to);
  }
  
  return results;
};
