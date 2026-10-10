"""合成教学情景的聚焦数值与输入边界测试。"""

from copy import deepcopy
from decimal import Decimal
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("calculate_economics", ROOT / "scripts/calculate_economics.py")
TOOL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TOOL)
FIXTURE = json.loads((ROOT / "evals/fixtures/economics-scenarios.json").read_text(encoding="utf-8"))


class EconomicsTests(unittest.TestCase):
    def scenario(self, index=0):
        return {"scenarios": [deepcopy(FIXTURE["scenarios"][index])]}

    def test_inventory_cash_is_separate_from_sold_cost(self):
        result = TOOL.calculate(self.scenario())["scenarios"][0]
        cash = result["cash"]
        self.assertEqual(cash["lowest_before_new_financing"], Decimal(-6000))
        self.assertEqual(cash["additional_funding_need"], Decimal(6000))
        self.assertEqual(cash["closing_before_new_financing"], Decimal(500))
        self.assertEqual(cash["periods"][0]["closing_before_new_financing"], Decimal(-1500))
        self.assertEqual(cash["periods"][1]["opening_before_new_financing"], Decimal(-1500))
        self.assertEqual(result["operating"]["periods"][0]["operating_surplus_within_cost_scope"], Decimal(500))

    def test_new_funding_and_existing_debt(self):
        cash = TOOL.calculate(self.scenario(1))["scenarios"][0]["cash"]
        self.assertEqual(cash["lowest_before_new_financing"], Decimal(-6000))
        self.assertEqual(cash["additional_funding_need"], Decimal(7000))
        self.assertEqual(cash["closing_before_new_financing"], Decimal(-500))
        self.assertEqual(cash["lowest_after_new_financing"], Decimal(1000))
        self.assertEqual(cash["remaining_funding_need"], Decimal(0))

    def test_funding_after_payment_does_not_repair_earlier_shortage(self):
        data = self.scenario(1)
        events = data["scenarios"][0]["cash"]["transactions"]
        events[0], events[1] = events[1], events[0]
        events[0]["sequence"], events[1]["sequence"] = 1, 2
        cash = TOOL.calculate(data)["scenarios"][0]["cash"]
        self.assertEqual(cash["remaining_funding_need"], Decimal(7000))

    def test_new_funding_repayment_is_kept_in_after_financing_view(self):
        data = self.scenario(1)
        data["scenarios"][0]["cash"]["transactions"].append({
            "date": "2026-02-28", "sequence": 1, "category": "new_gap_financing", "direction": "out",
            "amount": "7200", "description": "本次新增借款还本及利息，按已明确条件演算"})
        cash = TOOL.calculate(data)["scenarios"][0]["cash"]
        self.assertEqual(cash["closing_before_new_financing"], Decimal(-500))
        self.assertEqual(cash["closing_after_new_financing"], Decimal(-700))
        self.assertEqual(cash["remaining_funding_need"], Decimal(1700))

    def test_operating_cost_change_and_round_up(self):
        periods = TOOL.calculate(self.scenario(2))["scenarios"][0]["operating"]["periods"]
        self.assertEqual([p["unit_contribution"] for p in periods], [Decimal(20), Decimal(15)])
        self.assertEqual([p["operating_surplus_within_cost_scope"] for p in periods], [Decimal(400), Decimal(-200)])
        self.assertEqual([p["breakeven_quantity"] for p in periods], [Decimal(100), Decimal(134)])

    def test_no_positive_contribution_has_no_false_breakeven(self):
        for cost in ("100", "101"):
            data = self.scenario(2)
            data["scenarios"][0]["operating"]["periods"][0]["unit_sold_variable_cost"] = cost
            row = TOOL.calculate(data)["scenarios"][0]["operating"]["periods"][0]
            self.assertEqual(row["status"], "no_positive_contribution")
            self.assertIsNone(row["breakeven_quantity"])

    def test_investment_example(self):
        result = TOOL.calculate(self.scenario(3))["scenarios"][0]["investment"]
        self.assertAlmostEqual(float(result["npv"]), -0.1277235161532682, places=12)
        self.assertEqual(result["total_undiscounted_cash"], Decimal(2))
        self.assertEqual([p["cumulative_undiscounted_cash"] for p in result["periods"]],
                         [Decimal(-10), Decimal(-6), Decimal(-3), Decimal(2)])

    def test_investment_working_capital_and_investor_view(self):
        data = self.scenario(3)
        investment = data["scenarios"][0]["investment"]
        investment["discount_rate"] = "0"
        investment["periods"][0]["working_capital_change"] = "2"
        investment["periods"][-1]["working_capital_change"] = "-2"
        result = TOOL.calculate(data)["scenarios"][0]["investment"]
        self.assertEqual(result["npv"], Decimal(2))
        investment["perspective"] = "investor_cash_flow"
        investment["cash_scope"] = "投资者实际出资与可分配回款，已反映融资和税口径"
        investment["periods"] = [
            {"t": 0, "label": "出资", "stage": "准备", "investor_contribution": "6", "investor_distribution": "0"},
            {"t": 1, "label": "退出", "stage": "结清", "investor_contribution": "0", "investor_distribution": "7"}]
        self.assertEqual(TOOL.calculate(data)["scenarios"][0]["investment"]["npv"], Decimal(1))

    def test_multiple_scenarios_keep_provenance_and_units(self):
        results = TOOL.calculate(deepcopy(FIXTURE))["scenarios"]
        self.assertEqual(len(results), 4)
        self.assertEqual(results[3]["monetary_unit"], "万元")
        self.assertEqual(results[0]["nature"], "assumption")
        self.assertIn("合成", results[0]["source"])

    def test_missing_metadata_and_bad_numbers(self):
        for field in ("currency", "monetary_unit", "source", "basis"):
            data = self.scenario()
            del data["scenarios"][0][field]
            with self.subTest(field=field), self.assertRaises(TOOL.InputError):
                TOOL.calculate(data)

    def test_invalid_structure_and_duplicate_names(self):
        for document in (None, [], {"scenarios": []}, {"scenarios": [None]}):
            with self.subTest(document=document), self.assertRaises(TOOL.InputError):
                TOOL.calculate(document)
        data = self.scenario()
        data["scenarios"][0]["cash"]["periods"] = [None]
        with self.assertRaises(TOOL.InputError):
            TOOL.calculate(data)
        data = self.scenario()
        data["scenarios"].append(deepcopy(data["scenarios"][0]))
        with self.assertRaises(TOOL.InputError):
            TOOL.calculate(data)
        for value in (None, "NaN", "Infinity", "-Infinity", True, "", "1e100"):
            data = self.scenario()
            data["scenarios"][0]["cash"]["opening_cash"] = value
            with self.subTest(value=value), self.assertRaises(TOOL.InputError):
                TOOL.calculate(data)

    def test_invalid_cash_dates_order_and_categories(self):
        for mutation in ("date_outside", "duplicate_order", "reverse_order", "period_gap", "bad_date", "missing_amount", "unknown_currency"):
            data = self.scenario()
            cash = data["scenarios"][0]["cash"]
            if mutation == "date_outside":
                cash["transactions"][-1]["date"] = "2026-03-01"
            elif mutation == "duplicate_order":
                cash["transactions"][1]["date"] = cash["transactions"][0]["date"]
            elif mutation == "reverse_order":
                cash["transactions"].reverse()
            elif mutation == "period_gap":
                cash["periods"][1]["start"] = "2026-02-02"
            elif mutation == "bad_date":
                cash["transactions"][0]["date"] = "2026-02-30"
            elif mutation == "missing_amount":
                del cash["transactions"][0]["amount"]
            else:
                cash["transactions"][0]["currency"] = "USD"
            with self.subTest(mutation=mutation), self.assertRaises(TOOL.InputError):
                TOOL.calculate(data)

    def test_reject_unsupported_models_and_fractional_indivisible_units(self):
        for model in ("multi_product", "step_cost"):
            data = self.scenario(2)
            data["scenarios"][0]["operating"]["model"] = model
            with self.subTest(model=model), self.assertRaises(TOOL.InputError):
                TOOL.calculate(data)
        data = self.scenario(2)
        data["scenarios"][0]["operating"]["periods"][0]["quantity"] = "0.5"
        with self.assertRaises(TOOL.InputError):
            TOOL.calculate(data)

    def test_compound_enum_values_report_field_path(self):
        paths = [
            (0, ("cash", "transactions", 0, "category")),
            (0, ("cash", "transactions", 0, "direction")),
            (0, ("cash", "transactions", 0, "nature")),
            (0, ("nature",)),
            (2, ("operating", "model")),
            (3, ("investment", "perspective")),
            (3, ("investment", "frequency")),
            (3, ("investment", "rate_frequency")),
        ]
        for index, path in paths:
            for value in ([], {}, ["actual"], {"value": "year"}, None, True):
                data = self.scenario(index)
                target = data["scenarios"][0]
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = value
                with self.subTest(path=path, value=value), self.assertRaises(TOOL.InputError) as error:
                    TOOL.calculate(data)
                self.assertIn("scenarios[0]", str(error.exception))
                self.assertIn("." + path[-1] + ":", str(error.exception))

    def test_reject_investment_frequency_rate_and_lifecycle_errors(self):
        for mutation in ("frequency", "bad_rate", "infinite", "missing_period", "lifecycle", "missing_component"):
            data = self.scenario(3)
            investment = data["scenarios"][0]["investment"]
            if mutation == "frequency":
                investment["rate_frequency"] = "month"
            elif mutation == "bad_rate":
                investment["discount_rate"] = "-1"
            elif mutation == "infinite":
                investment["discount_rate"] = "NaN"
            elif mutation == "missing_period":
                investment["periods"][1]["t"] = 2
            elif mutation == "lifecycle":
                investment["lifecycle_complete"] = False
            else:
                del investment["periods"][0]["working_capital_change"]
            with self.subTest(mutation=mutation), self.assertRaises(TOOL.InputError):
                TOOL.calculate(data)

    def test_cli_and_duplicate_json_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "input.json"
            destination = Path(directory) / "result.json"
            source.write_text(json.dumps(FIXTURE, ensure_ascii=False), encoding="utf-8")
            run = subprocess.run([sys.executable, str(ROOT / "scripts/calculate_economics.py"), str(source), "--output", str(destination)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(json.loads(destination.read_text(encoding="utf-8"))["scenarios"][0]["cash"]["additional_funding_need"], "6000")
            source.write_text('{"scenarios": [], "scenarios": []}', encoding="utf-8")
            with redirect_stderr(StringIO()) as errors:
                self.assertEqual(TOOL.main([str(source), "--output", str(destination)]), 2)
            self.assertIn("重复字段", errors.getvalue())


if __name__ == "__main__":
    unittest.main()
