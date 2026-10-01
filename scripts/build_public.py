"""Build public brand skill from an explicit, reviewed allowlist; private paths are never traversed."""
from pathlib import Path
import argparse
import json
import posixpath
import re
from urllib.parse import unquote, urlsplit
import zipfile

PUBLIC_FILES = (Path(__file__).resolve().parents[1] / 'public-files.txt').read_text(encoding='utf-8').splitlines()


def validate_records(records):
    """Check the actual distributable set before writing a package or upload payload."""
    contents = {row['path']: row['content'] for row in records}
    if len(contents) != len(records):
        raise ValueError('Duplicate public path')
    for name in contents:
        if name.startswith('/') or '..' in name.split('/') or 'private' in name.split('/') or '\\' in name or ':' in name:
            raise ValueError('Unsafe public path: ' + name)
    groups = re.findall(r'^## ([A-Z]+)[：:]', contents['evals/cases.md'], re.M)
    if len(groups) != len(set(groups)):
        raise ValueError('Duplicate evaluation group ID')
    match = re.search(r'^  version: "([0-9]+\.[0-9]+\.[0-9]+)"$', contents['SKILL.md'], re.M)
    if not match:
        raise ValueError('Missing semantic version')
    version = match.group(1)
    if f'当前版本为 **{version}**' not in contents['README.md']:
        raise ValueError('README version differs from SKILL.md')
    latest = re.search(r'^## ([0-9]+\.[0-9]+\.[0-9]+)', contents['CHANGELOG.md'], re.M)
    if not latest or latest.group(1) != version:
        raise ValueError('CHANGELOG version differs from SKILL.md')
    for name, content in contents.items():
        if not name.endswith('.md'):
            continue
        targets = re.findall(r'\[[^\]\n]*\]\(([^)\n]+)\)', content)
        # Reference-style definitions carry paths even when the use site has no URL.
        targets += [angle or plain for angle, plain in re.findall(
            r'^ {0,3}\[(?!\^)[^\]\n]+\]:\s*(?:<([^>\n]+)>|(\S+))', content, re.M)]
        for target in targets:
            target = target.strip().strip('<>')
            parsed = urlsplit(target)
            if re.match(r'^[a-zA-Z]:', target) or target.startswith('\\\\') or parsed.scheme.lower() == 'file':
                raise ValueError(f'Local absolute reference in public file: {name}')
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            relative = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(parsed.path)))
            if relative not in contents:
                raise ValueError(f'Unpackaged local reference: {name} -> {target}')
    return version

def payload(source):
    source = Path(source).resolve(strict=True)
    result = []
    for relative in PUBLIC_FILES:
        if not relative or relative.startswith('/') or '..' in relative.split('/') or 'private' in relative.split('/') or '\\' in relative or ':' in relative:
            raise ValueError('Unsafe public path: ' + relative)
        target = source / relative
        current = target
        while current != source:
            if current.is_symlink() or getattr(current, 'is_junction', lambda: False)():
                raise ValueError('Linked public input: ' + relative)
            current = current.parent
        target.resolve(strict=True).relative_to(source)
        if not target.is_file():
            raise ValueError('Missing public file: ' + relative)
        result.append({'path': relative, 'mode': '100644', 'type': 'blob', 'content': target.read_text(encoding='utf-8')})
    validate_records(result)
    return result

def build(source, destination):
    records = payload(source)
    version = validate_records(records)
    destination = Path(destination)
    # Exclusive mode preserves prior version packages.
    with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED) as archive:
        for row in records:
            archive.writestr('brand-strategy-analysis/' + row['path'], row['content'].encode('utf-8'))
    with zipfile.ZipFile(destination) as archive:
        expected = ['brand-strategy-analysis/' + row['path'] for row in records]
        if archive.namelist() != expected:
            raise ValueError('Unexpected package entries')
        for row in records:
            if archive.read('brand-strategy-analysis/' + row['path']) != row['content'].encode('utf-8'):
                raise ValueError('Content mismatch: ' + row['path'])
    return version, len(records)

def main():
    project = Path.cwd()
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True, help='Explicit current skill source; historical copies are never selected implicitly')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--manifest', type=Path, help='Write allowlisted GitHub tree payload without uploading')
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    if args.check_only:
        records = payload(args.source)
        print(f'PASS: {validate_records(records)}; {len(records)} public files')
        return
    if args.manifest:
        records = payload(args.source)
        with args.manifest.open('x', encoding='utf-8') as stream:
            json.dump(records, stream, ensure_ascii=False, indent=2)
        print('Public payload prepared; no upload performed')
        return
    entry = (args.source/'SKILL.md').read_text(encoding='utf-8')
    version = re.search(r'^  version: "([0-9]+\.[0-9]+\.[0-9]+)"$', entry, re.M).group(1)
    output = args.output or project/('品牌战略分析Skill-v' + version + '.zip')
    version, count = build(args.source, output)
    print(f'PASS: v{version}; {count} allowlisted public files; {output}')

if __name__ == '__main__':
    main()
