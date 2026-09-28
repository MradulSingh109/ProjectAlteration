"""Behavior tests for Stage 5 event extraction."""

import unittest

from ml.src.information_extraction import extract_events
from ml.src.information_extraction.event_classifier import EventClassifier


class EventExtractorTests(unittest.TestCase):
    def test_extracts_events_from_event_table(self):
        events = extract_events(
            text="Daily report for OIL-102.",
            tables=[
                ["Time", "Depth", "Event", "Observation"],
                ["08:35", "2845 m", "MUD_LOSS", "Severe losses"],
                ["14:20", "2862 m", "TORQUE_SPIKE", "Torque increased"],
            ],
            source_document="DDR_OIL102.pdf",
            page_count=1,
        )

        self.assertEqual([event["event_type"] for event in events], ["MUD_LOSS", "TORQUE_SPIKE"])
        self.assertEqual([event["depth_md"] for event in events], [2845, 2862])
        self.assertEqual(events[0]["severity"], "HIGH")
        self.assertEqual(events[0]["well_id"], "OIL-102")
        self.assertEqual(events[0]["source_page"], 1)

    def test_extracts_event_entities_from_prose(self):
        events = extract_events(
            "Severe mud losses were observed at 2845 m while drilling fractured limestone due to a fractured zone.",
            source_document="WCR_OIL102.pdf",
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "MUD_LOSS")
        self.assertEqual(events[0]["depth_md"], 2845)
        self.assertEqual(events[0]["severity"], "HIGH")
        self.assertEqual(events[0]["formation"], "Limestone")
        self.assertEqual(events[0]["cause"], "a fractured zone")

    def test_extracts_cementing_events_from_event_table(self):
        events = extract_events(
            text="Synthetic Cementing Report for OIL-114.",
            tables=[
                ["Time", "Event", "Severity", "Observation"],
                ["11:42", "Pump pressure increase", "MEDIUM", "Above expected trend"],
                ["12:10", "Cement returns delayed", "MEDIUM", "Possible losses"],
                ["12:36", "Job completed", "LOW", "Pressure stabilized"],
            ],
            source_document="CEMENTING_OIL114.pdf",
            page_count=1,
        )

        self.assertEqual(
            [event["event_type"] for event in events],
            ["PRESSURE_SPIKE", "CEMENTING_FAILURE"],
        )
        self.assertEqual([event["severity"] for event in events], ["MEDIUM", "MEDIUM"])
        self.assertTrue(all(event["well_id"] == "OIL-114" for event in events))

    def test_severity_preserves_critical_taxonomy_level(self):
        events = extract_events(
            "Critical kick observed at 2845 m.",
            source_document="DDR_OIL102.pdf",
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["severity"], "CRITICAL")

    def test_extracts_differential_sticking_from_cementing_report(self):
        text = (
            "WELL ID: W-076 | FORMATION: Tipam Sandstone.\n"
            "EXTRACTED EVENT: Differential Pipe Sticking @ 2780 m\n"
            "SEVERITY: MEDIUM\n"
            "MITIGATION: 15 bbl surfactant pipe-lax pill + lightweight lead slurry (1.42 sg).\n\n"
            "SUMMARY: Differential Sticking Incident Report in\n"
            "Differential sticking encountered at 2,780 m across Tipam sandstone "
            "due to 340 psi hydrostatic overbalance. Freed pipe using a 15 bbl surfactant pill."
        )

        events = extract_events(text, source_document="CementingReport_W076.pdf")

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "STUCK_PIPE")
        self.assertEqual(events[0]["well_id"], "W-076")
        self.assertEqual(events[0]["depth_md"], 2780)
        self.assertEqual(events[0]["severity"], "MEDIUM")
        self.assertEqual(events[0]["formation"], "Tipam")
        self.assertEqual(events[0]["cause"], "340 psi hydrostatic overbalance")
        self.assertEqual(events[0]["outcome"], "Freed pipe using a 15 bbl surfactant pill")
        self.assertEqual(
            events[0]["mitigation"],
            "15 bbl surfactant pipe-lax pill + lightweight lead slurry (1.42 sg)",
        )
        severity_evidence = next(item for item in events[0]["evidence"] if item["field"] == "severity")
        self.assertIn("SEVERITY: MEDIUM", severity_evidence["original_text"])
        well_id_evidence = next(item for item in events[0]["evidence"] if item["field"] == "well_id")
        self.assertIn("WELL ID: W-076", well_id_evidence["original_text"])
        cause_evidence = next(item for item in events[0]["evidence"] if item["field"] == "cause")
        self.assertIn("due to 340 psi hydrostatic overbalance", cause_evidence["original_text"])
        self.assertEqual(events[0]["source_section"], "EXTRACTED EVENT")

    def test_groups_event_heading_and_context_without_creating_summary_or_lesson_events(self):
        text = "\n".join(
            [
                "Well",
                "DLJ-12",
                "OPERATIONS SUMMARY",
                "04:15 Torque Spike - see remarks. NPT 3.0 hrs.",
                "4. DRILLING EVENTS / REMARKS",
                "1. TORQUE SPIKE at 2,912 m MD (BARAIL) | Severity: MEDIUM | NPT: 3.0 hrs",
                "Torque increased due to stick-slip while entering the formation.",
                "Mitigation: Reduced WOB/RPM and circulated bottoms-up.",
                "Outcome: Pipe freed and drilling resumed.",
                "5. LESSONS LEARNED",
                "Rising torque can be a precursor to stuck pipe.",
            ]
        )

        events = extract_events(text, source_document="DDR_DLJ-12.pdf")

        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event["event_type"], "TORQUE_SPIKE")
        self.assertEqual(event["depth_md"], 2912)
        self.assertEqual(event["severity"], "MEDIUM")
        self.assertEqual(event["formation"], "Barail")
        self.assertEqual(event["npt_hours"], 3.0)
        self.assertEqual(event["cause"], "stick-slip while entering the formation")
        self.assertEqual(event["mitigation"], "Reduced WOB/RPM and circulated bottoms-up")
        self.assertEqual(event["outcome"], "Pipe freed and drilling resumed")
        self.assertEqual(event["source_section"], "4. DRILLING EVENTS / REMARKS")
        self.assertEqual(event["extraction_model"], "nwis-rules-baseline-v1")
        self.assertTrue(event["extraction_timestamp"])
        severity_evidence = next(item for item in event["evidence"] if item["field"] == "severity")
        self.assertIn("Severity: MEDIUM", severity_evidence["original_text"])
        self.assertEqual(severity_evidence["source_page"], 1)
        self.assertNotIn("Severity:", event["description"])
        self.assertNotIn("Mitigation:", event["description"])
        self.assertNotIn("Lessons Learned", event["description"])

    def test_npt_metadata_does_not_override_the_incident_heading(self):
        event_type = EventClassifier().classify(
            "WELLBORE INSTABILITY at 3,094 m MD | Severity: MEDIUM | NPT: 5.5 hrs"
        )

        self.assertIsNone(event_type)

    def test_extracts_cause_mitigation_and_outcome_from_hgj_report_wording(self):
        text = "\n".join(
            [
                "4. DRILLING EVENTS / REMARKS",
                "1. MUD LOSS at 3,790 m MD (SYLHET) | Severity: CRITICAL | NPT: 52.0 hrs | MW: 11.9 ppg",
                "Total loss of returns at 3,790 m MD in fractured Sylhet limestone; loss rate exceeded 120 bbl/hr.",
                "Standpipe pressure dropped 380 psi. Well kept full with water while LCM was mixed.",
                "Mitigation: Reduced mud weight by 0.3 ppg and spotted a cross-linked LCM pill across the loss zone;",
                "cured after two attempts.",
                "Lesson: Reduce ECD when approaching the Sylhet loss zone.",
                "2. KICK at 3,804 m MD (SYLHET) | Severity: HIGH | NPT: 16.0 hrs | MW: 12.3 ppg",
                "Flow observed after losses reduced hydrostatic head; 9 bbl gain.",
                "Mitigation: Flow-checked, closed BOP, circulated influx out and increased MW to 12.6 ppg.",
            ]
        )

        events = extract_events(text, source_document="DDR_HGJ-02.pdf")

        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["cause"], "fractured Sylhet limestone")
        self.assertEqual(
            events[0]["mitigation"],
            "Reduced mud weight by 0.3 ppg and spotted a cross-linked LCM pill across the loss zone",
        )
        self.assertEqual(events[0]["outcome"], "cured after two attempts")
        self.assertEqual(events[1]["cause"], "losses reduced hydrostatic head")
        self.assertEqual(
            events[1]["mitigation"],
            "Flow-checked, closed BOP, circulated influx out and increased MW to 12.6 ppg",
        )
        cause_evidence = next(item for item in events[0]["evidence"] if item["field"] == "cause")
        self.assertIn("fractured Sylhet limestone", cause_evidence["original_text"])
        outcome_evidence = next(item for item in events[0]["evidence"] if item["field"] == "outcome")
        self.assertIn("cured after two attempts", outcome_evidence["original_text"])

    def test_page_text_keeps_the_actual_source_page_in_evidence(self):
        page_texts = [
            "Cover page with well identifier OIL-201.",
            "4. DRILLING EVENTS / REMARKS\n"
            "1. MUD LOSS at 2,845 m MD | Severity: HIGH\n"
            "Cause: fractured formation.",
        ]
        events = extract_events(
            text="\n\n".join(page_texts),
            page_texts=page_texts,
            source_document="DDR_OIL201.pdf",
            page_count=2,
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["source_page"], 2)
        depth_evidence = next(item for item in events[0]["evidence"] if item["field"] == "depth_md")
        self.assertEqual(depth_evidence["source_page"], 2)


if __name__ == "__main__":
    unittest.main()
