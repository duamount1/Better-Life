import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY = 'https://github.com/eternity4719/HowToLiveBetter';
const DESTINATION = resolve(ROOT, 'content/source');
const fromIndex = process.argv.indexOf('--from');
let temporaryDirectory;
const upstream = fromIndex >= 0 ? resolve(ROOT, process.argv[fromIndex + 1]) : (() => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'life-flashcards-upstream-'));
  const checkout = join(temporaryDirectory, 'checkout');
  execFileSync('git', ['clone', '--depth', '1', `${REPOSITORY}.git`, checkout], { stdio: 'inherit' });
  return checkout;
})();

try {
  const readme = readFileSync(join(upstream, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const bookFiles = [...new Set([...readme.matchAll(/\]\((book\/[^)#]+\.md)\)/g)].map(match => match[1]))].sort();
  const guideFiles = [...new Set([...readme.matchAll(/\]\((docs\/[^)#/]+\.md)\)/g)].map(match => match[1]))].sort();
  if (!bookFiles.length) throw new Error('The upstream README does not list any book chapters.');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream }).toString().trim();
  const revisionDate = execFileSync('git', ['log', '-1', '--format=%cI'], { cwd: upstream }).toString().trim();
  const files = ['README.md', 'LICENSE', ...bookFiles, ...guideFiles];
  mkdirSync(DESTINATION, { recursive: true });
  for (const file of files) {
    if (!existsSync(join(upstream, file))) throw new Error(`Upstream source is missing: ${file}`);
    const target = join(DESTINATION, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(upstream, file), target);
  }
  const manifest = {
    schemaVersion: 1,
    repository: REPOSITORY,
    title: '高性价比人生指南',
    author: 'eternity4719',
    upstreamCommit: revision,
    upstreamCommittedAt: revisionDate,
    synchronizedOn: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()),
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    files,
    bookFiles,
    guideFiles,
    snapshotNote: '仅保留 README、CC BY 正文、长文与许可证；不复制上游代码、skills、代理指令或 Git 元数据。',
  };
  writeFileSync(resolve(ROOT, 'content/source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  copyFileSync(join(upstream, 'LICENSE'), resolve(ROOT, 'content/LICENSE-CC-BY-4.0'));
  console.log(`Saved source snapshot: ${bookFiles.length} chapters, ${guideFiles.length} supplementary guides, ${revision}.`);
  execFileSync(process.execPath, [resolve(ROOT, 'scripts/content-build.mjs')], { stdio: 'inherit' });
} finally {
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
}
