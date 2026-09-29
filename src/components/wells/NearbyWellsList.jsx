import { useState, useEffect } from 'react';
import { getWellComparisonStats } from '../../api/wells.api';
import WellComparisonPanel from './WellComparisonPanel';

export default function NearbyWellsList({ nearbyWells, activeWellId }) {
  const [selectedWells, setSelectedWells] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonStats, setComparisonStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Reset selection when active well changes
  useEffect(() => {
    setSelectedWells([]);
    setIsComparing(false);
  }, [activeWellId]);

  const handleToggle = (wellId) => {
    setSelectedWells(prev => {
      if (prev.includes(wellId)) {
        return prev.filter(id => id !== wellId);
      }
      if (prev.length < 3) {
        return [...prev, wellId];
      }
      return prev;
    });
  };

  const handleCompareClick = async () => {
    setIsComparing(true);
    setLoadingStats(true);
    const stats = await getWellComparisonStats([activeWellId, ...selectedWells]);
    setComparisonStats(stats);
    setLoadingStats(false);
  };

  const isMaxSelected = selectedWells.length >= 3;

  return (
    <>
      <div className="flex flex-col border-t border-line">
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-sm font-bold text-foreground italic">Nearby Wells</h3>
        </div>
        <div className="px-4 pb-4 space-y-2">
          {nearbyWells.length === 0 ? (
            <div className="text-[12px] text-dim">No nearby wells found.</div>
          ) : (
            nearbyWells.map(w => {
              const isSelected = selectedWells.includes(w.well_id);
              const disabled = !isSelected && isMaxSelected;
              return (
                <label
                  key={w.well_id}
                  className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer ${
                    isSelected ? 'border-normal/50 bg-normal/10' : 'border-line/50 bg-background hover:border-line'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => handleToggle(w.well_id)}
                      className="w-3.5 h-3.5 bg-background border-line rounded-sm text-normal focus:ring-normal focus:ring-offset-background"
                    />
                    <div>
                      <div className="text-[12px] font-bold text-foreground">{w.name || w.well_id}</div>
                      <div className="text-[10px] text-dim">{w.formation}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono text-foreground">{(w.similarity_score * 100).toFixed(0)}%</div>
                    <div className="text-[10px] text-dim">{(w.distance_m / 1000).toFixed(1)} km</div>
                  </div>
                </label>
              );
            })
          )}
          {selectedWells.length > 0 && (
            <button
              onClick={handleCompareClick}
              className="mt-3 w-full py-2 bg-panel border border-normal text-normal text-[12px] font-bold rounded hover:bg-normal hover:text-background transition-colors"
            >
              Compare ({selectedWells.length})
            </button>
          )}
        </div>
      </div>

      {isComparing && (
        <WellComparisonPanel
          stats={comparisonStats}
          loading={loadingStats}
          onClose={() => setIsComparing(false)}
          activeWellId={activeWellId}
        />
      )}
    </>
  );
}
