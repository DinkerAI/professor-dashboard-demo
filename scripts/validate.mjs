import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'public/index.html',
  'public/court-reserve-instructor-dashboard/index.html',
  'public/assets/hub.css',
  'public/assets/demo.css',
  'public/assets/demo.js',
  'public/data/demo.json',
  'public/_headers',
  'src/index.js',
  'wrangler.jsonc'
];

await Promise.all(requiredFiles.map(file => access(resolve(root, file))));

const [hubHtml, demoHtml, browserJs, workerJs, rawData, rawWrangler] = await Promise.all([
  readFile(resolve(root, 'public/index.html'), 'utf8'),
  readFile(resolve(root, 'public/court-reserve-instructor-dashboard/index.html'), 'utf8'),
  readFile(resolve(root, 'public/assets/demo.js'), 'utf8'),
  readFile(resolve(root, 'src/index.js'), 'utf8'),
  readFile(resolve(root, 'public/data/demo.json'), 'utf8'),
  readFile(resolve(root, 'wrangler.jsonc'), 'utf8')
]);

JSON.parse(rawData);
JSON.parse(rawWrangler);

const requiredHubMarkers = [
  'Forward Canon Demo Library',
  '/court-reserve-instructor-dashboard/',
  'Demos you can actually use.'
];

const requiredDemoMarkers = [
  'Court Reserve Instructor Dashboard',
  'Interactive product concept',
  'Program administration',
  'No live Court Reserve connection',
  'https://github.com/DinkerAI/professor-dashboard-demo'
];

for (const marker of requiredHubMarkers) {
  if (!hubHtml.includes(marker)) throw new Error(`Missing required hub marker: ${marker}`);
}

for (const marker of requiredDemoMarkers) {
  if (!demoHtml.includes(marker)) throw new Error(`Missing required demo marker: ${marker}`);
}

const data = JSON.parse(rawData);
if (!Array.isArray(data.policy?.instructors) || data.policy.instructors.length < 1) {
  throw new Error('The fictional instructor roster is missing.');
}
if (!Array.isArray(data.policy?.incentives) || data.policy.incentives.length < 1) {
  throw new Error('The fictional incentive ladder is missing.');
}
const playTypeIds = new Set(data.policy.playTypes.map(type => type.id));
const tierIds = new Set(data.policy.tiers.map(tier => tier.id));
for (const tier of data.policy.tiers) {
  for (const id of tier.allowedPlayTypeIds) {
    if (!playTypeIds.has(id)) throw new Error(`Unknown play type ${id} in ${tier.id}.`);
  }
  for (const mode of Object.values(tier.categoryModes || {})) {
    if (!['show', 'restrict', 'hide'].includes(mode)) throw new Error(`Invalid category mode in ${tier.id}.`);
  }
}
for (const instructor of data.policy.instructors) {
  if (!tierIds.has(instructor.tierId)) throw new Error(`Unknown tier for ${instructor.id}.`);
}
for (const incentive of data.policy.incentives) {
  if (!incentive.name || !incentive.benefit || Number(incentive.threshold) < 0) {
    throw new Error(`Invalid incentive ${incentive.id}.`);
  }
}
if (
  !browserJs.includes('setCategoryMode') ||
  !browserJs.includes('renderIncentiveAdministration') ||
  !browserJs.includes('addInstructorType') ||
  !browserJs.includes('resetInstructorPassword') ||
  !browserJs.includes('captureCollectorLayouts')
) {
  throw new Error('Program administration behaviors are missing.');
}
if (!browserJs.includes("categoryModeFor(tier, type.category) === 'hide' && !allowed")) {
  throw new Error('Allowed play types must override category hiding.');
}
const accessPanelSource = browserJs.slice(
  browserJs.indexOf('function renderAccessAdministration'),
  browserJs.indexOf('function renderInstructorAdministration')
);
if (accessPanelSource.indexOf('renderPolicyEditor()') > accessPanelSource.indexOf('renderCategoryAccess()')) {
  throw new Error('Instructor policy must appear above category access.');
}
if (!workerJs.includes('demo.forwardcanon.com')) {
  throw new Error('The demo library custom domain is missing from the Worker.');
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

