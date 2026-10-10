"""检查决策底稿，并按显式报告与变更编号定位需要复核的位置。"""
import argparse
from collections import deque
from dataclasses import dataclass
from pathlib import Path
import re

KINDS = {'E': '证据', 'J': '判断', 'H': '假设', 'O': '选项', 'D': '决策', 'P': '工程', 'U': '单元', 'T': '指标'}
NATURES = {'已核验事实', '来源陈述', '计算结果', '待验证假设', '规划目标', '合成示例', '不适用'}
STATES = {'待核验', '暂定', '现行', '待复核', '已替代', '停止'}
RELATIONS = {'支持', '挑战', '选择', '依据', '落实', '检验', '衡量', '记录', '依赖'}
REFERENCE = re.compile(r'([EJHODPUT]\d+)(?:@(r[1-9]\d*))?')
REPORT_REFERENCE = re.compile(r'(?<![A-Za-z0-9_@])([EJHODPUT]\d+)@(r[1-9]\d*)(?![A-Za-z0-9_@])')
HISTORY_HEADING = re.compile(
    r'^(?:(?:\d+|[一二三四五六七八九十百]+)[.、]\s*'
    r'|[（(](?:\d+|[一二三四五六七八九十百]+)[）)]\s*)?'
    r'(?:历史|历史记录|历史引用|历史版本|修订历史|归档|归档记录|归档引用|归档版本)'
    r'(?:\s*[:：]\s*.+)?$'
)
RELATION_TYPES = {
    '支持': {('E', 'J'), ('E', 'H'), ('J', 'O')},
    '挑战': {('E', 'J'), ('E', 'H'), ('J', 'O')},
    '选择': {('D', 'O')}, '依据': {('P', 'J'), ('P', 'D')},
    '落实': {('U', 'P'), ('U', 'D')}, '检验': {('U', 'H')},
    '衡量': {('T', 'H'), ('T', 'P'), ('T', 'U')}, '记录': {('E', 'T')},
}
REVERSE_RELATIONS = {'选择', '依据', '落实', '检验', '衡量', '记录', '依赖'}

def tables(text):
    header = None
    for line in text.splitlines():
        if not line.strip().startswith('|'):
            header = None
            continue
        cells = [x.strip() for x in line.strip().strip('|').split('|')]
        if all(re.fullmatch(r':?-+:?', x) for x in cells):
            continue
        if header is None:
            header = cells
        elif len(cells) == len(header):
            yield dict(zip(header, cells))
        else:
            yield {'_error': '表格列数不一致: ' + line}

def ledger_data(text):
    """解析当前表与完整历史表；历史记录不混入当前节点。"""
    errors, nodes, history, edges = [], {}, {}, []
    for row in tables(text):
        if '_error' in row:
            errors.append(row['_error'])
        if 'ID' in row and '类型' in row:
            ident = row['ID']
            if not re.fullmatch(r'[EJHODPUT]\d+', ident):
                errors.append('非法ID: ' + ident)
                continue
            if ident in nodes:
                errors.append('重复ID: ' + ident)
                continue
            nodes[ident] = row
        if '历史ID' in row and '类型' in row:
            ident, revision = row['历史ID'], row.get('修订', '')
            if not re.fullmatch(r'[EJHODPUT]\d+', ident):
                errors.append('非法历史ID: ' + ident)
                continue
            key = (ident, revision)
            if key in history:
                errors.append('重复历史修订: ' + ident + '@' + revision)
            history[key] = row
        if '起点' in row and '终点' in row:
            edges.append(row)
    if not nodes:
        errors.append('未发现节点表')
    for ident, row in list(nodes.items()) + [(key[0], row) for key, row in history.items()]:
        if KINDS[ident[0]] != row['类型']:
            errors.append('类型与ID不符: ' + ident)
        if not re.fullmatch(r'r[1-9]\d*', row.get('修订', '')):
            errors.append('修订缺失或无效: ' + ident)
        if row.get('性质') not in NATURES or row.get('状态') not in STATES:
            errors.append('性质或状态不在词表: ' + ident)
    for ident, revision in history:
        if ident in nodes and revision == nodes[ident].get('修订'):
            errors.append('历史修订与当前修订重复: ' + ident + '@' + revision)
    return nodes, history, edges, errors


def valid_edge(row, nodes):
    """类型与方向成立的关系才进入传播图。依赖关系允许跨类型。"""
    relation = row.get('关系')
    ends = [REFERENCE.fullmatch(row[side]) for side in ('起点', '终点')]
    if relation not in RELATIONS or any(end is None or end[1] not in nodes for end in ends):
        return False
    kinds = (ends[0][1][0], ends[1][1][0])
    return relation == '依赖' or kinds in RELATION_TYPES.get(relation, set())


def check(text):
    nodes, history, edges, errors = ledger_data(text)
    warnings = []
    for row in edges:
        if row.get('关系') not in RELATIONS:
            errors.append('未知关系: ' + row.get('关系', ''))
        for side in ('起点', '终点'):
            raw = row[side]
            match = REFERENCE.fullmatch(raw)
            if not match or match[1] not in nodes:
                errors.append('悬空或非法引用: ' + raw)
                continue
            node = nodes[match[1]]
            if match[2] and match[2] != node.get('修订'):
                label = '已登记历史修订需核对引用用途: ' if (match[1], match[2]) in history else '非当前修订未在本底稿历史表登记: '
                warnings.append(label + raw)
            if node.get('状态') in {'待复核', '已替代', '停止'}:
                warnings.append('引用非现行对象需复核: ' + raw)
        if not row.get('理由或派生位置'):
            warnings.append('关系缺理由或位置: ' + row['起点'])
        endpoints = [REFERENCE.fullmatch(row[side]) for side in ('起点', '终点')]
        known_endpoints = all(match and match[1] in nodes for match in endpoints)
        if row.get('关系') in RELATIONS and known_endpoints and not valid_edge(row, nodes):
            errors.append('关系类型或方向不符: ' + row['起点'] + ' ' + row['关系'] + ' ' + row['终点'])
    for ident, row in nodes.items():
        if ident.startswith('P'):
            targets = {e['终点'].split('@')[0][:1] for e in edges if e['起点'].split('@')[0] == ident and e.get('关系') == '依据'}
            if not {'J', 'D'} <= targets:
                warnings.append('工程需核对判断与决定依据: ' + ident)
    return errors, sorted(set(warnings))


def affected_objects(text, changed):
    """返回变更对象的下游及一条可回查的路径，不将待复核等同失效。"""
    nodes, history, edges, _ = ledger_data(text)
    roots = set()
    for raw in changed:
        match = REFERENCE.fullmatch(raw)
        if not match:
            raise ValueError('非法变更编号: ' + raw)
        ident, revision = match.groups()
        if ident not in nodes:
            raise ValueError('变更编号未在当前节点表登记: ' + raw)
        if revision and revision != nodes[ident].get('修订') and (ident, revision) not in history:
            raise ValueError('变更修订未在本底稿登记: ' + raw)
        roots.add(ident)
    graph = {ident: set() for ident in nodes}
    for row in edges:
        if not valid_edge(row, nodes):
            continue
        start, end = (REFERENCE.fullmatch(row[side])[1] for side in ('起点', '终点'))
        if row['关系'] in REVERSE_RELATIONS:
            start, end = end, start
        graph[start].add(end)
    paths = {ident: (ident,) for ident in roots}
    queue = deque(sorted(roots))
    while queue:
        current = queue.popleft()
        for target in sorted(graph[current]):
            if target not in paths:
                paths[target] = paths[current] + (target,)
                queue.append(target)
    return {ident: paths[ident] for ident in sorted(paths) if ident not in roots}


@dataclass(frozen=True)
class ReportFinding:
    path: str
    line: int
    heading: str
    reference: str
    issues: tuple
    historical: bool


def scan_report(text, path, ledger_text, changed=()):
    """扫描一份显式提供的文本；历史章节保留其用途，代码围栏不作正文引用。"""
    nodes, history, _, _ = ledger_data(ledger_text)
    affected = affected_objects(ledger_text, changed)
    changed_ids = {REFERENCE.fullmatch(raw)[1] for raw in changed}
    findings, headings, fence = [], [], None
    for number, line in enumerate(text.splitlines(), 1):
        fence_match = re.match(r'^\s{0,3}(`{3,}|~{3,})', line)
        if fence_match:
            mark = fence_match[1]
            if fence is None:
                fence = mark
            elif mark[0] == fence[0] and len(mark) >= len(fence):
                fence = None
            continue
        if fence is not None:
            continue
        heading_match = re.match(r'^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$', line)
        if heading_match:
            level, title = len(heading_match[1]), heading_match[2]
            while headings and headings[-1][0] >= level:
                headings.pop()
            headings.append((level, title))
        title = headings[-1][1] if headings else '文首'
        historical = any(HISTORY_HEADING.match(item[1]) for item in headings)
        for match in REPORT_REFERENCE.finditer(line):
            ident, revision = match.groups()
            issues = []
            if ident not in nodes:
                if (ident, revision) in history:
                    issues.append('仅有历史记录')
                else:
                    issues.append('未知对象')
            else:
                node = nodes[ident]
                if revision != node.get('修订'):
                    registered_history = (ident, revision) in history
                    issues.append('历史修订已登记' if registered_history else '修订未登记')
                    current_revision = node.get('修订', '')
                    older_revision = (re.fullmatch(r'r[1-9]\d*', current_revision)
                                      and int(revision[1:]) < int(current_revision[1:]))
                    if not historical and (registered_history or older_revision):
                        issues.append('旧修订需复核')
                if not historical:
                    if node.get('状态') in {'待复核', '已替代', '停止'}:
                        issues.append('对象状态需复核')
                    if ident in changed_ids:
                        issues.append('变更对象需复核')
                    elif ident in affected:
                        issues.append('下游引用需复核')
            if issues:
                findings.append(ReportFinding(str(path), number, title, match[0], tuple(issues), historical))
    return findings


def read_markdown(path, report=False):
    if report and path.suffix.lower() not in {'.md', '.markdown'}:
        raise ValueError('报告应为Markdown文件: ' + str(path))
    if not path.is_file():
        raise ValueError('输入不是可读文件: ' + str(path))
    try:
        return path.read_text(encoding='utf-8-sig')
    except UnicodeError as exc:
        raise ValueError('文件不是有效的UTF-8文本: ' + str(path)) from exc

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ledger', type=Path)
    parser.add_argument('--report', type=Path, action='append', default=[], help='显式指定Markdown报告，可重复；只读取列出的文件')
    parser.add_argument('--changed', action='append', default=[], help='变更对象ID或ID@rN，可重复；列出下游待复核对象')
    args = parser.parse_args()
    try:
        text = read_markdown(args.ledger)
        errors, warnings = check(text)
        affected = affected_objects(text, args.changed)
        findings = []
        for path in args.report:
            findings.extend(scan_report(read_markdown(path, report=True), path, text, args.changed))
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    for message in errors:
        print('ERROR:', message)
    for message in warnings:
        print('REVIEW:', message)
    for ident, route in affected.items():
        print('REVIEW:', ident, '需复核；影响路径:', ' → '.join(route))
    for item in findings:
        level = 'HISTORY' if item.historical and all(issue in {'历史修订已登记', '仅有历史记录'} for issue in item.issues) else 'REVIEW'
        print(f'{level}: {item.path}:{item.line} [{item.heading}] {item.reference}；' + '；'.join(item.issues))
    if args.report or args.changed:
        print(f'{len(affected)} downstream objects; {len(findings)} report locations; {len(args.report)} explicitly selected reports.')
        if errors:
            print('REVIEW: 先修复结构错误，再使用完整的影响范围。')
    print(f'{len(errors)} structural errors; {len(warnings)} review items. Evidence quality requires human review.')
    raise SystemExit(1 if errors else 0)

if __name__ == '__main__':
    main()
