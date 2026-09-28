"""Risk prediction schemas and contracts conforming to NWIS Roadmap Section 4.3."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class RiskPredictionRequest:
    """Input payload for risk prediction."""

    well_id: str
    depth_md: float
    formation: str
    lithology: str = "Porous Sandstone / Siltstone"
    rop_mhr: float = 12.0
    wob_klbs: float = 24.0
    rpm: float = 110.0
    torque_kftlb: float = 8.0
    spp_psi: float = 2200.0
    flow_rate_gpm: float = 550.0
    mud_weight_ppg: float = 9.8
    ecd_ppg: float = 10.2
    # Spatial offset features (optional, can be auto-inferred if omitted)
    offset_wells_count_in_radius: int | None = None
    max_offset_similarity: float | None = None
    offset_mud_loss_count: int | None = None
    offset_stuck_pipe_count: int | None = None
    offset_kick_count: int | None = None
    offset_torque_spike_count: int | None = None
    nearest_hazard_distance_km: float | None = None
    offset_hazard_density: float | None = None


@dataclass
class RiskPredictionResult:
    """Standardized risk prediction output matching Roadmap contract Section 4.3."""

    well_id: str
    depth_md: float
    risk_type: str  # e.g., "MUD_LOSS"
    probability: float  # e.g., 0.78
    level: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    model_version: str  # e.g., "rf-mud-loss-v1"
    top_contributing_features: list[dict[str, Any]] = field(default_factory=list)
    mitigation_recommendation: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary for Backend/API responses."""
        return asdict(self)
