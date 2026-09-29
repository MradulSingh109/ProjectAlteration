// Replaces endpoints:
// GET /api/v1/documents
// GET /api/v1/documents/{id}/status
// POST /api/v1/documents

import documentsData from '../data/documents.json';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const getDocuments = async () => {
  await delay();
  return documentsData;
};

export const getDocumentStatus = async (documentId) => {
  await delay();
  const doc = documentsData.find(d => d.document_id === documentId);
  return doc ? doc.status : null;
};
