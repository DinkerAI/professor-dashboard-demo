(() => {
  'use strict';

  const DATA_URL = '/data/demo.json';
  const views = [
    ['available', 'Available'],
    ['all', 'All Classes'],
    ['history', 'My History']
  ];

  let sourceData = null;
  let state = null;
  let alertTimer = null;
  let collectorFrame = 0;

  const elements = {
    reset: document.getElementById('reset-demo'),
    alert: document.getElementById('demo-alert'),
    experienceTabs: document.getElementById('experience-tabs'),
    goalCard: document.querySelector('.goal-card'),
    actionRow: document.querySelector('.action-row'),
    firstName: document.getElementById('profile-first-name'),
    profileName: document.getElementById('profile-name'),
    profileTier: document.getElementById('profile-tier'),
    progressCount: document.getElementById('progress-count'),
    progressTarget: document.getElementById('progress-target'),
    progressStatus: document.getElementById('progress-status'),
    progressRollover: document.getElementById('progress-rollover'),
    progressTrack: document.querySelector('.progress-track'),
    progressFill: document.getElementById('progress-fill'),
    rules: document.getElementById('rules-list'),
    tabs: document.getElementById('view-tabs'),
    primaryAction: document.getElementById('primary-action'),
    view: document.getElementById('dashboard-view')
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function slug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0';
    return Math.abs(number - Math.round(number)) < 0.001
      ? String(Math.round(number))
      : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  function tierById(policy, id) {
    return (policy?.tiers || []).find(tier => tier.id === id) || policy?.tiers?.[0] || null;
  }

  function activeTier(policy = state.data.policy) {
    return tierById(policy, state.data.profile.tierId);
  }

  function playTypeById(id, policy = state.data.policy) {
    return (policy?.playTypes || []).find(type => type.id === id) || null;
  }

  function isAllowed(playTypeId, policy = state.data.policy, tierId = state.data.profile.tierId) {
    const tier = tierById(policy, tierId);
    return Boolean(tier?.allowedPlayTypeIds?.includes(playTypeId));
  }

  function pointsForPlayType(playTypeId, policy = state.data.policy, tierId = state.data.profile.tierId) {
    const tier = tierById(policy, tierId);
    const type = playTypeById(playTypeId, policy);
    return Number(tier?.pointsByType?.[playTypeId] ?? type?.defaultPoints ?? 1);
  }

  function policyCategories(policy = state.data.policy) {
    return [...new Set((policy?.playTypes || []).map(type => type.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function sortedIncentives(policy = state.data.policy) {
    return [...(policy?.incentives || [])]
      .sort((a, b) => Number(a.threshold || 0) - Number(b.threshold || 0));
  }

  function resetState() {
    const data = clone(sourceData);
    state = {
      data,
      activeMode: 'instructor',
      activeView: 'available',
      activeFilters: new Set(policyCategories(data.policy).map(slug)),
      selectedAvailable: new Set(),
      stagedCoverageId: null,
      policyDraft: clone(data.policy),
      selectedTierId: data.profile.tierId,
      curationSection: 'access',
      curationSearch: '',
      policyDirty: false
    };
    render();
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function dateForClass(item) {
    const date = startOfToday();
    date.setDate(date.getDate() + Number(item.dayOffset || 0));
    const [hours, minutes] = String(item.start || '09:00').split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function dateForHistory(monthOffset, day, time) {
    const today = startOfToday();
    const date = new Date(today.getFullYear(), today.getMonth() + monthOffset, Number(day || 1));
    const [hours, minutes] = String(time || '09:00').split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function formatDay(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatMonth(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function formatTime(time) {
    const [hours, minutes] = String(time || '09:00').split(':').map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function formatRange(item) {
    return `${formatTime(item.start)}–${formatTime(item.end)}`;
  }

  function showAlert(message) {
    clearTimeout(alertTimer);
    elements.alert.textContent = message;
    elements.alert.classList.add('is-visible');
    alertTimer = setTimeout(() => elements.alert.classList.remove('is-visible'), 5200);
  }

  function renderProfile() {
    const profile = state.data.profile;
    const tier = activeTier();
    const target = Number(tier?.monthlyTargetPoints || 0);
    const rolloverCap = Number(tier?.rolloverCap || 0);
    const firstName = profile.name.split(/\s+/)[0] || 'Instructor';
    const percentage = target > 0
      ? Math.min(100, Math.round((profile.completedPoints / target) * 100))
      : 0;
    const nextIncentive = sortedIncentives().find(
      incentive => Number(incentive.threshold) > Number(profile.completedPoints)
    );

    elements.firstName.textContent = firstName;
    elements.profileName.textContent = profile.name;
    elements.profileTier.textContent = tier?.label || 'Instructor';
    elements.progressCount.textContent = formatNumber(profile.completedPoints);
    elements.progressTarget.textContent = formatNumber(target);
    elements.progressStatus.textContent = nextIncentive
      ? `${formatNumber(nextIncentive.threshold - profile.completedPoints)} points until ${nextIncentive.benefit}.`
      : 'All configured participation rewards are unlocked this month.';
    elements.progressRollover.textContent = `Rollover ${formatNumber(profile.rolloverPoints)}/${formatNumber(rolloverCap)}`;
    elements.progressTrack.setAttribute('aria-valuemax', String(target));
    elements.progressTrack.setAttribute('aria-valuenow', String(profile.completedPoints));
    elements.progressFill.style.width = `${percentage}%`;
    elements.rules.innerHTML = state.data.rules.map(rule => `<li>${escapeHtml(rule)}</li>`).join('');
  }

  function renderExperienceTabs() {
    elements.experienceTabs.querySelectorAll('[data-mode]').forEach(button => {
      const active = button.dataset.mode === state.activeMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function renderTabs() {
    elements.tabs.innerHTML = views.map(([key, label]) => `
      <button
        type="button"
        class="view-tab ${state.activeView === key ? 'is-active' : ''}"
        data-action="set-view"
        data-view="${key}"
        aria-current="${state.activeView === key ? 'page' : 'false'}"
      >${label}</button>
    `).join('');
  }

  function renderFilters() {
    return `
      <div class="filter-bar collectable" data-collectable aria-label="Filter classes">
        ${policyCategories().map(category => {
          const key = slug(category);
          return `
            <button
              type="button"
              class="filter-chip ${state.activeFilters.has(key) ? 'is-active' : ''}"
              data-action="toggle-filter"
              data-filter="${escapeHtml(key)}"
              aria-pressed="${state.activeFilters.has(key)}"
            >${escapeHtml(category)}</button>
          `;
        }).join('')}
      </div>
    `;
  }

  function fullInstructorName(initials) {
    return state.data.instructorDirectory?.[initials] || initials;
  }

  function renderInitials(items) {
    if (!items?.length) return '';
    const names = items.map(fullInstructorName);
    return `
      <div class="instructor-strip" aria-label="Assigned instructors: ${escapeHtml(names.join(', '))}">
        <div class="initials" aria-hidden="true">
          ${items.map(initials => `
            <span data-instructor-initial title="${escapeHtml(fullInstructorName(initials))}">${escapeHtml(initials)}</span>
          `).join('')}
        </div>
        <div class="instructor-tooltip" role="tooltip">
          <small>Assigned instructors</small>
          ${names.map(name => `<strong>${escapeHtml(name)}</strong>`).join('')}
        </div>
      </div>
    `;
  }

  function categoryForItem(item) {
    return playTypeById(item.playTypeId)?.category || 'Other';
  }

  function itemMatchesFilters(item) {
    return state.activeFilters.has(slug(categoryForItem(item)));
  }

  function eventState(item, context) {
    if (context === 'restricted') return `Restricted for ${activeTier()?.label || 'this instructor level'}`;
    if (context === 'readonly-mine') return item.coverageRequested ? 'Coverage requested' : 'You are teaching';
    if (context === 'readonly-available') return item.coverageNeeded ? 'Coverage needed' : 'Eligible';
    if (context === 'mine') {
      if (item.coverageRequested) return 'Coverage requested in concept';
      if (state.stagedCoverageId === item.id) return 'Coverage request staged';
      if (item.locked) return 'Click to request coverage';
      return 'Confirmed · teaching';
    }
    if (context === 'available') {
      if (state.selectedAvailable.has(item.id)) {
        return item.coverageNeeded ? 'Coverage takeover selected' : 'Selected';
      }
      return item.coverageNeeded ? 'Coverage needed' : 'Eligible';
    }
    if (context === 'full') return item.state || 'Full';
    return 'Eligible';
  }

  function renderEventCard(item, context = 'available') {
    const selected = state.selectedAvailable.has(item.id);
    const teaching = context === 'mine' || context === 'readonly-mine';
    const coverage = Boolean(item.coverageNeeded || item.coverageRequested || state.stagedCoverageId === item.id);
    const full = context === 'full';
    const restricted = context === 'restricted';
    const interactive = context === 'available' || (context === 'mine' && item.locked && !item.coverageRequested);
    const classes = [
      'event-card',
      'collectable',
      selected ? 'is-selected' : '',
      teaching ? 'is-teaching' : '',
      coverage ? 'is-coverage' : '',
      full ? 'is-full' : '',
      restricted ? 'is-restricted' : ''
    ].filter(Boolean).join(' ');
    const tag = interactive ? 'button' : 'article';
    const attrs = interactive
      ? `type="button" data-action="${context === 'available' ? 'toggle-class' : 'stage-coverage'}" data-class-id="${escapeHtml(item.id)}" aria-pressed="${context === 'available' ? selected : state.stagedCoverageId === item.id}"`
      : '';
    const points = pointsForPlayType(item.playTypeId);

    return `
      <${tag} class="${classes}" data-collectable ${attrs}>
        <div class="event-card__top">
          <div>
            <span class="event-card__category">${escapeHtml(categoryForItem(item))}</span>
            <h4 class="event-card__title">${escapeHtml(item.name)}</h4>
          </div>
          ${renderInitials(item.instructors)}
        </div>
        <div class="event-card__when">${formatDay(dateForClass(item))} · ${formatRange(item)}</div>
        <div class="event-card__meta">Courts ${escapeHtml(item.courts)} · Fill ${item.registered}/${item.capacity} · ${formatNumber(points)} pt</div>
        <div class="event-card__state">${escapeHtml(eventState(item, context))}</div>
        ${item.coverageNeeded ? `<span class="urgency-label">Inside ${state.data.policy.coverageWindowDays} days</span>` : ''}
      </${tag}>
    `;
  }

  function groupByDay(items) {
    const groups = new Map();
    items.forEach(item => {
      const key = dateForClass(item).toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return Array.from(groups.values()).sort((a, b) => dateForClass(a[0]) - dateForClass(b[0]));
  }

  function renderGroupedEvents(items, contextResolver) {
    if (!items.length) return '<div class="empty-state collectable" data-collectable>No classes match this policy and filter combination.</div>';
    return groupByDay(items).map(group => `
      <div class="day-group">
        <h4 class="day-heading collectable" data-collectable>${formatDay(dateForClass(group[0]))}</h4>
        <div class="event-grid">
          ${group.map(item => renderEventCard(item, typeof contextResolver === 'function' ? contextResolver(item) : contextResolver)).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderRewardProgress() {
    const completed = Number(state.data.profile.completedPoints || 0);
    const incentives = sortedIncentives();
    if (!incentives.length) return '';
    return `
      <section class="reward-ladder collectable" data-collectable aria-labelledby="reward-ladder-title">
        <div class="reward-ladder__intro">
          <p class="eyebrow">Participation rewards</p>
          <h3 id="reward-ladder-title">What the points unlock</h3>
          <p>Facility-defined member benefits—not wages or payroll compensation.</p>
        </div>
        <div class="reward-steps">
          ${incentives.map((incentive, index) => {
            const unlocked = completed >= Number(incentive.threshold);
            const previous = Number(incentives[index - 1]?.threshold || 0);
            const currentRange = Math.max(1, Number(incentive.threshold) - previous);
            const progress = Math.max(0, Math.min(100, ((completed - previous) / currentRange) * 100));
            return `
              <article class="reward-step ${unlocked ? 'is-unlocked' : ''}">
                <div class="reward-step__top">
                  <strong>${formatNumber(incentive.threshold)} points</strong>
                  <span>${unlocked ? 'Unlocked' : 'In progress'}</span>
                </div>
                <h4>${escapeHtml(incentive.name)}</h4>
                <p>${escapeHtml(incentive.benefit)}</p>
                <div class="reward-step__track"><span style="width:${unlocked ? 100 : progress}%"></span></div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function renderAvailableView() {
    const myClasses = state.data.myClasses;
    const available = state.data.availableClasses
      .filter(item => isAllowed(item.playTypeId))
      .filter(itemMatchesFilters)
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    const restrictedCount = state.data.availableClasses.filter(item => !isAllowed(item.playTypeId)).length;
    return `
      ${renderRewardProgress()}

      <section class="section-block" aria-labelledby="my-classes-title">
        <div class="section-header collectable" data-collectable>
          <div>
            <h3 id="my-classes-title">My Classes</h3>
            <p>Confirmed assignments and coverage controls.</p>
          </div>
        </div>
        <div class="event-grid">
          ${myClasses.map(item => renderEventCard(item, 'mine')).join('') || '<div class="empty-state collectable" data-collectable>No classes selected yet.</div>'}
        </div>
      </section>

      <section class="section-block" aria-labelledby="available-classes-title">
        <div class="section-header collectable" data-collectable>
          <div>
            <h3 id="available-classes-title">Eligible Classes</h3>
            <p>Filtered by the published ${escapeHtml(activeTier()?.label || 'instructor')} policy. ${restrictedCount} other play type${restrictedCount === 1 ? ' is' : 's are'} visible in All Classes.</p>
          </div>
        </div>
        ${renderFilters()}
        ${renderGroupedEvents(available, 'available')}
      </section>
    `;
  }

  function renderAllView() {
    const mine = state.data.myClasses.map(item => ({ ...item, allContext: 'readonly-mine' }));
    const available = state.data.availableClasses.map(item => ({
      ...item,
      allContext: isAllowed(item.playTypeId) ? 'readonly-available' : 'restricted'
    }));
    const full = state.data.fullClasses.map(item => ({ ...item, allContext: 'full' }));
    const all = [...mine, ...available, ...full]
      .filter(itemMatchesFilters)
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    return `
      <section class="section-block" aria-labelledby="all-classes-title">
        <div class="section-header collectable" data-collectable>
          <div>
            <h3 id="all-classes-title">All Classes</h3>
            <p>A read-only view of eligible, restricted, full, and assigned play types.</p>
          </div>
        </div>
        ${renderFilters()}
        ${renderGroupedEvents(all, item => item.allContext)}
      </section>
    `;
  }

  function renderHistoryView() {
    const today = startOfToday();
    return `
      <section class="section-block" aria-labelledby="history-title">
        <div class="section-header collectable" data-collectable>
          <div>
            <h3 id="history-title">My History</h3>
            <p>Completed instruction and policy-based credit by month.</p>
          </div>
        </div>
        <div class="history-list">
          ${state.data.history.map((month, index) => {
            const monthDate = new Date(today.getFullYear(), today.getMonth() + month.monthOffset, 1);
            const total = month.classes.reduce((sum, item) => sum + Number(item.points || 0), 0);
            return `
              <details class="history-month collectable" data-collectable ${index === 0 ? 'open' : ''}>
                <summary>
                  ${formatMonth(monthDate)}
                  <span>${month.classes.length} classes · ${formatNumber(total)} points</span>
                </summary>
                <div class="history-rows">
                  ${month.classes.map(item => {
                    const date = dateForHistory(month.monthOffset, item.day, item.time);
                    return `
                      <div class="history-row">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${formatDay(date)} · ${formatTime(item.time)}</span>
                        <span>${formatNumber(item.points)} pt</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </details>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function selectedDraftTier() {
    return tierById(state.policyDraft, state.selectedTierId);
  }

  function draftAllowedCount(tier = selectedDraftTier()) {
    return tier?.allowedPlayTypeIds?.length || 0;
  }

  function renderTierSelector() {
    return `
      <div class="tier-selector" role="list" aria-label="Instructor levels">
        ${(state.policyDraft.tiers || []).map(tier => `
          <button
            type="button"
            class="tier-option ${tier.id === state.selectedTierId ? 'is-active' : ''}"
            data-action="select-tier"
            data-tier-id="${escapeHtml(tier.id)}"
          >
            <span>${escapeHtml(tier.label)}</span>
            <small>${tier.allowedPlayTypeIds.length} allowed play types</small>
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderAdminNavigation() {
    const sections = [
      ['access', 'Access policy', 'Categories, play types, and points'],
      ['instructors', 'Instructors', 'Add, level, or remove participants'],
      ['incentives', 'Incentives', 'Define what participation points unlock']
    ];
    return `
      <nav class="admin-navigation" aria-label="Program administration sections">
        ${sections.map(([id, label, detail]) => `
          <button
            type="button"
            class="admin-navigation__item ${state.curationSection === id ? 'is-active' : ''}"
            data-action="set-curation-section"
            data-section="${id}"
          >
            <span>${label}</span>
            <small>${detail}</small>
          </button>
        `).join('')}
      </nav>
    `;
  }

  function renderCategoryAccess() {
    const tier = selectedDraftTier();
    return `
      <section class="curation-card category-access" aria-labelledby="category-access-title">
        <div class="curation-card__head">
          <div>
            <p class="eyebrow">Broad controls</p>
            <h3 id="category-access-title">Category access</h3>
            <p>Apply one decision to every Court Reserve play type in a category.</p>
          </div>
        </div>
        <div class="category-policy-list">
          ${policyCategories(state.policyDraft).map(category => {
            const types = state.policyDraft.playTypes.filter(type => type.category === category);
            const allowedCount = types.filter(type => tier?.allowedPlayTypeIds?.includes(type.id)).length;
            const allAllowed = allowedCount === types.length;
            return `
              <article class="category-policy-row">
                <div>
                  <strong>${escapeHtml(category)}</strong>
                  <span>${allowedCount}/${types.length} play types allowed</span>
                </div>
                <div>
                  <button type="button" class="mini-policy-button ${allAllowed ? 'is-active' : ''}" data-action="allow-category" data-category="${escapeHtml(category)}">Allow</button>
                  <button type="button" class="mini-policy-button ${allowedCount === 0 ? 'is-active is-restricted' : ''}" data-action="restrict-category" data-category="${escapeHtml(category)}">Restrict</button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function renderCurationCatalog() {
    const tier = selectedDraftTier();
    const query = state.curationSearch.trim().toLowerCase();
    const playTypes = state.policyDraft.playTypes.filter(type => {
      if (!query) return true;
      return `${type.name} ${type.category} ${type.source}`.toLowerCase().includes(query);
    });
    return `
      <section class="curation-card curation-catalog" aria-labelledby="catalog-title">
        <div class="curation-card__head">
          <div>
            <p class="eyebrow">Court Reserve source catalog</p>
            <h3 id="catalog-title">Play-type access</h3>
            <p>Allow or restrict an imported play type for ${escapeHtml(tier?.label || 'this level')}. The catalog remains owned by Court Reserve.</p>
          </div>
          <div class="catalog-actions">
            <button type="button" class="secondary-button" data-action="allow-all">Allow all</button>
            <button type="button" class="secondary-button" data-action="restrict-all">Restrict all</button>
          </div>
        </div>
        <label class="catalog-search">
          <span>Find a play type</span>
          <input type="search" data-curation-search value="${escapeHtml(state.curationSearch)}" placeholder="Search classes, leagues, clinics…" />
        </label>
        <div class="play-type-list">
          ${playTypes.map(type => {
            const allowed = tier?.allowedPlayTypeIds?.includes(type.id);
            const points = tier?.pointsByType?.[type.id] ?? type.defaultPoints;
            return `
              <article class="play-type-row ${allowed ? 'is-allowed' : 'is-restricted'}">
                <div class="play-type-main">
                  <span>${escapeHtml(type.category)} · ${type.futureEvents} future</span>
                  <strong>${escapeHtml(type.name)}</strong>
                  <small>${escapeHtml(type.staffing)}</small>
                </div>
                <label class="points-field">
                  <span>Points</span>
                  <input type="number" min="0" step="0.25" data-policy-points data-play-type-id="${escapeHtml(type.id)}" value="${escapeHtml(points)}" ${allowed ? '' : 'disabled'} />
                </label>
                <button
                  type="button"
                  class="policy-toggle ${allowed ? 'is-allowed' : 'is-restricted'}"
                  data-action="toggle-play-type"
                  data-play-type-id="${escapeHtml(type.id)}"
                  aria-pressed="${allowed}"
                >
                  <span aria-hidden="true"></span>${allowed ? 'Allowed' : 'Restricted'}
                </button>
              </article>
            `;
          }).join('') || '<div class="empty-state">No play types match this search.</div>'}
        </div>
      </section>
    `;
  }

  function renderPolicyEditor() {
    const tier = selectedDraftTier();
    return `
      <section class="curation-card policy-editor" aria-labelledby="policy-editor-title">
          <div class="curation-card__head">
            <div>
              <p class="eyebrow">Instructor-level policy</p>
              <h3 id="policy-editor-title">${escapeHtml(tier?.label || 'Instructor level')}</h3>
              <p>${escapeHtml(tier?.description || '')}</p>
            </div>
          </div>
          <div class="policy-fields">
            <label>
              <span>Monthly point target</span>
              <input type="number" min="0" step="0.5" data-tier-setting="monthlyTargetPoints" value="${escapeHtml(tier?.monthlyTargetPoints ?? 0)}" />
            </label>
            <label>
              <span>Rollover cap</span>
              <input type="number" min="0" step="0.5" data-tier-setting="rolloverCap" value="${escapeHtml(tier?.rolloverCap ?? 0)}" />
            </label>
            <label class="wide-field">
              <span>Level completion note</span>
              <input type="text" data-tier-setting="achievement" value="${escapeHtml(tier?.achievement || '')}" />
            </label>
          </div>
          <div class="policy-summary">
            <div><strong>${draftAllowedCount()}</strong><span>Allowed</span></div>
            <div><strong>${state.policyDraft.playTypes.length - draftAllowedCount()}</strong><span>Restricted</span></div>
            <div><strong>${formatNumber(tier?.monthlyTargetPoints)}</strong><span>Target</span></div>
          </div>
          <button type="button" class="secondary-button preview-button" data-action="preview-tier">
            Preview instructor workspace as this level
          </button>
      </section>
    `;
  }

  function renderAccessAdministration() {
    return `
      ${renderTierSelector()}
      <div class="curation-layout">
        ${renderCurationCatalog()}
        <aside class="curation-sidebar">
          ${renderCategoryAccess()}
          ${renderPolicyEditor()}
        </aside>
      </div>
      <div class="concept-boundary" role="note">
        <strong>Court Reserve remains the source</strong>
        Categories, play types, and scheduled classes are read from Court Reserve. This layer only allows or restricts eligibility and assigns participation-point values; it cannot create, rename, or delete the underlying catalog or classes.
      </div>
    `;
  }

  function renderInstructorAdministration() {
    const instructors = state.policyDraft.instructors || [];
    return `
      <div class="administration-grid">
        <section class="curation-card roster-card" aria-labelledby="roster-title">
          <div class="curation-card__head">
            <div>
              <p class="eyebrow">Program participants</p>
              <h3 id="roster-title">Instructor roster</h3>
              <p>Add instructors to this participation program, set their level, or remove them without changing Court Reserve staff records.</p>
            </div>
            <span class="count-badge">${instructors.length} instructors</span>
          </div>
          <div class="roster-list">
            ${instructors.map(instructor => `
              <article class="roster-row">
                <div class="roster-avatar">${escapeHtml(instructor.initials)}</div>
                <div class="roster-person">
                  <strong>${escapeHtml(instructor.name)}</strong>
                  <span>${escapeHtml(instructor.email)}</span>
                </div>
                <label>
                  <span>Level</span>
                  <select data-instructor-tier data-instructor-id="${escapeHtml(instructor.id)}">
                    ${state.policyDraft.tiers.map(tier => `<option value="${escapeHtml(tier.id)}" ${tier.id === instructor.tierId ? 'selected' : ''}>${escapeHtml(tier.label)}</option>`).join('')}
                  </select>
                </label>
                <button type="button" class="remove-button" data-action="remove-instructor" data-instructor-id="${escapeHtml(instructor.id)}">Remove</button>
              </article>
            `).join('') || '<div class="empty-state">No instructors are enrolled in the participation program.</div>'}
          </div>
        </section>

        <section class="curation-card add-instructor-card" aria-labelledby="add-instructor-title">
          <div class="curation-card__head">
            <div>
              <p class="eyebrow">Roster access</p>
              <h3 id="add-instructor-title">Add an instructor</h3>
              <p>This demo simulates selecting a Court Reserve staff member for the program.</p>
            </div>
          </div>
          <form id="instructor-form" class="admin-form">
            <label><span>Full name</span><input name="name" type="text" required placeholder="Taylor Morgan" /></label>
            <label><span>Email</span><input name="email" type="email" required placeholder="taylor@example.test" /></label>
            <label><span>Initials</span><input name="initials" type="text" maxlength="3" required placeholder="TM" /></label>
            <label>
              <span>Starting level</span>
              <select name="tierId">${state.policyDraft.tiers.map(tier => `<option value="${escapeHtml(tier.id)}">${escapeHtml(tier.label)}</option>`).join('')}</select>
            </label>
            <button type="submit" class="primary-button">Add to program</button>
          </form>
        </section>
      </div>
      <div class="concept-boundary" role="note">
        <strong>Participation roster only</strong>
        Adding or removing someone here controls access to this alternative instructor route. It does not create, delete, hire, or terminate a Court Reserve staff account.
      </div>
    `;
  }

  function renderIncentiveAdministration() {
    const incentives = sortedIncentives(state.policyDraft);
    return `
      <div class="administration-grid administration-grid--rewards">
        <section class="curation-card incentive-editor" aria-labelledby="incentive-title">
          <div class="curation-card__head">
            <div>
              <p class="eyebrow">Member-benefit ladder</p>
              <h3 id="incentive-title">Participation incentives</h3>
              <p>Specify how many points unlock each facility discount or Court Reserve member benefit.</p>
            </div>
            <span class="count-badge">${incentives.length} rewards</span>
          </div>
          <div class="incentive-list">
            ${incentives.map(incentive => `
              <article class="incentive-row">
                <label class="incentive-threshold"><span>Points</span><input type="number" min="0" step="0.5" value="${escapeHtml(incentive.threshold)}" data-incentive-field="threshold" data-incentive-id="${escapeHtml(incentive.id)}" /></label>
                <label><span>Reward name</span><input type="text" value="${escapeHtml(incentive.name)}" data-incentive-field="name" data-incentive-id="${escapeHtml(incentive.id)}" /></label>
                <label class="incentive-benefit"><span>What it unlocks</span><input type="text" value="${escapeHtml(incentive.benefit)}" data-incentive-field="benefit" data-incentive-id="${escapeHtml(incentive.id)}" /></label>
                <button type="button" class="remove-button" data-action="remove-incentive" data-incentive-id="${escapeHtml(incentive.id)}">Remove</button>
              </article>
            `).join('') || '<div class="empty-state">No point incentives are configured.</div>'}
          </div>
        </section>

        <section class="curation-card add-incentive-card" aria-labelledby="add-incentive-title">
          <div class="curation-card__head">
            <div>
              <p class="eyebrow">New reward</p>
              <h3 id="add-incentive-title">Add an incentive</h3>
              <p>Rewards are benefits and discounts, not compensation for employment.</p>
            </div>
          </div>
          <form id="incentive-form" class="admin-form">
            <label><span>Reward name</span><input name="name" type="text" required placeholder="Monthly clinic credit" /></label>
            <label><span>Points required</span><input name="threshold" type="number" min="0" step="0.5" required value="6" /></label>
            <label class="wide-field"><span>What it unlocks</span><input name="benefit" type="text" required placeholder="One complimentary clinic registration" /></label>
            <button type="submit" class="primary-button">Add incentive</button>
          </form>
        </section>
      </div>
      <div class="concept-boundary" role="note">
        <strong>Not a payroll product</strong>
        This route is for facilities offering discounts, credits, and member benefits in exchange for voluntary instructor participation. Facilities paying instructors as employees or contractors would use their payroll and Court Reserve operating workflows instead.
      </div>
    `;
  }

  function renderCurationView() {
    const publishedTier = tierById(state.data.policy, state.selectedTierId);
    const draftTier = selectedDraftTier();
    const accessDelta = draftAllowedCount(draftTier) - draftAllowedCount(publishedTier);
    return `
      <section class="curation-studio" aria-labelledby="curation-title">
        <div class="curation-hero">
          <div>
            <p class="eyebrow">Facility configuration</p>
            <h2 id="curation-title">Program Administration</h2>
            <p>Curate class eligibility, manage participating instructors, and define the member benefits earned with points.</p>
          </div>
          <div class="policy-version">
            <span>${escapeHtml(state.policyDraft.version)}</span>
            <strong>${state.policyDirty ? 'Unpublished changes' : 'Published policy'}</strong>
          </div>
        </div>
        ${renderAdminNavigation()}
        <div class="curation-statusbar">
          <span>${state.curationSection === 'access' && accessDelta !== 0 ? `${accessDelta > 0 ? '+' : ''}${accessDelta} allowed play types versus published` : state.policyDirty ? 'Draft changes are ready to publish' : 'Program configuration matches the published concept'}</span>
          <div>
            <button type="button" class="secondary-button" data-action="reset-policy-draft" ${state.policyDirty ? '' : 'disabled'}>Discard draft</button>
            <button type="button" class="primary-button" data-action="publish-policy" ${state.policyDirty ? '' : 'disabled'}>Publish to concept</button>
          </div>
        </div>
        ${state.curationSection === 'instructors'
          ? renderInstructorAdministration()
          : state.curationSection === 'incentives'
            ? renderIncentiveAdministration()
            : renderAccessAdministration()}
      </section>
    `;
  }

  function renderPrimaryAction() {
    const selected = Array.from(state.selectedAvailable);
    const coverageSelected = selected.some(id => state.data.availableClasses.find(item => item.id === id)?.coverageNeeded);
    elements.primaryAction.classList.toggle('is-warning', Boolean(state.stagedCoverageId || coverageSelected));
    if (state.stagedCoverageId) {
      elements.primaryAction.disabled = false;
      elements.primaryAction.textContent = 'Request coverage';
    } else if (selected.length) {
      elements.primaryAction.disabled = false;
      elements.primaryAction.textContent = coverageSelected && selected.length === 1
        ? 'Take coverage'
        : `Confirm selected (${selected.length})`;
    } else {
      elements.primaryAction.disabled = true;
      elements.primaryAction.textContent = 'Confirm selected';
    }
  }

  function renderInstructorView() {
    if (state.activeView === 'all') return renderAllView();
    if (state.activeView === 'history') return renderHistoryView();
    return renderAvailableView();
  }

  function render() {
    renderProfile();
    renderExperienceTabs();
    renderTabs();
    renderPrimaryAction();
    const instructorMode = state.activeMode === 'instructor';
    elements.goalCard.hidden = !instructorMode;
    elements.actionRow.hidden = !instructorMode;
    elements.view.classList.toggle('is-curation', !instructorMode);
    elements.view.innerHTML = instructorMode ? renderInstructorView() : renderCurationView();
    scheduleCollector();
  }

  function setMode(mode) {
    if (!['instructor', 'curation'].includes(mode) || state.activeMode === mode) return;
    clearCollector();
    state.activeMode = mode;
    state.selectedAvailable.clear();
    state.stagedCoverageId = null;
    render();
  }

  function setView(view) {
    if (!views.some(([key]) => key === view)) return;
    state.activeView = view;
    state.stagedCoverageId = null;
    state.selectedAvailable.clear();
    render();
  }

  function toggleFilter(filter) {
    if (state.activeFilters.has(filter)) state.activeFilters.delete(filter);
    else state.activeFilters.add(filter);
    render();
  }

  function toggleClass(id) {
    const item = state.data.availableClasses.find(entry => entry.id === id);
    if (!item || !isAllowed(item.playTypeId)) return;
    state.stagedCoverageId = null;
    if (state.selectedAvailable.has(id)) state.selectedAvailable.delete(id);
    else state.selectedAvailable.add(id);
    render();
  }

  function stageCoverage(id) {
    const item = state.data.myClasses.find(entry => entry.id === id);
    if (!item || !item.locked || item.coverageRequested) return;
    state.selectedAvailable.clear();
    state.stagedCoverageId = state.stagedCoverageId === id ? null : id;
    render();
  }

  function commitPrimaryAction() {
    if (state.stagedCoverageId) {
      const item = state.data.myClasses.find(entry => entry.id === state.stagedCoverageId);
      if (!item) return;
      item.coverageRequested = true;
      state.stagedCoverageId = null;
      render();
      showAlert('Coverage request recorded in concept state. No external system was contacted.');
      return;
    }

    const selectedIds = Array.from(state.selectedAvailable);
    if (!selectedIds.length) return;
    const selectedItems = state.data.availableClasses.filter(item => selectedIds.includes(item.id));
    state.data.availableClasses = state.data.availableClasses.filter(item => !selectedIds.includes(item.id));
    selectedItems.forEach(item => {
      state.data.myClasses.push({
        ...item,
        instructors: ['MT'],
        locked: Number(item.dayOffset) <= state.data.policy.coverageWindowDays,
        coverageRequested: false,
        coverageNeeded: false
      });
    });
    state.data.profile.completedPoints += selectedItems.reduce(
      (sum, item) => sum + pointsForPlayType(item.playTypeId),
      0
    );
    state.selectedAvailable.clear();
    render();
    showAlert(
      selectedItems.length === 1 && selectedItems[0].coverageNeeded
        ? 'Coverage takeover added to My Classes. Court Reserve sync remains disabled.'
        : `${selectedItems.length} class${selectedItems.length === 1 ? '' : 'es'} added to My Classes in concept state.`
    );
  }

  function markPolicyDirty() {
    state.policyDirty = true;
  }

  function toggleDraftPlayType(id) {
    const tier = selectedDraftTier();
    if (!tier) return;
    const allowed = new Set(tier.allowedPlayTypeIds || []);
    if (allowed.has(id)) allowed.delete(id);
    else allowed.add(id);
    tier.allowedPlayTypeIds = Array.from(allowed);
    if (!(id in tier.pointsByType)) {
      tier.pointsByType[id] = playTypeById(id, state.policyDraft)?.defaultPoints ?? 1;
    }
    markPolicyDirty();
    render();
  }

  function setAllDraftPlayTypes(allowed) {
    const tier = selectedDraftTier();
    if (!tier) return;
    tier.allowedPlayTypeIds = allowed ? state.policyDraft.playTypes.map(type => type.id) : [];
    if (allowed) {
      state.policyDraft.playTypes.forEach(type => {
        if (!(type.id in tier.pointsByType)) tier.pointsByType[type.id] = type.defaultPoints ?? 1;
      });
    }
    markPolicyDirty();
    render();
  }

  function setCategoryDraftAccess(category, allowed) {
    const tier = selectedDraftTier();
    if (!tier) return;
    const categoryIds = state.policyDraft.playTypes
      .filter(type => type.category === category)
      .map(type => type.id);
    const next = new Set(tier.allowedPlayTypeIds || []);
    categoryIds.forEach(id => {
      if (allowed) {
        next.add(id);
        if (!(id in tier.pointsByType)) {
          tier.pointsByType[id] = playTypeById(id, state.policyDraft)?.defaultPoints ?? 1;
        }
      } else {
        next.delete(id);
      }
    });
    tier.allowedPlayTypeIds = Array.from(next);
    markPolicyDirty();
    render();
  }

  function publishPolicy() {
    state.data.policy = clone(state.policyDraft);
    state.data.instructorDirectory = Object.fromEntries(
      (state.data.policy.instructors || []).map(instructor => [instructor.initials, instructor.name])
    );
    state.policyDirty = false;
    state.activeFilters = new Set(policyCategories().map(slug));
    render();
    showAlert('Policy published to this browser-only concept. The instructor workspace now reflects it.');
  }

  function resetPolicyDraft() {
    state.policyDraft = clone(state.data.policy);
    state.policyDirty = false;
    if (!tierById(state.policyDraft, state.selectedTierId)) {
      state.selectedTierId = state.data.profile.tierId;
    }
    render();
  }

  function previewSelectedTier() {
    state.data.profile.tierId = state.selectedTierId;
    state.activeMode = 'instructor';
    state.activeView = 'available';
    state.selectedAvailable.clear();
    state.stagedCoverageId = null;
    render();
    showAlert(`Instructor workspace previewing ${activeTier()?.label || 'the selected level'}.`);
    window.scrollTo({ top: elements.goalCard.offsetTop, behavior: 'smooth' });
  }

  function addInstructor(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    let initials = String(data.get('initials') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    const tierId = String(data.get('tierId') || state.policyDraft.tiers[0]?.id || '');
    if (!name || !email || !initials) return;
    let id = slug(name);
    if (!id) id = `instructor-${Date.now()}`;
    while ((state.policyDraft.instructors || []).some(instructor => instructor.id === id)) id = `${id}-2`;
    while ((state.policyDraft.instructors || []).some(instructor => instructor.initials === initials)) {
      initials = `${initials.slice(0, 2)}${Math.floor(Math.random() * 9) + 1}`;
    }
    if (!state.policyDraft.instructors) state.policyDraft.instructors = [];
    state.policyDraft.instructors.push({
      id,
      initials,
      name,
      email,
      tierId,
      status: 'Active'
    });
    markPolicyDirty();
    render();
    showAlert(`${name} added to the draft participation roster.`);
  }

  function removeInstructor(id) {
    const instructor = (state.policyDraft.instructors || []).find(item => item.id === id);
    if (!instructor) return;
    state.policyDraft.instructors = state.policyDraft.instructors.filter(item => item.id !== id);
    markPolicyDirty();
    render();
    showAlert(`${instructor.name} removed from the draft participation roster.`);
  }

  function addIncentive(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const benefit = String(data.get('benefit') || '').trim();
    const threshold = Math.max(0, Number(data.get('threshold') || 0));
    if (!name || !benefit) return;
    let id = slug(name) || `incentive-${Date.now()}`;
    while ((state.policyDraft.incentives || []).some(item => item.id === id)) id = `${id}-2`;
    if (!state.policyDraft.incentives) state.policyDraft.incentives = [];
    state.policyDraft.incentives.push({
      id,
      name,
      threshold,
      benefit,
      description: 'Facility-defined participation benefit.'
    });
    markPolicyDirty();
    render();
    showAlert(`${name} added to the draft incentive ladder.`);
  }

  function removeIncentive(id) {
    const incentive = (state.policyDraft.incentives || []).find(item => item.id === id);
    if (!incentive) return;
    state.policyDraft.incentives = state.policyDraft.incentives.filter(item => item.id !== id);
    markPolicyDirty();
    render();
    showAlert(`${incentive.name} removed from the draft incentive ladder.`);
  }

  function handleClick(event) {
    const initial = event.target.closest('[data-instructor-initial]');
    if (initial) {
      event.preventDefault();
      event.stopPropagation();
      initial.closest('.instructor-strip')?.classList.toggle('is-open');
      return;
    }
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    const { action, view, filter, classId, tierId, playTypeId, section, category, instructorId, incentiveId } = actionTarget.dataset;
    if (action === 'set-view') setView(view);
    if (action === 'toggle-filter') toggleFilter(filter);
    if (action === 'toggle-class') toggleClass(classId);
    if (action === 'stage-coverage') stageCoverage(classId);
    if (action === 'select-tier') {
      state.selectedTierId = tierId;
      render();
    }
    if (action === 'toggle-play-type') toggleDraftPlayType(playTypeId);
    if (action === 'allow-all') setAllDraftPlayTypes(true);
    if (action === 'restrict-all') setAllDraftPlayTypes(false);
    if (action === 'allow-category') setCategoryDraftAccess(category, true);
    if (action === 'restrict-category') setCategoryDraftAccess(category, false);
    if (action === 'set-curation-section') {
      state.curationSection = section;
      render();
    }
    if (action === 'remove-instructor') removeInstructor(instructorId);
    if (action === 'remove-incentive') removeIncentive(incentiveId);
    if (action === 'publish-policy') publishPolicy();
    if (action === 'reset-policy-draft') resetPolicyDraft();
    if (action === 'preview-tier') previewSelectedTier();
  }

  function handlePolicyChange(event) {
    const tier = selectedDraftTier();
    if (!tier) return;
    if (event.target.matches('[data-policy-points]')) {
      tier.pointsByType[event.target.dataset.playTypeId] = Math.max(0, Number(event.target.value || 0));
      markPolicyDirty();
      render();
      return;
    }
    if (event.target.matches('[data-tier-setting]')) {
      const field = event.target.dataset.tierSetting;
      tier[field] = event.target.type === 'number'
        ? Math.max(0, Number(event.target.value || 0))
        : event.target.value;
      markPolicyDirty();
      render();
      return;
    }
    if (event.target.matches('[data-instructor-tier]')) {
      const instructor = (state.policyDraft.instructors || []).find(
        item => item.id === event.target.dataset.instructorId
      );
      if (!instructor) return;
      instructor.tierId = event.target.value;
      markPolicyDirty();
      render();
      return;
    }
    if (event.target.matches('[data-incentive-field]')) {
      const incentive = (state.policyDraft.incentives || []).find(
        item => item.id === event.target.dataset.incentiveId
      );
      if (!incentive) return;
      const field = event.target.dataset.incentiveField;
      incentive[field] = event.target.type === 'number'
        ? Math.max(0, Number(event.target.value || 0))
        : event.target.value;
      markPolicyDirty();
      render();
    }
  }

  function clearCollector() {
    document.querySelectorAll('[data-collectable]').forEach(item => {
      item.style.removeProperty('--collect-x');
      item.style.removeProperty('--collect-y');
      item.style.removeProperty('--collect-scale-x');
      item.style.removeProperty('--collect-scale-y');
      item.style.removeProperty('--collect-opacity');
      item.style.removeProperty('--collect-visibility');
    });
    elements.goalCard.classList.remove('is-stuck');
  }

  function updateCollector() {
    if (!state || state.activeMode !== 'instructor' || elements.goalCard.hidden) {
      clearCollector();
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 700) {
      clearCollector();
      return;
    }
    const goalRect = elements.goalCard.getBoundingClientRect();
    if (goalRect.height <= 0) return;
    const stickyTop = 12;
    elements.goalCard.classList.toggle('is-stuck', goalRect.top <= stickyTop + 1 && window.scrollY > 20);
    const goalCenterX = goalRect.left + goalRect.width / 2;
    const goalCenterY = goalRect.top + goalRect.height / 2;

    elements.view.querySelectorAll('[data-collectable]').forEach(item => {
      const rendered = item.getBoundingClientRect();
      const currentX = parseFloat(item.style.getPropertyValue('--collect-x')) || 0;
      const currentY = parseFloat(item.style.getPropertyValue('--collect-y')) || 0;
      const currentScaleX = parseFloat(item.style.getPropertyValue('--collect-scale-x')) || 1;
      const currentScaleY = parseFloat(item.style.getPropertyValue('--collect-scale-y')) || 1;
      const rect = {
        left: rendered.left - currentX,
        top: rendered.top - currentY,
        width: rendered.width / currentScaleX,
        height: rendered.height / currentScaleY
      };
      const covered = goalRect.bottom + 2 - rect.top;
      const progress = Math.max(0, Math.min(1, covered / (rect.height + 2)));
      const fullyCovered = covered >= Math.max(12, rect.height * 0.96);
      if (progress <= 0) {
        item.style.removeProperty('--collect-x');
        item.style.removeProperty('--collect-y');
        item.style.removeProperty('--collect-scale-x');
        item.style.removeProperty('--collect-scale-y');
        item.style.removeProperty('--collect-opacity');
        item.style.removeProperty('--collect-visibility');
        return;
      }
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;
      const targetX = goalCenterX - cardCenterX;
      const targetY = goalCenterY - cardCenterY;
      const approach = Math.min(progress, 0.985);
      const collectX = fullyCovered ? targetX : Math.max(-10, Math.min(10, targetX * 0.025)) * approach;
      const collectY = fullyCovered ? targetY : Math.max(-8, Math.min(8, targetY * 0.025)) * approach;
      item.style.setProperty('--collect-x', `${collectX.toFixed(1)}px`);
      item.style.setProperty('--collect-y', `${collectY.toFixed(1)}px`);
      item.style.setProperty('--collect-scale-x', (1 - 0.012 * progress).toFixed(3));
      item.style.setProperty('--collect-scale-y', (1 - 0.002 * progress).toFixed(3));
      item.style.setProperty('--collect-opacity', fullyCovered ? '0' : '1');
      item.style.setProperty('--collect-visibility', fullyCovered ? 'hidden' : 'visible');
    });
  }

  function scheduleCollector() {
    if (collectorFrame) cancelAnimationFrame(collectorFrame);
    collectorFrame = requestAnimationFrame(() => {
      collectorFrame = 0;
      updateCollector();
    });
  }

  async function init() {
    if (new URLSearchParams(window.location.search).get('embed') === '1') {
      document.body.classList.add('is-embed');
    }
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Concept data returned ${response.status}`);
      sourceData = await response.json();
      resetState();
    } catch (error) {
      elements.view.innerHTML = `
        <div class="empty-state">
          The concept data could not load. Serve this folder over HTTP rather than opening index.html directly.
        </div>
      `;
      console.error(error);
    }
  }

  elements.experienceTabs.addEventListener('click', event => {
    const target = event.target.closest('[data-mode]');
    if (target) setMode(target.dataset.mode);
  });
  elements.tabs.addEventListener('click', handleClick);
  elements.view.addEventListener('click', handleClick);
  elements.view.addEventListener('change', handlePolicyChange);
  elements.view.addEventListener('input', event => {
    if (!event.target.matches('[data-curation-search]')) return;
    state.curationSearch = event.target.value;
    const selectionStart = event.target.selectionStart;
    render();
    const next = elements.view.querySelector('[data-curation-search]');
    next?.focus();
    next?.setSelectionRange(selectionStart, selectionStart);
  });
  elements.view.addEventListener('submit', event => {
    if (event.target.id === 'instructor-form') {
      event.preventDefault();
      addInstructor(event.target);
    }
    if (event.target.id === 'incentive-form') {
      event.preventDefault();
      addIncentive(event.target);
    }
  });
  elements.primaryAction.addEventListener('click', commitPrimaryAction);
  elements.reset.addEventListener('click', () => {
    resetState();
    showAlert('The fictional concept data and policy draft have been reset.');
  });
  window.addEventListener('scroll', scheduleCollector, { passive: true });
  window.addEventListener('resize', scheduleCollector);

  init();
})();

