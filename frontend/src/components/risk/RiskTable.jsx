/**
 * RiskTable — Compact risk assessment summary.
 * Shows all risk types with probability bars, used in the right sidebar below alerts.
 */
export default function RiskTable({ risks }) {
  if (!risks || risks.length === 0) return null;

  // Sort by probability descending
  const sorted = [...risks].sort((a, b) => b.probability - a.probability);

  return (
    <div className="bg-panel border border-line rounded p-4">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-3 font-semibold">
        Risk Assessment — DLJ-114
      </div>
      <div className="space-y-2.5">
        {sorted.map(risk => (
          <RiskRow key={risk.risk_type} risk={risk} />
        ))}
      </div>
    </div>
  );
}

function RiskRow({ risk }) {
  const pct = (risk.probability * 100).toFixed(0);
  const levelColors = {
    HIGH: { text: 'text-danger', bar: 'bg-danger', border: 'border-danger/30' },
    MEDIUM: { text: 'text-caution', bar: 'bg-caution', border: 'border-caution/30' },
    LOW: { text: 'text-dim', bar: 'bg-dim', border: 'border-line' },
  };
  const colors = levelColors[risk.level] || levelColors.LOW;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-medium">{risk.risk_type.replace(/_/g, ' ')}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono font-bold ${colors.text}`}>{pct}%</span>
          <span className={`text-[10px] uppercase px-1 py-0.5 rounded border ${colors.border} ${colors.text} font-semibold`}>
            {risk.level}
          </span>
        </div>
      </div>
      {/* Probability bar */}
      <div className="w-full h-1.5 bg-background rounded overflow-hidden border border-line/50">
        <div
          className={`h-full rounded ${colors.bar}`}
          style={{ width: `${pct}%`, transition: 'width 0.3s ease' }}
        />
      </div>
    </div>
  );
}
