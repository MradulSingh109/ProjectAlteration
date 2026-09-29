import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getDocuments } from '../api/documents.api';
import { getWells } from '../api/wells.api';

// Status metadata — dot color and label
const STATUS_META = {
  uploaded:   { color: 'var(--steel)', label: 'Uploaded',   pulse: false },
  ocr:        { color: 'var(--ochre)', label: 'OCR',         pulse: true  },
  extracting: { color: 'var(--ochre)', label: 'Extracting',  pulse: true  },
  indexed:    { color: 'var(--olive)', label: 'Indexed',     pulse: false },
  failed:     { color: 'var(--rust)',  label: 'Failed',      pulse: false },
};

const PIPELINE_STAGES = ['uploaded', 'ocr', 'extracting', 'indexed'];

function StatusDot({ status }) {
  const meta = STATUS_META[status] || { color: '#a89a83', label: status, pulse: false };
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.pulse ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: meta.color }}
      />
      <span style={{ color: meta.color }} className="text-[12px] font-medium">{meta.label}</span>
    </span>
  );
}

let docIdCounter = 200;

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  // Track active progression timers so we can clear them on unmount
  const timersRef = useRef([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [ds, ws] = await Promise.all([getDocuments(), getWells()]);
      setDocs(ds);
      setWells(ws);
      setLoading(false);
    }
    load();
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const wellNameMap = {};
  wells.forEach(w => { wellNameMap[w.well_id] = w.name; });

  // simulated pipeline progression, replaced by real status polling once
  // backend is ready — see getDocumentStatus in documents.api.js
  function progressDocument(docId) {
    PIPELINE_STAGES.forEach((stage, i) => {
      if (i === 0) return; // already set to 'uploaded'
      const t = setTimeout(() => {
        setDocs(prev => prev.map(d => {
          if (d.document_id !== docId) return d;
          const updates = { status: stage };
          if (stage === 'indexed') {
            updates.events_extracted = Math.floor(Math.random() * 8) + 2; // 2–9
          }
          return { ...d, ...updates };
        }));
      }, i * 2000); // 2s per stage
      timersRef.current.push(t);
    });
  }

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.name.toLowerCase().endsWith('.pdf')) return;
      docIdCounter += 1;
      const newDocId = `DOC-${docIdCounter}`;
      // Infer a well_id from filename if possible (e.g. DLJ_114) — else use DLJ-114 default
      const match = file.name.match(/DLJ[_-](\d+)/i);
      const wellId = match ? `DLJ-${match[1]}` : 'DLJ-114';
      const docType = file.name.toUpperCase().startsWith('WCR') ? 'WCR' : 'DDR';
      const newDoc = {
        document_id: newDocId,
        filename: file.name,
        type: docType,
        well_id: wellId,
        status: 'uploaded',
        events_extracted: 0,
        uploaded_at: new Date().toISOString(),
        _isNew: true,
      };
      setDocs(prev => [newDoc, ...prev]);
      progressDocument(newDocId);
    });
  }

  function retryDoc(docId) {
    setDocs(prev => prev.map(d =>
      d.document_id === docId ? { ...d, status: 'uploaded', events_extracted: 0 } : d
    ));
    progressDocument(docId);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="h-full flex overflow-hidden bg-background">

      {/* ══════ LEFT PANEL — Upload ══════ */}
      <div className="w-[300px] flex-shrink-0 bg-panel border-r border-line flex flex-col">
        <div className="px-4 py-3 border-b border-line flex-shrink-0">
          <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Upload Document</h2>
        </div>

        <div className="flex-1 p-4 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded border-2 border-dashed cursor-pointer transition-all select-none ${
              dragOver
                ? 'border-normal bg-normal/10'
                : 'border-line hover:border-dim hover:bg-background/50'
            }`}
            style={{ minHeight: '160px' }}
          >
            <svg className={`w-8 h-8 ${dragOver ? 'text-normal' : 'text-dim'} transition-colors`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground mb-1">
                {dragOver ? 'Drop to upload' : 'Drag & drop or click to browse'}
              </div>
              <div className="text-[12px] text-dim">.pdf files only</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="sr-only"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {/* Supported types notice */}
          <div className="text-[12px] text-dim leading-relaxed border border-line rounded p-3 bg-background">
            <div className="font-semibold text-foreground mb-1">Supported document types</div>
            <div>WCR (Well Completion Report), DDR (Daily Drilling Report)</div>
            <div className="mt-2 text-dim/70 italic">
              This is a synthetic demo pipeline — uploads progress through OCR → Extracting → Indexed automatically.
            </div>
          </div>
        </div>
      </div>

      {/* ══════ CENTER PANEL — Document List ══════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-4 py-2.5 bg-panel border-b border-line flex-shrink-0 flex items-center gap-3">
          <h2 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Document Library</h2>
          <span className="text-[11px] font-mono text-dim px-2 py-0.5 border border-line rounded">
            {docs.length} documents
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-panel border-b border-line">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Filename</th>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Well</th>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Status</th>
                <th className="text-left px-4 py-2.5 text-[11px] text-dim uppercase tracking-wider font-semibold whitespace-nowrap">Events Extracted</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-dim text-sm">
                    Loading documents…
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-dim text-sm">
                    No documents uploaded yet.
                  </td>
                </tr>
              ) : (
                docs.map(doc => {
                  const isInProgress = doc.status === 'ocr' || doc.status === 'extracting';
                  const isIndexed = doc.status === 'indexed';
                  const isFailed = doc.status === 'failed';
                  const wellName = wellNameMap[doc.well_id] || doc.well_id;

                  return (
                    <tr
                      key={doc.document_id}
                      className={`border-b border-line transition-colors ${
                        doc._isNew ? 'bg-normal/5' : 'hover:bg-panel'
                      } ${isInProgress ? 'opacity-90' : ''}`}
                    >
                      {/* Filename */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-dim flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span className="font-mono text-xs text-foreground">{doc.filename}</span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono text-dim border border-line rounded px-1.5 py-0.5">
                          {doc.type}
                        </span>
                      </td>

                      {/* Well */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-foreground">{wellName}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <StatusDot status={doc.status} />
                          {isFailed && (
                            <button
                              onClick={() => retryDoc(doc.document_id)}
                              className="text-[11px] text-dim hover:text-foreground underline underline-offset-2 cursor-pointer transition-colors"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Events Extracted */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isIndexed && doc.events_extracted > 0 ? (
                          <Link
                            to={`/events?well=${doc.well_id}`}
                            className="flex items-center gap-1.5 text-[12px] text-normal hover:text-foreground transition-colors group"
                          >
                            <span className="font-mono font-bold">{doc.events_extracted}</span>
                            <span className="text-dim group-hover:text-foreground transition-colors">events extracted</span>
                            <svg className="w-3 h-3 text-dim group-hover:text-foreground transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="9,18 15,12 9,6" />
                            </svg>
                            <span className="text-dim group-hover:text-foreground text-[11px] transition-colors">view in Event Explorer</span>
                          </Link>
                        ) : isIndexed && doc.events_extracted === 0 ? (
                          <span className="text-dim text-[12px]">0 events</span>
                        ) : isInProgress ? (
                          <span className="text-dim text-[12px] italic">Processing…</span>
                        ) : (
                          <span className="text-dim/50 text-[12px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
