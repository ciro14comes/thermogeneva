"""Test dei controlli di qualità dell'ETL (nessuna rete, nessun database, solo libreria standard).

Esegui dalla cartella del progetto:  python -m unittest discover -s tests -v
"""
import os
import unittest

from etl import checks

PREV = {"raw_rows": 21000, "idc_null_share": 0.02, "sre_null_share": 0.03, "buildings": 6000,
        "zones": 60, "max_year": 2026, "site_buildings": 1197}


def ok_current(**over):
    cur = {"raw_rows": 21100, "idc_null_share": 0.02, "sre_null_share": 0.03, "buildings": 6010,
           "zones": 60, "max_year": 2026, "no_geom_share": 0.001, "rejected_share": 0.002}
    cur.update(over)
    return cur


class QualityChecks(unittest.TestCase):
    def test_normal_week_passes(self):
        errors, warnings = checks.compare(ok_current(), PREV)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_first_run_has_no_relative_checks(self):
        errors, _ = checks.compare(ok_current(raw_rows=10), {})
        self.assertEqual(errors, [])

    def test_anomalies_are_blocking(self):
        cases = [
            ({"raw_rows": 15000}, "Righe IDC"),            # -29 %
            ({"buildings": 5000}, "Edifici con geometria"),
            ({"zones": 5}, "Zone FTI"),
            ({"zones": 40}, "Zone FTI"),                   # -33 %
            ({"max_year": 2025}, "Anno più recente"),
            ({"idc_null_share": 0.20}, "IDC vuoti"),
            ({"sre_null_share": 0.50}, "SRE"),
            ({"no_geom_share": 0.10}, "senza geometria"),
            ({"rejected_share": 0.08}, "scartate"),
        ]
        for over, fragment in cases:
            with self.subTest(over=over):
                errors, _ = checks.compare(ok_current(**over), PREV)
                self.assertTrue(any(fragment in e for e in errors), errors)

    def test_zero_nulls_last_time_still_checked(self):
        errors, _ = checks.compare(ok_current(idc_null_share=0.15), {**PREV, "idc_null_share": 0.0})
        self.assertTrue(errors)

    def test_site_count_after_recalculation(self):
        errors, _ = checks.compare({"site_buildings": 900}, PREV)
        self.assertTrue(errors and "sito" in errors[0])
        errors, _ = checks.compare({"site_buildings": 1180}, PREV)
        self.assertEqual(errors, [])

    def test_big_growth_is_only_a_warning(self):
        errors, warnings = checks.compare(ok_current(raw_rows=30000), PREV)
        self.assertEqual(errors, [])
        self.assertTrue(warnings)

    def test_enforce_stops_unless_forced(self):
        with self.assertRaises(checks.QualityError):
            checks.enforce(["problema"], [], force=False, stage="test")
        checks.enforce(["problema"], [], force=True, stage="test")   # nessuna eccezione

    def test_force_flag(self):
        old = os.environ.pop("ETL_FORCE", None)
        try:
            self.assertTrue(checks.is_forced(["run", "--force"]))
            self.assertFalse(checks.is_forced(["run"]))
            os.environ["ETL_FORCE"] = "true"
            self.assertTrue(checks.is_forced(["run"]))
        finally:
            os.environ.pop("ETL_FORCE", None)
            if old is not None:
                os.environ["ETL_FORCE"] = old


if __name__ == "__main__":
    unittest.main()
