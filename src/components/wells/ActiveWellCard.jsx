/**
 * ActiveWellCard — Left panel showing active well metadata and rig telemetry.
 * Consumes well data passed from WellMap page.
 */
export default function ActiveWellCard({ well }) {
  if (!well) {
    return (
      <div className="bg-panel border border-line rounded p-4">
        <div className="text-dim text-sm">Loading well data...</div>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded p-4">
      {/* Well header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] text-dim uppercase tracking-wider mb-0.5">Active Well</div>
          <div className="text-lg font-bold text-foreground leading-tight">{well.name}</div>
        </div>
        <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-danger/15 text-danger border border-danger/30">
          {well.status}
        </span>
      </div>

      {/* Well metadata */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-dim">Formation</span>
          <span className="font-medium">{well.formation}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dim">Field</span>
          <span className="font-medium">{well.field}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dim">Current Depth</span>
          <span className="font-mono font-bold text-foreground">2,848 m</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-dim">Position</span>
          <span className="font-mono text-[13px]">{well.lat.toFixed(4)}°N, {well.lon.toFixed(4)}°E</span>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-line my-3" />

      {/* Rig Telemetry Cards */}
      <div className="text-[11px] text-dim uppercase tracking-wider mb-2">Rig Telemetry</div>
      <div className="grid grid-cols-2 gap-2">
        <TelemetryCard label="Rig Availability" value="98.2" unit="%" color="text-success" />
        <TelemetryCard label="Water Usage" value="1,250" unit="m³/day" color="text-normal" />
        <TelemetryCard label="Cost per Barrel" value="$27.4" unit="" color="text-foreground" />
        <TelemetryCard label="Mud Weight" value="9.6" unit="ppg" color="text-caution" />
      </div>
    </div>
  );
}

function TelemetryCard({ label, value, unit, color = "text-foreground" }) {
  return (
    <div className="bg-background border border-line rounded p-2.5">
      <div className="text-[10px] text-dim uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold font-mono ${color}`}>{value}</span>
        {unit && <span className="text-[11px] text-dim">{unit}</span>}
      </div>
    </div>
  );
}
