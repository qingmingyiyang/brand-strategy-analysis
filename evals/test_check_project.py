"""聚焦验证更正对象的传播方向及报告中的可见位置。"""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts' / 'check_project.py'
SPEC = importlib.util.spec_from_file_location('brand_check_project', SCRIPT)
checker = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = checker
SPEC.loader.exec_module(checker)


def ledger(identifiers, edges=(), history=()):
    text = '| ID | 修订 | 类型 | 性质 | 状态 |\n|---|---|---|---|---|\n'
    for ident in identifiers:
        text += f'| {ident} | r2 | {checker.KINDS[ident[0]]} | 不适用 | 现行 |\n'
    text += '\n| 起点 | 关系 | 终点 | 理由或派生位置 |\n|---|---|---|---|\n'
    for start, relation, end in edges:
        text += f'| {start} | {relation} | {end} | 合成练习 |\n'
    if history:
        text += '\n| 历史ID | 修订 | 类型 | 性质 | 状态 |\n|---|---|---|---|---|\n'
        for ident, revision in history:
            text += f'| {ident} | {revision} | {checker.KINDS[ident[0]]} | 不适用 | 已替代 |\n'
    return text


class RevisionCheckerTests(unittest.TestCase):
    def setUp(self):
        self.text = (ROOT / 'evals' / 'fixtures' / 'decision-ledger.md').read_text(encoding='utf-8-sig')

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, encoding='utf-8')

    def test_original_api_and_cli(self):
        errors, warnings = checker.check(self.text)
        self.assertEqual([], errors)
        self.assertTrue(warnings)
        result = self.run_cli(ROOT / 'evals' / 'fixtures' / 'decision-ledger.md')
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn('0 structural errors', result.stdout)

    def test_locations_current_old_unknown_and_pending(self):
        report = (ROOT / 'evals' / 'fixtures' / 'revision-report.md').read_text(encoding='utf-8')
        found = checker.scan_report(report, '方案.md', self.text)
        old = next(item for item in found if item.reference == 'E004@r1' and not item.historical)
        self.assertEqual(('方案.md', 7, '收益判断'), (old.path, old.line, old.heading))
        self.assertIn('旧修订需复核', old.issues)
        self.assertIn('历史修订已登记', old.issues)
        pending = next(item for item in found if item.reference == 'P001@r2')
        self.assertIn('对象状态需复核', pending.issues)
        unknown = next(item for item in found if item.reference == 'E999@r1')
        self.assertEqual(('未知对象',), unknown.issues)
        self.assertFalse(any(item.reference == 'J001@r2' for item in found))

    def test_historical_sections_remain_history_and_do_not_leak_to_current(self):
        text = '# 方案\n## 二、历史引用\nE004@r1\n### 原稿\nJ001@r1\n## 三、当前\nE004@r1\n'
        found = checker.scan_report(text, '历史.md', self.text, ['E004'])
        self.assertEqual([True, True, False], [item.historical for item in found])
        self.assertEqual(('历史修订已登记',), found[0].issues)
        self.assertEqual(('历史修订已登记',), found[1].issues)
        self.assertIn('变更对象需复核', found[2].issues)
        self.assertIn('旧修订需复核', found[2].issues)

    def test_future_revision_not_mislabeled_old_and_code_not_scanned(self):
        text = 'E004@r99\n```markdown\nE999@r1\n```\nE004@r2\n'
        found = checker.scan_report(text, '段落.md', self.text)
        self.assertEqual(1, len(found))
        self.assertEqual(('修订未登记',), found[0].issues)

    def test_research_headings_with_history_words_still_require_review(self):
        text = ('# 方案\n## 二、历史引用：原稿\nE004@r1\n'
                '## 三、历史机遇与市场选择\nE004@r1\n'
                '## 四、归档服务设计\nE004@r1\n'
                '## 五、历史版本\nE004@r1\n')
        found = checker.scan_report(text, '方案.md', self.text)
        self.assertEqual([True, False, False, True], [item.historical for item in found])
        for item in found[1:3]:
            self.assertIn('旧修订需复核', item.issues)
        self.assertEqual(('历史修订已登记',), found[0].issues)
        self.assertEqual(('历史修订已登记',), found[3].issues)

    def test_dependency_direction_and_unrelated_objects(self):
        text = ledger(['E1', 'J1', 'O1', 'D1', 'P1', 'U1', 'T1', 'E2', 'H1', 'U2', 'T2', 'E9', 'J9'], [
            ('E1', '支持', 'J1'), ('J1', '支持', 'O1'), ('D1', '选择', 'O1'),
            ('P1', '依据', 'J1'), ('P1', '依据', 'D1'), ('U1', '落实', 'P1'),
            ('T1', '衡量', 'U1'), ('E2', '记录', 'T1'), ('E2', '挑战', 'H1'),
            ('U2', '检验', 'H1'), ('T2', '衡量', 'H1'), ('P1', '依赖', 'E1'),
            ('E9', '支持', 'J9'),
        ])
        self.assertEqual([], checker.check(text)[0])
        affected = checker.affected_objects(text, ['E1'])
        self.assertEqual({'J1', 'O1', 'D1', 'P1', 'U1', 'T1', 'E2', 'H1', 'U2', 'T2'}, set(affected))
        self.assertEqual(('E1', 'J1', 'O1', 'D1'), affected['D1'])
        self.assertEqual(set(), set(checker.affected_objects(text, ['T2'])))
        self.assertEqual({'D1', 'P1', 'U1', 'T1', 'E2', 'H1', 'U2', 'T2'}, set(checker.affected_objects(text, ['O1'])))

    def test_cycles_and_multiple_roots_are_finite(self):
        text = ledger(['E1', 'J1', 'E9'], [('E1', '支持', 'J1'), ('E1', '依赖', 'J1')])
        self.assertEqual({'J1'}, set(checker.affected_objects(text, ['E1', 'E9'])))
        self.assertEqual({}, checker.affected_objects(text, ['E1', 'J1']))

    def test_history_revision_checked_without_rejecting_registered_history(self):
        text = ledger(['E1', 'J1'], [('E1@r1', '支持', 'J1')], [('E1', 'r1')])
        self.assertEqual([], checker.check(text)[0])
        self.assertEqual({'J1'}, set(checker.affected_objects(text, ['E1@r1'])))
        missing = ledger(['E1', 'J1'], [('E1@r1', '支持', 'J1')])
        self.assertEqual([], checker.check(missing)[0])
        self.assertTrue(any('未在本底稿历史表登记' in message for message in checker.check(missing)[1]))
        duplicate = ledger(['E1'], history=[('E1', 'r1'), ('E1', 'r1')])
        self.assertTrue(checker.check(duplicate)[0])

    def test_invalid_edge_types_are_reported_and_not_propagated(self):
        text = ledger(['E1', 'J1'], [('J1', '支持', 'E1')])
        self.assertTrue(checker.check(text)[0])
        self.assertEqual({}, checker.affected_objects(text, ['J1']))

    def test_invalid_changed_identifiers_and_revisions_are_explicit(self):
        for raw in ['../E004', 'E004@r0', 'E999', 'E004@r99']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                checker.affected_objects(self.text, [raw])

    def test_multiple_reports_changed_locations_and_no_implicit_scan(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            source = folder / '底稿.md'
            source.write_text(self.text, encoding='utf-8')
            first, second = folder / '定位.md', folder / '工程.md'
            first.write_text('# 定位\nJ001@r2\n', encoding='utf-8')
            second.write_text('# 工程\nU001@r1\n', encoding='utf-8')
            (folder / '未选.md').write_text('E999@r1', encoding='utf-8')
            result = self.run_cli(source, '--changed', 'E004', '--changed', 'J001', '--report', first, '--report', second)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertIn(f'{first}:2 [定位]', result.stdout)
            self.assertIn(f'{second}:2 [工程]', result.stdout)
            self.assertNotIn('未选.md', result.stdout)
            self.assertNotIn('E999', result.stdout)
            self.assertIn('2 explicitly selected reports', result.stdout)

    def test_cli_bad_path_encoding_and_changed_id(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            source, invalid = folder / '底稿.md', folder / '损坏.md'
            source.write_text(self.text, encoding='utf-8')
            invalid.write_bytes(b'\xff\xfe\xff')
            for args in [('--report', folder), ('--report', folder / '缺失.md'), ('--report', folder / '报告.txt'), ('--report', invalid), ('--changed', 'BAD')]:
                with self.subTest(args=args):
                    result = self.run_cli(source, *args)
                    self.assertEqual(2, result.returncode)
                    self.assertNotIn('Traceback', result.stderr)


if __name__ == '__main__':
    unittest.main()
