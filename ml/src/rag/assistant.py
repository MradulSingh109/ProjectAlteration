"""RAG Knowledge Assistant for NWIS (Roadmap Step 10)."""

from __future__ import annotations

from pathlib import Path
import re
from typing import Any

from .chunker import DocumentChunker
from .retriever import RAGRetriever
from .schemas import RAGChunk, RAGQueryFilter, RAGResponse, RAGSourceReference
from ..similarity.well_similarity import WellSimilarityEngine


class RAGKnowledgeAssistant:
    """Evidence-backed Q&A assistant for historical drilling reports and events."""

    def __init__(
        self,
        processed_dir: str | Path | None = None,
        wells_csv: str | Path | None = None,
        events_csv: str | Path | None = None,
    ) -> None:
        base_dir = Path(__file__).resolve().parent.parent.parent
        self.processed_dir = Path(processed_dir) if processed_dir else (base_dir / "data/processed/good_data_processed")
        self.wells_csv = Path(wells_csv) if wells_csv else (self.processed_dir / "historical_dataset/wells.csv")
        self.events_csv = Path(events_csv) if events_csv else (self.processed_dir / "historical_dataset/events.csv")

        # Initialize chunker and similarity engine
        self.chunker = DocumentChunker(self.processed_dir)
        self.chunks = self.chunker.load_all_chunks()

        self.similarity_engine = None
        if self.wells_csv.exists() and self.events_csv.exists():
            self.similarity_engine = WellSimilarityEngine(
                wells_csv_path=self.wells_csv,
                events_csv_path=self.events_csv,
            )

        self.retriever = RAGRetriever(self.chunks, similarity_engine=self.similarity_engine)

    def answer_query(
        self,
        query: str,
        filters: RAGQueryFilter | None = None,
        top_k: int = 4,
    ) -> RAGResponse:
        """Process natural language query, retrieve grounded passages, and formulate response."""
        # Auto-extract filters from query text if not explicitly provided
        if filters is None:
            filters = self._auto_extract_query_filters(query)

        scored_chunks = self.retriever.retrieve(query, filters=filters, top_k=top_k)

        if not scored_chunks:
            return RAGResponse(
                query=query,
                answer="No relevant historical drilling records found matching the specified query criteria.",
                sources=[],
                total_retrieved_chunks=0,
            )

        # Build citations
        sources: list[RAGSourceReference] = []
        context_snippets: list[str] = []

        for chunk, score in scored_chunks:
            # Extract most relevant 1-2 sentences for quote
            quote_snippet = self._extract_relevant_quote(query, chunk.text)
            sources.append(
                RAGSourceReference(
                    document_id=chunk.document_id,
                    page=chunk.page,
                    well_id=chunk.well_id,
                    section=chunk.section,
                    formation=chunk.formation,
                    depth_md=chunk.depth_min,
                    quote=quote_snippet,
                )
            )
            context_snippets.append(f"[{chunk.well_id or 'General'} | {chunk.document_id} p.{chunk.page}]: {chunk.text}")

        # Synthesize domain response
        answer_text = self._synthesize_answer(query, scored_chunks)

        return RAGResponse(
            query=query,
            answer=answer_text,
            sources=sources,
            total_retrieved_chunks=len(scored_chunks),
        )

    def _auto_extract_query_filters(self, query: str) -> RAGQueryFilter:
        """Parse natural language query to automatically detect entity constraints."""
        q_clean = query.strip()

        # Detect well ID
        well_m = re.search(r"\b(DLJ-?\d+|HGJ-?\d+|NHK-?\d+|NHR-?\d+|W-?\d+)\b", q_clean, re.IGNORECASE)
        well_id = well_m.group(0).upper() if well_m else None

        # Detect proximity intent (e.g. "within 15 km of DLJ-18")
        nearby_m = re.search(r"(?:near|within\s*(\d+)\s*km\s*of)\s*(DLJ-?\d+|HGJ-?\d+|NHK-?\d+|W-?\d+)", q_clean, re.IGNORECASE)
        nearby_well = None
        dist_km = None
        if nearby_m:
            if nearby_m.group(1):
                dist_km = float(nearby_m.group(1))
            nearby_well = nearby_m.group(2).upper()

        # Detect formation
        formation = None
        for fmt in ["Barail", "Tipam", "Kopili", "Sylhet", "Girujan"]:
            if re.search(rf"\b{fmt}\b", q_clean, re.IGNORECASE):
                formation = fmt
                break

        # Detect event type
        event_type = None
        if re.search(r"\bmud\s*loss(?:es)?\b|\bloss\b", q_clean, re.IGNORECASE):
            event_type = "MUD_LOSS"
        elif re.search(r"\bstuck\s*pipe\b|\bpipe\s*sticking\b", q_clean, re.IGNORECASE):
            event_type = "STUCK_PIPE"
        elif re.search(r"\bkick\b|\binflux\b", q_clean, re.IGNORECASE):
            event_type = "KICK"
        elif re.search(r"\btorque\s*spike\b|\bstick-slip\b", q_clean, re.IGNORECASE):
            event_type = "TORQUE_SPIKE"

        # Detect depth
        depth_matches = re.findall(r"\b([1-4],?[0-9]{3})\s*m\b", q_clean)
        min_depth = None
        max_depth = None
        if depth_matches:
            center_d = float(depth_matches[0].replace(",", ""))
            min_depth = center_d - 150.0
            max_depth = center_d + 150.0

        return RAGQueryFilter(
            well_id=well_id if not nearby_well else None,
            formation=formation,
            event_type=event_type,
            min_depth=min_depth,
            max_depth=max_depth,
            nearby_well_id=nearby_well,
            max_distance_km=dist_km or 25.0,
        )

    def _extract_relevant_quote(self, query: str, text: str) -> str:
        """Extract a short, highly relevant sentence quote from chunk text."""
        sentences = re.split(r"(?<=[.!?\n])\s+", text)
        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) > 25 and any(k in s_clean.lower() for k in ["loss", "stuck", "kick", "torque", "mitigation", "lesson", "seam"]):
                return s_clean[:140] + ("..." if len(s_clean) > 140 else "")
        return sentences[0][:140] if sentences else text[:140]

    def _synthesize_answer(self, query: str, scored_chunks: list[tuple[RAGChunk, float]]) -> str:
        """Generate structured, technical drilling answer grounded in retrieved chunks."""
        top_chunks = [c for c, _ in scored_chunks]

        # Extract specific findings
        findings: list[str] = []
        lessons: list[str] = []
        mitigations: list[str] = []

        for c in top_chunks:
            # Extract events / remarks
            for line in c.text.splitlines():
                l_str = line.strip()
                if not l_str or len(l_str) < 15:
                    continue
                if any(kw in l_str.lower() for kw in ["encountered", "observed", "stuck", "loss", "kicked", "spike"]):
                    if l_str not in findings and not l_str.startswith("1."):
                        findings.append(f"• **{c.well_id or c.document_id}**: {l_str}")
                if "mitigation:" in l_str.lower() or "mitigation" in l_str.lower():
                    mitigations.append(f"• {l_str}")
                if "lesson:" in l_str.lower() or "lesson" in l_str.lower():
                    lessons.append(f"• {l_str}")

        parts: list[str] = []
        parts.append(f"Based on historical records from **{', '.join(sorted(set(c.document_id for c in top_chunks)))}**:")

        if findings:
            parts.append("\n**Key Historical Observations:**\n" + "\n".join(findings[:4]))

        if mitigations:
            parts.append("\n**Mitigation Actions Recorded:**\n" + "\n".join(mitigations[:3]))

        if lessons:
            parts.append("\n**Institutional Lessons Learned:**\n" + "\n".join(lessons[:3]))

        if not (findings or mitigations or lessons):
            # Fallback to direct excerpt summary
            summary_lines = [f"• [{c.well_id or c.document_id}] {c.text[:180]}..." for c in top_chunks[:2]]
            parts.append("\n" + "\n".join(summary_lines))

        return "\n".join(parts)
