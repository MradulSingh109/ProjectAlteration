"""Unit tests for the RAG Knowledge Assistant (Roadmap Step 10)."""

from pathlib import Path
import unittest

BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data/processed/good_data_processed"

try:
    from ml.src.rag.assistant import RAGKnowledgeAssistant
    from ml.src.rag.chunker import DocumentChunker
    from ml.src.rag.schemas import RAGQueryFilter, RAGResponse
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, str(BASE_DIR))
    from src.rag.assistant import RAGKnowledgeAssistant
    from src.rag.chunker import DocumentChunker
    from src.rag.schemas import RAGQueryFilter, RAGResponse


class TestRAGAssistant(unittest.TestCase):
    def setUp(self) -> None:
        self.assistant = RAGKnowledgeAssistant(processed_dir=PROCESSED_DIR)

    def test_document_chunker(self) -> None:
        chunker = DocumentChunker(PROCESSED_DIR)
        chunks = chunker.load_all_chunks()
        self.assertGreater(len(chunks), 15)

        # Check metadata on chunks
        has_formation = any(c.formation is not None for c in chunks)
        has_well_id = any(c.well_id is not None for c in chunks)
        self.assertTrue(has_formation)
        self.assertTrue(has_well_id)

    def test_rag_query_barail_mud_loss(self) -> None:
        resp = self.assistant.answer_query("What mitigations were used for mud losses in Barail?", top_k=3)
        self.assertIsInstance(resp, RAGResponse)
        self.assertGreater(len(resp.sources), 0)
        self.assertIn("Barail", resp.answer)
        # Verify schema conformance
        d = resp.to_dict()
        self.assertIn("answer", d)
        self.assertIn("sources", d)
        self.assertIn("document_id", d["sources"][0])
        self.assertIn("page", d["sources"][0])

    def test_rag_query_with_explicit_filter(self) -> None:
        filters = RAGQueryFilter(well_id="DLJ-12", formation="Barail")
        resp = self.assistant.answer_query("What events occurred?", filters=filters, top_k=2)
        self.assertGreater(len(resp.sources), 0)
        for s in resp.sources:
            if s.well_id:
                self.assertIn("DLJ-12", s.well_id)

    def test_rag_nearby_well_search(self) -> None:
        resp = self.assistant.answer_query("What happened near 2900 m in wells near DLJ-18?", top_k=3)
        self.assertGreater(len(resp.sources), 0)
        self.assertIn("DLJ-18", resp.answer)


if __name__ == "__main__":
    unittest.main()
