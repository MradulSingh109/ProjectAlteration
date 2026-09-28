"""Geological stratigraphy and drilling baseline parameters for Upper Assam Basin."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class FormationInterval:
    name: str
    top_md: float
    base_md: float
    primary_lithology: str
    base_mud_weight_ppg: float
    typical_rop_mhr: float
    typical_torque_kftlb: float
    typical_spp_psi: float
    typical_flow_rate_gpm: float
    known_hazards: list[str]


ASSAM_STRATIGRAPHY = [
    FormationInterval(
        name="Alluvium / Girujan Clay",
        top_md=0.0,
        base_md=1500.0,
        primary_lithology="Claystone / Sand",
        base_mud_weight_ppg=9.0,
        typical_rop_mhr=18.0,
        typical_torque_kftlb=5.5,
        typical_spp_psi=1800.0,
        typical_flow_rate_gpm=650.0,
        known_hazards=[],
    ),
    FormationInterval(
        name="Tipam Sandstone",
        top_md=1500.0,
        base_md=2800.0,
        primary_lithology="Porous Sandstone / Siltstone",
        base_mud_weight_ppg=9.8,
        typical_rop_mhr=12.5,
        typical_torque_kftlb=8.0,
        typical_spp_psi=2200.0,
        typical_flow_rate_gpm=550.0,
        known_hazards=["MUD_LOSS", "STUCK_PIPE"],
    ),
    FormationInterval(
        name="Barail",
        top_md=2800.0,
        base_md=3600.0,
        primary_lithology="Coal / Shale / Sandstone Sequence",
        base_mud_weight_ppg=10.6,
        typical_rop_mhr=6.5,
        typical_torque_kftlb=11.5,
        typical_spp_psi=2600.0,
        typical_flow_rate_gpm=480.0,
        known_hazards=["TORQUE_SPIKE", "STUCK_PIPE", "MUD_LOSS"],
    ),
    FormationInterval(
        name="Kopili",
        top_md=3100.0,
        base_md=3700.0,
        primary_lithology="Overpressured Fissile Shale",
        base_mud_weight_ppg=12.2,
        typical_rop_mhr=5.0,
        typical_torque_kftlb=10.0,
        typical_spp_psi=2800.0,
        typical_flow_rate_gpm=420.0,
        known_hazards=["KICK", "OVERPRESSURE"],
    ),
    FormationInterval(
        name="Sylhet Limestone",
        top_md=3700.0,
        base_md=4500.0,
        primary_lithology="Fractured Vugular Limestone",
        base_mud_weight_ppg=11.8,
        typical_rop_mhr=4.0,
        typical_torque_kftlb=9.0,
        typical_spp_psi=2700.0,
        typical_flow_rate_gpm=400.0,
        known_hazards=["MUD_LOSS", "KICK"],
    ),
]


def get_formation_for_depth(depth_md: float, preferred_name: str | None = None) -> FormationInterval:
    """Resolve geological formation and lithology for a given measured depth."""
    if preferred_name:
        p_clean = preferred_name.lower().strip()
        for fmt in ASSAM_STRATIGRAPHY:
            if p_clean in fmt.name.lower():
                return fmt

    for fmt in ASSAM_STRATIGRAPHY:
        if fmt.top_md <= depth_md < fmt.base_md:
            return fmt

    # Default to deepest known interval
    return ASSAM_STRATIGRAPHY[-1]
