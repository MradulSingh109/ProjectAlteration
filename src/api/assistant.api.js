// mock retrieval only. Real implementation is RAG over pgvector per plan Phase 5, replace this function only once backend/assistant.api is live — see POST /api/v1/assistant/query

import eventsData from '../data/events.json';

// Simple delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function queryAssistant(query, wellId) {
  // Simulate network latency (500-800ms)
  await delay(500 + Math.random() * 300);

  const lowerQuery = query.toLowerCase();
  
  // Keyword matching
  // Matches on event type, formation, and evidence note text
  const matches = eventsData.filter(event => {
    // If scoped by well_id, reject non-matching wells
    if (wellId && event.well_id !== wellId) return false;

    const typeHit = event.type.replace(/_/g, ' ').toLowerCase().includes(lowerQuery);
    const formationHit = event.formation.toLowerCase().includes(lowerQuery);
    const noteHit = event.evidence?.note?.toLowerCase().includes(lowerQuery);
    
    // Some basic keyword intersections
    const keywords = lowerQuery.split(' ').filter(w => w.length > 3);
    const textCorpus = `${event.type.replace(/_/g, ' ')} ${event.formation} ${event.evidence?.note || ''}`.toLowerCase();
    const keywordHits = keywords.filter(kw => textCorpus.includes(kw));
    
    // Consider a match if exact hit on fields, or at least 1 significant keyword matched
    return typeHit || formationHit || noteHit || (keywords.length > 0 && keywordHits.length > 0);
  });

  // Sort by depth (or could be relevance), just taking top 4
  const topMatches = matches.slice(0, 4);
  const relevantWells = [...new Set(topMatches.map(m => m.well_id))];

  // Determine confidence
  let confidence = 'low';
  if (topMatches.length >= 3) confidence = 'high';
  else if (topMatches.length >= 1) confidence = 'medium';

  // Build plain-language answer
  let answer = '';
  if (topMatches.length === 0) {
    answer = `I couldn't find any relevant events matching your query${wellId ? ` for well ${wellId}` : ''}.`;
  } else {
    const types = [...new Set(topMatches.map(m => m.type.replace(/_/g, ' ')))];
    const depths = topMatches.map(m => m.depth_md);
    const minDepth = Math.min(...depths);
    const maxDepth = Math.max(...depths);
    const topEvent = topMatches[0];
    
    answer = `I found ${matches.length} similar event${matches.length === 1 ? '' : 's'}${wellId ? ` on ${wellId}` : ''}. `;
    answer += `They primarily involve ${types.join(' and ')} `;
    answer += `occurring between ${minDepth}m and ${maxDepth}m. `;
    answer += `The most relevant was a ${topEvent.type.replace(/_/g, ' ')} at ${topEvent.depth_md}m in the ${topEvent.formation} formation.`;
  }

  // Format citations
  const citations = topMatches.map(m => ({
    document: m.evidence?.source_document || 'Unknown',
    page: m.evidence?.page || 1,
    event_id: m.event_id
  }));

  return {
    answer,
    confidence,
    citations,
    relevant_wells: relevantWells,
    limitations: "Mock local retrieval based on substring matching. Not a real LLM."
  };
}
