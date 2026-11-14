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
if (!Array.isArray(data.policy?.membershipTypes) || data.policy.membershipTypes.length < 1) {
  throw new Error('The fictional membership catalog is missing.');
}
if (!Array.isArray(data.policy?.conversions) || data.policy.conversions.length < 1) {
  throw new Error('The fictional conversion mappings are missing.');
}
const playTypeIds = new Set(data.policy.playTypes.map(type => type.id));
const tierIds = new Set(data.policy.tiers.map(tier => tier.id));
const scopedPlayTypeIds = new Set();
for (const [category, config] of Object.entries(data.policy.catalogScope || {})) {
  const categoryTypes = data.policy.playTypes.filter(type => type.category === category);
  if (!categoryTypes.length) throw new Error(`Unknown scoped category ${category}.`);
  if (!['all', 'selected'].includes(config.mode)) throw new Error(`Invalid scope mode for ${category}.`);
  const ids = config.mode === 'all' ? categoryTypes.map(type => type.id) : config.playTypeIds || [];
  for (const id of ids) {
    if (!playTypeIds.has(id)) throw new Error(`Unknown scoped play type ${id}.`);
    scopedPlayTypeIds.add(id);
  }
}
if (!scopedPlayTypeIds.size) throw new Error('The program catalog scope is empty.');
for (const tier of data.policy.tiers) {
  for (const id of tier.allowedPlayTypeIds) {
    if (!playTypeIds.has(id)) throw new Error(`Unknown play type ${id} in ${tier.id}.`);
    if (!scopedPlayTypeIds.has(id)) throw new Error(`Out-of-scope play type ${id} in ${tier.id}.`);
  }
}
const levelTwo = data.policy.tiers.find(tier => tier.id === 'level-2');
const admittedPlayTypeCount = Object.values(data.policy.catalogScope).reduce((total, config) => {
  if (config.mode === 'all') return total;
  return total + (config.playTypeIds || []).length;
}, 0);
if (!levelTwo || levelTwo.allowedPlayTypeIds.length >= admittedPlayTypeCount) {
  throw new Error('Maya’s sample Level 2 policy must demonstrate restricted admitted play types.');
}
for (const instructor of data.policy.instructors) {
  if (!tierIds.has(instructor.tierId)) throw new Error(`Unknown tier for ${instructor.id}.`);
}
for (const incentive of data.policy.incentives) {
  if (!incentive.name || !incentive.benefit || Number(incentive.threshold) < 0) {
    throw new Error(`Invalid incentive ${incentive.id}.`);
  }
}
const membershipIds = new Set(data.policy.membershipTypes.map(membership => membership.id));
for (const conversion of data.policy.conversions) {
  if (!scopedPlayTypeIds.has(conversion.sourcePlayTypeId)) {
    throw new Error(`Conversion ${conversion.id} starts outside the program catalog.`);
  }
  if (!['membership', 'play-type'].includes(conversion.outcomeType)) {
    throw new Error(`Invalid outcome type for ${conversion.id}.`);
  }
  if (!Array.isArray(conversion.outcomeIds) || conversion.outcomeIds.length < 1) {
    throw new Error(`Conversion ${conversion.id} needs at least one destination.`);
  }
  for (const outcomeId of conversion.outcomeIds) {
    const validOutcome = conversion.outcomeType === 'membership'
      ? membershipIds.has(outcomeId)
      : playTypeIds.has(outcomeId);
    if (!validOutcome) throw new Error(`Invalid outcome ${outcomeId} for ${conversion.id}.`);
  }
  if (Number(conversion.windowValue) < 1 || !['hours', 'days'].includes(conversion.windowUnit)) {
    throw new Error(`Invalid attribution window for ${conversion.id}.`);
  }
  if (Number(conversion.conversionPoints) < 0) throw new Error(`Invalid conversion points for ${conversion.id}.`);
}
if (
  !browserJs.includes('openCatalogSetup') ||
  !browserJs.includes('applyCatalogSetup') ||
  !browserJs.includes('renderCatalogSetupDialog') ||
  !browserJs.includes('renderInstructorAdminHistory') ||
  !browserJs.includes('toggleInstructorHistory') ||
  !browserJs.includes('renderConversionAdministration') ||
  !browserJs.includes('addConversion') ||
  !browserJs.includes('data-conversion-field') ||
  !browserJs.includes('data-conversion-destination') ||
  !browserJs.includes('setConversionDestination') ||
  !browserJs.includes('effectivePolicy') ||
  !browserJs.includes('scopedCategories') ||
  !browserJs.includes('classes outside the facility catalog stay hidden') ||
  !browserJs.includes('renderIncentiveAdministration') ||
  !browserJs.includes('addInstructorType') ||
  !browserJs.includes('resetInstructorPassword') ||
  !browserJs.includes('captureCollectorLayouts')
) {
  throw new Error('Program administration behaviors are missing.');
}
if (!demoHtml.includes('goal-card__controls') || !demoHtml.includes('id="primary-action"')) {
  throw new Error('The sticky progress card must contain the selection confirmation action.');
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
