import { apiRequest } from './client';

export async function queryAssistant(query, wellId = null) {
  try {
    const payload = {
      query,
      question: query,
      wellId: wellId || undefined,
      topK: 4,
    };

    const res = await apiRequest('/assistant', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const sources = res.sources || [];

    const citations = sources.map((s) => ({
      document: s.document_id || 'Document',
      page: s.page || 1,
      event_id: s.well_id ? `${s.well_id}-EV` : (s.document_id || 'DOC'),
      snippet: s.text_snippet || '',
    }));

    const relevantWells = [
      ...new Set(
        sources
          .map((s) => s.well_id)
          .filter(Boolean)
          .concat(wellId ? [wellId] : [])
      ),
    ];

    let confidenceLevel = 'low';
    const confVal = typeof res.confidence === 'number' ? res.confidence : 0.85;
    if (confVal >= 0.8) confidenceLevel = 'high';
    else if (confVal >= 0.5) confidenceLevel = 'medium';

    return {
      answer: res.answer || "I found relevant operational records for your query.",
      citations,
      relevant_wells: relevantWells,
      confidence: confidenceLevel,
      sources,
    };
  } catch (err) {
    console.warn('[Assistant API] RAG query fallback:', err.message);
    return {
      answer: `Unable to query live AI Assistant (${err.message}). Please verify the backend and ML services are running.`,
      citations: [],
      relevant_wells: wellId ? [wellId] : [],
      confidence: 'low',
    };
  }
}
