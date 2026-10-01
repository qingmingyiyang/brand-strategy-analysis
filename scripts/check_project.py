"""Check Markdown decision IDs and references; never infer evidence sufficiency."""
import argparse
from pathlib import Path
import re

KINDS = {'E': '证据', 'J': '判断', 'H': '假设', 'O': '选项', 'D': '决策', 'P': '工程', 'U': '单元', 'T': '指标'}
NATURES = {'已核验事实', '来源陈述', '计算结果', '待验证假设', '规划目标', '合成示例', '不适用'}
STATES = {'待核验', '暂定', '现行', '待复核', '已替代', '停止'}
RELATIONS = {'支持', '挑战', '选择', '依据', '落实', '检验', '衡量', '记录', '依赖'}

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

def check(text):
    errors, warnings, nodes, edges = [], [], {}, []
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
            if KINDS[ident[0]] != row['类型']:
                errors.append('类型与ID不符: ' + ident)
            if not re.fullmatch(r'r[1-9]\d*', row.get('修订', '')):
                errors.append('修订缺失或无效: ' + ident)
            if row.get('性质') not in NATURES or row.get('状态') not in STATES:
                errors.append('性质或状态不在词表: ' + ident)
        if '起点' in row and '终点' in row:
            edges.append(row)
    if not nodes:
        errors.append('未发现节点表')
    for row in edges:
        if row.get('关系') not in RELATIONS:
            errors.append('未知关系: ' + row.get('关系', ''))
        for side in ('起点', '终点'):
            raw = row[side]
            match = re.fullmatch(r'([EJHODPUT]\d+)(?:@(r[1-9]\d*))?', raw)
            if not match or match[1] not in nodes:
                errors.append('悬空或非法引用: ' + raw)
                continue
            node = nodes[match[1]]
            if match[2] and match[2] != node.get('修订'):
                warnings.append('非当前修订需查历史: ' + raw)
            if node.get('状态') in {'待复核', '已替代', '停止'}:
                warnings.append('引用非现行对象需复核: ' + raw)
        if not row.get('理由或派生位置'):
            warnings.append('关系缺理由或位置: ' + row['起点'])
    for ident, row in nodes.items():
        if ident.startswith('P'):
            targets = {e['终点'].split('@')[0][:1] for e in edges if e['起点'].split('@')[0] == ident and e.get('关系') == '依据'}
            if not {'J', 'D'} <= targets:
                warnings.append('工程需核对判断与决定依据: ' + ident)
    return errors, sorted(set(warnings))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ledger', type=Path)
    args = parser.parse_args()
    errors, warnings = check(args.ledger.read_text(encoding='utf-8-sig'))
    for message in errors:
        print('ERROR:', message)
    for message in warnings:
        print('REVIEW:', message)
    print(f'{len(errors)} structural errors; {len(warnings)} review items. Evidence quality requires human review.')
    raise SystemExit(1 if errors else 0)

if __name__ == '__main__':
    main()
