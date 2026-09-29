import { useState, useRef, useEffect } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { queryAssistant } from '../../api/assistant.api';

const SUGGESTIONS = [
  "What mud loss events happened near this formation?",
  "Show me stuck pipe incidents below 2900m",
  "What happened on DLJ-07?",
  "Any cementing issues nearby?"
];

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Derive wellId context from current route
  let wellIdContext = null;
  if (location.pathname === '/') {
    wellIdContext = searchParams.get('well') || 'DLJ-07';
  } else if (location.pathname === '/wells') {
    wellIdContext = searchParams.get('id') || 'DLJ-07';
  }
  
  // Also track user clearing the context manually in widget
  const [overrideContextClear, setOverrideContextClear] = useState(false);
  const activeWellContext = overrideContextClear ? null : wellIdContext;

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, loading]);

  // Handle escape to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  async function submitQuery(queryText) {
    if (!queryText.trim() || loading) return;

    const userMsg = { role: 'user', content: queryText };
    setHistory(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await queryAssistant(queryText, activeWellContext);
      setHistory(prev => [...prev, { role: 'assistant', data: response }]);
    } catch (err) {
      setHistory(prev => [...prev, { role: 'assistant', data: { answer: 'Sorry, I encountered an error.', citations: [] } }]);
    } finally {
      setLoading(false);
      // Wait for React to render new messages before focusing
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuery(inputValue);
    }
  }

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-panel border border-line shadow-[var(--shadow-popup)] flex items-center justify-center text-foreground hover:bg-panel-alt transition-colors"
        aria-label="Open AI Assistant"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M9 10h.01" />
          <path d="M12 10h.01" />
          <path d="M15 10h.01" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[calc(100vw-48px)] sm:w-[400px] h-[70vh] max-h-[600px] bg-panel border border-line rounded shadow-[var(--shadow-popup)] flex flex-col overflow-hidden">
      
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-panel-alt flex-shrink-0">
        <div className="flex flex-col">
          <span className="font-bold text-sm text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-normal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
              <path d="M12 12 2.1 7.1" />
              <path d="m12 12 7.1 7.1" />
            </svg>
            NWIS Assistant
          </span>
          {activeWellContext && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-dim bg-background border border-line px-1 rounded flex items-center gap-1">
                Scoped to {activeWellContext}
                <button 
                  onClick={() => setOverrideContextClear(true)}
                  className="hover:text-foreground ml-0.5"
                  title="Clear well scope"
                >
                  ×
                </button>
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-dim hover:text-foreground p-1 transition-colors"
          aria-label="Close Assistant"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* ── MESSAGE HISTORY ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {history.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-center px-4 space-y-4 text-dim">
            <svg className="w-12 h-12 text-line mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm">How can I help you analyze events or risk today?</p>
            
            <div className="flex flex-col gap-2 w-full mt-4">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => submitQuery(s)}
                  className="text-left text-[12px] bg-panel border border-line rounded px-3 py-2 hover:border-dim hover:bg-panel-alt transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {history.map((msg, i) => (
              <div key={i} className={`flex flex-col max-w-[90%] ${msg.role === 'user' ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'}`}>
                {msg.role === 'user' ? (
                  <div className="bg-panel-alt border border-line text-foreground text-[13px] px-3 py-2 rounded">
                    {msg.content}
                  </div>
                ) : (
                  <div className="bg-panel border border-line rounded overflow-hidden">
                    <div className="text-[13px] text-foreground p-3 leading-relaxed">
                      {msg.data.answer}
                    </div>
                    
                    {/* Assistant Metadata (Citations, Wells, Limitations) */}
                    {(msg.data.citations?.length > 0 || msg.data.relevant_wells?.length > 0) && (
                      <div className="border-t border-line bg-panel-alt p-2.5 flex flex-col gap-2">
                        {msg.data.citations?.length > 0 && (
                          <div>
                            <span className="text-[10px] text-dim uppercase tracking-wider font-semibold block mb-1">Sources</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.data.citations.map((c, j) => (
                                <Link
                                  key={j}
                                  to={`/wells?id=${c.event_id.split('-')[0]}&event=${c.event_id}`} // Crude well inference
                                  className="inline-flex items-center gap-1 bg-background border border-line rounded px-1.5 py-0.5 text-[11px] text-normal hover:border-normal transition-colors"
                                >
                                  <span>{c.document}</span>
                                  <span className="text-dim">p.{c.page}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {msg.data.relevant_wells?.length > 0 && (
                          <div>
                            <span className="text-[10px] text-dim uppercase tracking-wider font-semibold block mb-1">Relevant Wells</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.data.relevant_wells.map((w, j) => (
                                <Link
                                  key={j}
                                  to={`/wells?id=${w}`}
                                  className="text-[11px] font-mono text-dim hover:text-foreground underline underline-offset-2"
                                >
                                  {w}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {msg.data.confidence && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-dim">Confidence:</span>
                            <span className="text-[10px] font-bold capitalize text-dim">
                              {msg.data.confidence}
                            </span>
                          </div>
                        )}

                        {msg.data.limitations && (
                          <div className="text-[10px] text-dim/70 italic mt-0.5">
                            {msg.data.limitations}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="self-start items-start mr-auto max-w-[90%]">
                <div className="bg-panel border border-line rounded px-4 py-3 flex items-center gap-1.5 h-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-normal animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-normal animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-normal animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── INPUT ROW ── */}
      <div className="p-3 border-t border-line bg-panel flex-shrink-0">
        <div className="relative flex items-end bg-background border border-line rounded focus-within:border-dim transition-colors overflow-hidden">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask about events, formations..."
            className="w-full bg-transparent text-sm text-foreground p-3 outline-none resize-none disabled:opacity-50"
            rows="1"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={() => submitQuery(inputValue)}
            disabled={!inputValue.trim() || loading}
            className="mb-2 mr-2 p-1.5 rounded text-background bg-normal hover:bg-opacity-90 disabled:bg-line disabled:text-dim transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
