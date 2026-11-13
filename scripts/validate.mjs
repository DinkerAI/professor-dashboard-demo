import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'public/index.html',
  'public/assets/demo.css',
  'public/assets/demo.js',
  'public/assets/peak-mark.svg',
  'public/data/demo.json',
  'public/_headers',
  'src/index.js',
  'wrangler.jsonc'
];

await Promise.all(requiredFiles.map(file => access(resolve(root, file))));

const [html, browserJs, workerJs, rawData, rawWrangler] = await Promise.all([
  readFile(resolve(root, 'public/index.html'), 'utf8'),
  readFile(resolve(root, 'public/assets/demo.js'), 'utf8'),
  readFile(resolve(root, 'src/index.js'), 'utf8'),
  readFile(resolve(root, 'public/data/demo.json'), 'utf8'),
  readFile(resolve(root, 'wrangler.jsonc'), 'utf8')
]);

JSON.parse(rawData);
JSON.parse(rawWrangler);

const requiredHtmlMarkers = [
  'Professor Dashboard',
  'Portfolio demo',
  'CourtReserve assignment sync disabled',
  'https://github.com/DinkerAI/professor-dashboard-demo'
];

for (const marker of requiredHtmlMarkers) {
  if (!html.includes(marker)) throw new Error(`Missing required HTML marker: ${marker}`);
}

const prohibitedRuntimeMarkers = [
  'api.peakpickleball.us',
  'admin-ajax.php',
  'PeakSQL.db',
  'peak_instructor.db'
];

for (const marker of prohibitedRuntimeMarkers) {
  if (browserJs.includes(marker) || workerJs.includes(marker)) {
    throw new Error(`Production runtime reference found: ${marker}`);
  }
}

console.log('Validated Cloudflare configuration, static assets, fictional data, and runtime boundaries.');
