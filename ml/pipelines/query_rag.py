"""Pipeline script to query the NWIS RAG Knowledge Assistant (Step 10).

Usage:
  python pipelines/query_rag.py --query "What happened near 2900 m in wells near DLJ-18?"
  python pipelines/query_rag.py --query "What mitigations were used for mud losses in Barail?"
  python pipelines/query_rag.py --interactive
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.rag.assistant import RAGKnowledgeAssistant
from src.rag.schemas import RAGQueryFilter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NWIS RAG Knowledge Assistant")
    parser.add_argument("--query", type=str, help="Drilling question to ask")
    parser.add_argument("--well-id", type=str, help="Filter by specific well ID")
    parser.add_argument("--formation", type=str, help="Filter by geological formation (e.g. Barail, Kopili)")
    parser.add_argument("--event-type", type=str, help="Filter by event type (e.g. MUD_LOSS, STUCK_PIPE)")
    parser.add_argument("--min-depth", type=float, help="Filter min depth (m MD)")
    parser.add_argument("--max-depth", type=float, help="Filter max depth (m MD)")
    parser.add_argument("--nearby-well", type=str, help="Proximity search near reference well")
    parser.add_argument("--radius-km", type=float, default=25.0, help="Max proximity radius in km")
    parser.add_argument("--top-k", type=int, default=4, help="Number of citations to retrieve")
    parser.add_argument("--interactive", action="store_true", help="Launch interactive Q&A session")
    parser.add_argument("--output-json", type=str, help="Path to save JSON response")
    return parser.parse_args()


def display_rag_response(resp) -> None:
    print("\n================ NWIS RAG KNOWLEDGE ASSISTANT RESPONSE ================")
    print(f"Query: \"{resp.query}\"")
    print("------------------------------------------------------------------------")
    print(resp.answer)
    print("\n------------------------- EVIDENCE & SOURCES ---------------------------")
    for idx, src in enumerate(resp.sources, 1):
        loc_info = f" | Depth: {src.depth_md}m" if src.depth_md else ""
        fmt_info = f" | Formation: {src.formation}" if src.formation else ""
        print(f"[{idx}] Source Document : {src.document_id} (Page {src.page}){loc_info}{fmt_info}")
        if src.section:
            print(f"    Section         : {src.section}")
        if src.quote:
            print(f"    Quote           : \"{src.quote}\"")
        print()
    print(f"Total Sources Cited: {len(resp.sources)} / {resp.total_retrieved_chunks} passages retrieved")
    print("========================================================================\n")


def main() -> None:
    args = parse_args()
    assistant = RAGKnowledgeAssistant()

    if args.interactive:
        print("\n=== NWIS Drilling Knowledge Assistant (Interactive Mode) ===")
        print("Type your questions below (or 'exit' to quit):\n")
        while True:
            try:
                user_q = input("Query > ").strip()
                if not user_q:
                    continue
                if user_q.lower() in ["exit", "quit", "q"]:
                    break
                resp = assistant.answer_query(user_q, top_k=args.top_k)
                display_rag_response(resp)
            except (KeyboardInterrupt, EOFError):
                break
        return

    query_str = args.query or "What happened near 2900 m in wells near DLJ-18?"

    filters = None
    if any([args.well_id, args.formation, args.event_type, args.min_depth, args.max_depth, args.nearby_well]):
        filters = RAGQueryFilter(
            well_id=args.well_id,
            formation=args.formation,
            event_type=args.event_type,
            min_depth=args.min_depth,
            max_depth=args.max_depth,
            nearby_well_id=args.nearby_well,
            max_distance_km=args.radius_km,
        )

    response = assistant.answer_query(query_str, filters=filters, top_k=args.top_k)
    display_rag_response(response)

    if args.output_json:
        out_p = Path(args.output_json)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(response.to_dict(), f, indent=2)
        print(f"[OK] Response JSON written to: {out_p}")


if __name__ == "__main__":
    main()
