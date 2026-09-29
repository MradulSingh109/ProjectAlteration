import { apiRequest } from './client';

export const getDocuments = async () => {
  const data = await apiRequest('/documents');
  const docs = data.documents || data.items || data || [];

  return docs.map((d) => ({
    id: d.id,
    document_id: d.document_id || d.documentId || d.id,
    filename: d.filename,
    type: d.documentType || d.type || 'DDR',
    well_id: d.well_id || d.wellId,
    well_name: d.wellName || d.well_id || d.wellId,
    status: d.status || (d.ingestionStatus === 'COMPLETED' ? 'indexed' : 'uploaded'),
    events_extracted: d.events_extracted !== undefined ? d.events_extracted : d.eventsExtracted || 0,
    uploaded_at: d.uploadedAt || d.uploaded_at,
  }));
};

export const getDocumentStatus = async (documentId) => {
  try {
    const data = await apiRequest(`/documents/${encodeURIComponent(documentId)}/metadata`);
    const doc = data.document || data;
    return doc.ingestionStatus === 'COMPLETED' ? 'indexed' : doc.ingestionStatus?.toLowerCase() || 'uploaded';
  } catch (err) {
    console.warn(`[Documents API] Failed to fetch status for ${documentId}:`, err.message);
    return null;
  }
};
