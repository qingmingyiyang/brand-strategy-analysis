#!/usr/bin/env python3
"""按显式输入复算现金、单产品经营贡献与等间隔投资净现值。"""

import argparse
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING, localcontext
import json
from pathlib import Path
import sys


class InputError(ValueError):
    """携带字段位置的输入错误。"""


def obj(value, path, allowed, required):
    if not isinstance(value, dict):
        raise InputError(f"{path}: 需要对象")
    missing = set(required) - value.keys()
    extra = value.keys() - set(allowed)
    if missing or extra:
        raise InputError(f"{path}: 缺少字段 {sorted(missing)}；未知字段 {sorted(extra)}")
    return value


def text(value, path):
    if not isinstance(value, str) or not value.strip():
        raise InputError(f"{path}: 需要非空文字")
    return value


def choice(value, path, allowed):
    text(value, path)
    if value not in allowed:
        raise InputError(f"{path}: 使用 {'/'.join(allowed)}")
    return value


def number(value, path, minimum=None):
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise InputError(f"{path}: 金额和比率使用十进制字符串或 JSON 数字")
    try:
        result = Decimal(value)
    except InvalidOperation as exc:
        raise InputError(f"{path}: 数值无效") from exc
    if not result.is_finite() or (minimum is not None and result < minimum):
        raise InputError(f"{path}: 需要有限数值且不小于 {minimum}")
    # 控制计算范围，拒绝会溢出或耗尽精度的输入；不是业务金额上限。
    if result and (result.adjusted() > 24 or result.as_tuple().exponent < -12):
        raise InputError(f"{path}: 数值最多 25 位整数、12 位小数")
    return result


def day(value, path):
    text(value, path)
    try:
        result = date.fromisoformat(value)
    except ValueError as exc:
        raise InputError(f"{path}: 日期采用 YYYY-MM-DD") from exc
    if result.isoformat() != value:
        raise InputError(f"{path}: 日期采用 YYYY-MM-DD")
    return result


def rows(value, path):
    if not isinstance(value, list) or not value:
        raise InputError(f"{path}: 需要非空列表")
    return value


def periods(value, path, contiguous=False):
    parsed = []
    labels = set()
    for i, row in enumerate(rows(value, path)):
        loc = f"{path}[{i}]"
        if not isinstance(row, dict):
            raise InputError(f"{loc}: 需要期间对象")
        label = text(row.get("label"), loc + ".label")
        start, end = day(row.get("start"), loc + ".start"), day(row.get("end"), loc + ".end")
        if start > end or (parsed and start <= parsed[-1][2]):
            raise InputError(f"{loc}: 期间须按时间顺序排列且不重叠")
        if contiguous and parsed and start != parsed[-1][2] + timedelta(days=1):
            raise InputError(f"{loc}: 现金期间须连续，上一期末衔接下一期初")
        if label in labels:
            raise InputError(f"{loc}: 期间名称重复")
        labels.add(label)
        parsed.append((label, start, end))
    return parsed


def calculate_cash(data, path):
    fields = {"opening_cash", "minimum_cash", "periods", "transactions"}
    obj(data, path, fields, fields)
    opening = number(data["opening_cash"], path + ".opening_cash")
    minimum = number(data["minimum_cash"], path + ".minimum_cash", 0)
    windows = periods(data["periods"], path + ".periods", contiguous=True)
    for row in data["periods"]:
        obj(row, path + ".periods", {"label", "start", "end"}, {"label", "start", "end"})
    transactions = data["transactions"]
    if not isinstance(transactions, list):
        raise InputError(f"{path}.transactions: 需要列表，可为空")
    ordered = []
    previous = None
    for i, row in enumerate(transactions):
        loc = f"{path}.transactions[{i}]"
        required = {"date", "sequence", "category", "direction", "amount", "description"}
        obj(row, loc, required | {"source", "nature"}, required)
        when = day(row["date"], loc + ".date")
        sequence = row["sequence"]
        if isinstance(sequence, bool) or not isinstance(sequence, int) or sequence < 1:
            raise InputError(f"{loc}.sequence: 需要正整数，同日以此顺序计余额")
        key = (when, sequence)
        if previous is not None and key <= previous:
            raise InputError(f"{loc}: 收付须按日期和同日 sequence 严格递增，不自动排序")
        previous = key
        if not windows[0][1] <= when <= windows[-1][2]:
            raise InputError(f"{loc}: 收付日期在现金观察窗外")
        choice(row["category"], loc + ".category", ("operating", "investment", "existing_financing", "new_gap_financing"))
        choice(row["direction"], loc + ".direction", ("in", "out"))
        text(row["description"], loc + ".description")
        for field in {"source", "nature"} & row.keys():
            text(row[field], loc + "." + field)
        if "nature" in row:
            choice(row["nature"], loc + ".nature", ("actual", "forecast", "assumption"))
        amount = number(row["amount"], loc + ".amount", 0)
        ordered.append((when, row, amount if row["direction"] == "in" else -amount))
    before = after = opening
    low_before = low_after = opening
    output = []
    event_output = []
    for label, start, end in windows:
        period_open_before, period_open_after = before, after
        period_low_before, period_low_after = before, after
        totals = {kind: Decimal(0) for kind in ("operating", "investment", "existing_financing", "new_gap_financing")}
        for when, original, signed in ordered:
            if not start <= when <= end:
                continue
            if original["category"] != "new_gap_financing":
                before += signed
            after += signed
            totals[original["category"]] += signed
            period_low_before, period_low_after = min(period_low_before, before), min(period_low_after, after)
            event_output.append({**original, "balance_before_new_financing": before, "balance_after_new_financing": after})
        low_before, low_after = min(low_before, period_low_before), min(low_after, period_low_after)
        output.append({"label": label, "start": start.isoformat(), "end": end.isoformat(),
                       "opening_before_new_financing": period_open_before, "closing_before_new_financing": before,
                       "opening_after_new_financing": period_open_after, "closing_after_new_financing": after,
                       "minimum_before_new_financing": period_low_before, "minimum_after_new_financing": period_low_after,
                       "net_cash_by_category": totals})
    return {"minimum_cash_requirement": minimum, "lowest_before_new_financing": low_before,
            "additional_funding_need": max(Decimal(0), minimum - low_before),
            "lowest_after_new_financing": low_after,
            "remaining_funding_need": max(Decimal(0), minimum - low_after),
            "closing_before_new_financing": before, "closing_after_new_financing": after,
            "periods": output, "transactions": event_output}


def calculate_operating(data, path):
    fields = {"model", "quantity_unit", "indivisible_unit", "cost_scope", "periods"}
    obj(data, path, fields, fields)
    choice(data["model"], path + ".model", ("single_stable_product",))
    if type(data["indivisible_unit"]) is not bool:
        raise InputError(f"{path}.indivisible_unit: 需要 true 或 false")
    text(data["quantity_unit"], path + ".quantity_unit")
    text(data["cost_scope"], path + ".cost_scope")
    periods(data["periods"], path + ".periods")
    result = []
    for i, row in enumerate(data["periods"]):
        loc = f"{path}.periods[{i}]"
        fields = {"label", "start", "end", "quantity", "unit_net_revenue", "unit_sold_variable_cost", "fixed_cost"}
        obj(row, loc, fields, fields)
        quantity, revenue, variable, fixed = [number(row[k], loc + "." + k, 0) for k in
                                               ("quantity", "unit_net_revenue", "unit_sold_variable_cost", "fixed_cost")]
        if data["indivisible_unit"] and quantity != quantity.to_integral_value():
            raise InputError(f"{loc}.quantity: 不可分单位的数量须为整数")
        contribution = revenue - variable
        breakeven = fixed / contribution if contribution > 0 else None
        if breakeven is not None and data["indivisible_unit"]:
            breakeven = breakeven.to_integral_value(rounding=ROUND_CEILING)
        result.append({**row, "unit_contribution": contribution, "period_contribution": quantity * contribution,
                       "operating_surplus_within_cost_scope": quantity * contribution - fixed,
                       "breakeven_quantity": breakeven,
                       "status": "positive_contribution" if contribution > 0 else "no_positive_contribution"})
    return {"quantity_unit": data["quantity_unit"], "cost_scope": data["cost_scope"], "periods": result}


def calculate_investment(data, path):
    fields = {"perspective", "frequency", "rate_frequency", "discount_rate", "lifecycle_complete", "cash_scope", "periods"}
    obj(data, path, fields, fields)
    choice(data["perspective"], path + ".perspective", ("project_pre_financing", "investor_cash_flow"))
    choice(data["frequency"], path + ".frequency", ("month", "quarter", "year"))
    choice(data["rate_frequency"], path + ".rate_frequency", ("month", "quarter", "year"))
    if data["rate_frequency"] != data["frequency"]:
        raise InputError(f"{path}.rate_frequency: 须与 frequency 一致；工具不自动换算利率")
    rate = number(data["discount_rate"], path + ".discount_rate")
    if rate <= -1:
        raise InputError(f"{path}.discount_rate: 折现率须大于 -1，10% 填 0.10")
    if data["lifecycle_complete"] is not True:
        raise InputError(f"{path}.lifecycle_complete: 补齐准备到退出或有依据的期末延续价值，再填 true")
    text(data["cash_scope"], path + ".cash_scope")
    output = []
    npv = cumulative = Decimal(0)
    for i, row in enumerate(rows(data["periods"], path + ".periods")):
        loc = f"{path}.periods[{i}]"
        fields = {"t", "label", "stage"}
        components = ({"operating_before_working_capital", "capital_spend", "working_capital_change", "net_asset_recovery"}
                      if data["perspective"] == "project_pre_financing" else {"investor_contribution", "investor_distribution"})
        obj(row, loc, fields | components, fields | components)
        if type(row["t"]) is not int or row["t"] != i:
            raise InputError(f"{loc}.t: 等间隔时点须从 0 连续递增，缺期用显式零值")
        text(row["label"], loc + ".label")
        text(row["stage"], loc + ".stage")
        values = {key: number(row[key], loc + "." + key) for key in components}
        if data["perspective"] == "project_pre_financing":
            if values["capital_spend"] < 0:
                raise InputError(f"{loc}.capital_spend: 支出填非负数，资产净回收另列")
            cash = values["operating_before_working_capital"] - values["capital_spend"] - values["working_capital_change"] + values["net_asset_recovery"]
        else:
            if min(values.values()) < 0:
                raise InputError(f"{loc}: 投资者出资与分配均填非负数")
            cash = values["investor_distribution"] - values["investor_contribution"]
        present = cash / (Decimal(1) + rate) ** i
        cumulative += cash
        npv += present
        output.append({**row, "net_cash": cash, "present_value": present, "cumulative_undiscounted_cash": cumulative})
    if len(output) < 2:
        raise InputError(f"{path}.periods: 至少包含 t=0 和一个后续期")
    return {"perspective": data["perspective"], "frequency": data["frequency"], "rate_frequency": data["rate_frequency"],
            "discount_rate": rate, "cash_scope": data["cash_scope"], "npv": npv,
            "total_undiscounted_cash": cumulative, "periods": output}


def calculate(document):
    obj(document, "input", {"scenarios"}, {"scenarios"})
    output, names = [], set()
    with localcontext() as ctx:
        ctx.prec = 100
        for i, scenario in enumerate(rows(document["scenarios"], "scenarios")):
            path = f"scenarios[{i}]"
            required = {"name", "subject", "currency", "monetary_unit", "nature", "source", "basis"}
            obj(scenario, path, required | {"cash", "operating", "investment"}, required)
            for key in required:
                text(scenario[key], path + "." + key)
            if scenario["name"] in names:
                raise InputError(f"{path}.name: 情景名称重复")
            names.add(scenario["name"])
            choice(scenario["nature"], path + ".nature", ("actual", "forecast", "assumption"))
            result = {key: scenario[key] for key in required}
            modules = {"cash": calculate_cash, "operating": calculate_operating, "investment": calculate_investment}
            if not any(key in scenario for key in modules):
                raise InputError(f"{path}: 至少提供 cash/operating/investment 中一项")
            for key, function in modules.items():
                if key in scenario:
                    result[key] = function(scenario[key], path + "." + key)
            output.append(result)
    return {"scenarios": output}


def reject_constant(value):
    raise InputError(f"JSON: 非有限数值 {value}")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InputError(f"JSON: 重复字段 {key}")
        result[key] = value
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON 情景文件，金额推荐使用字符串")
    parser.add_argument("--output", type=Path, help="结果 JSON；省略时写标准输出")
    args = parser.parse_args(argv)
    try:
        if args.output and args.output.resolve() == args.input.resolve():
            raise InputError("输出路径须与输入文件不同")
        document = json.loads(args.input.read_text(encoding="utf-8-sig"), parse_float=Decimal,
                              parse_constant=reject_constant, object_pairs_hook=unique_object)
        result = calculate(document)
        rendered = json.dumps(result, ensure_ascii=False, indent=2, default=lambda value: format(value, "f")) + "\n"
        if args.output:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            print(rendered, end="")
    except (InputError, json.JSONDecodeError, OSError, InvalidOperation, OverflowError) as exc:
        print(f"输入或计算错误：{exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
