"""Make the public, self-contained source download without hosting identities."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
target = root / 'dist' / 'life-flashcards-source.zip'
files = [root / name for name in ['README.md', 'LICENSE', 'package.json', '.gitignore']]
for folder in ['.github', 'dist', 'content/source', 'scripts', 'tests']:
    files.extend(p for p in (root / folder).rglob('*') if p.is_file())
files.extend(p for p in (root / 'content').glob('*') if p.is_file())
with ZipFile(target, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(set(files)):
        if path == target or '__pycache__' in path.parts or path.name == '.DS_Store':
            continue
        archive.write(path, 'how-to-live-better-github/' + str(path.relative_to(root)))
print(f'{target}: {target.stat().st_size:,} bytes')
