"""Behavior tests for PDF table extraction."""

import unittest

from ml.src.document_processing.table_extractor import extract_tables


class TableExtractorTests(unittest.TestCase):
    def test_extracts_vertical_operations_mud_and_casing_tables(self):
        text = "\n".join(
            [
                "1. OPERATIONS SUMMARY",
                "From",
                "To",
                "Depth (m)",
                "Operation",
                "00:00",
                "03:30",
                "2,894",
                "Drilled ahead, parameters steady.",
                "03:30",
                "04:15",
                "2,916",
                "Connection, survey, circulated bottoms-up.",
                "2. MUD PROPERTIES",
                "MW (ppg)",
                "FV (s)",
                "PV (cP)",
                "YP (lb/100ft2)",
                "pH",
                "Solids (%)",
                "Type",
                "10.5",
                "73",
                "28",
                "30",
                "9.5",
                "11.2",
                "KCl-Polymer",
                "3. CASING STATUS",
                "String",
                "Size",
                "Shoe (m MD)",
                "TOC (m)",
                "Conductor",
                '20"',
                "76",
                "0",
                "4. DRILLING EVENTS / REMARKS",
                "1. TORQUE SPIKE at 2,912 m MD (BARAIL) | Severity: MEDIUM",
                "Torque increased; stick-slip observed.",
                "Mitigation: Reduced WOB/RPM.",
            ]
        )

        tables = extract_tables(text)

        self.assertEqual(tables[0], ["From", "To", "Depth (m)", "Operation"])
        self.assertIn(["00:00", "03:30", "2,894", "Drilled ahead, parameters steady."], tables)
        self.assertIn(["MW (ppg)", "FV (s)", "PV (cP)", "YP (lb/100ft2)", "pH", "Solids (%)", "Type"], tables)
        self.assertIn(["10.5", "73", "28", "30", "9.5", "11.2", "KCl-Polymer"], tables)
        self.assertIn(["Conductor", '20"', "76", "0"], tables)
        self.assertEqual(len(tables), 7)


if __name__ == "__main__":
    unittest.main()
