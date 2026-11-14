(() => {
  'use strict';

  const DATA_URL = '/data/demo.json';
  const views = [
    ['available', 'Eligible'],
    ['all', 'All Classes'],
    ['history', 'My History']
  ];

  let sourceData = null;
  let state = null;
  let alertTimer = null;
  let collectorFrame = 0;
  let collectorLayouts = new WeakMap();
  let collectorResizeTimer = 0;

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

  function effectivePolicy() {
    return state?.policyDirty ? state.policyDraft : state?.data?.policy;
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

  function activeTier(policy = effectivePolicy()) {
    return tierById(policy, state.data.profile.tierId);
  }

  function playTypeById(id, policy = effectivePolicy()) {
    return (policy?.playTypes || []).find(type => type.id === id) || null;
  }

  function isAllowed(playTypeId, policy = effectivePolicy(), tierId = state.data.profile.tierId) {
    const tier = tierById(policy, tierId);
    return Boolean(
      scopedPlayTypeIds(policy).has(playTypeId) &&
      tier?.allowedPlayTypeIds?.includes(playTypeId)
    );
  }

  function pointsForPlayType(playTypeId, policy = effectivePolicy(), tierId = state.data.profile.tierId) {
    const tier = tierById(policy, tierId);
    const type = playTypeById(playTypeId, policy);
    return Number(tier?.pointsByType?.[playTypeId] ?? type?.defaultPoints ?? 1);
  }

  function policyCategories(policy = effectivePolicy()) {
    return [...new Set((policy?.playTypes || []).map(type => type.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function scopedCategories(policy = effectivePolicy()) {
    const scopedIds = scopedPlayTypeIds(policy);
    return policyCategories(policy).filter(category =>
      (policy?.playTypes || []).some(type => type.category === category && scopedIds.has(type.id))
    );
  }

  function scopedPlayTypeIds(policy = state.data.policy) {
    const scope = policy?.catalogScope || {};
    const ids = new Set();
    Object.entries(scope).forEach(([category, config]) => {
      const categoryTypes = (policy?.playTypes || []).filter(type => type.category === category);
      if (config.mode === 'all') categoryTypes.forEach(type => ids.add(type.id));
      else (config.playTypeIds || []).forEach(id => ids.add(id));
    });
    return ids;
  }

  function sortedIncentives(policy = effectivePolicy()) {
    return [...(policy?.incentives || [])]
      .sort((a, b) => Number(a.threshold || 0) - Number(b.threshold || 0));
  }

  function resetState() {
    const data = clone(sourceData);
    state = {
      data,
      activeMode: 'instructor',
      activeView: 'available',
      activeFilters: new Set(scopedCategories(data.policy).map(slug)),
      selectedAvailable: new Set(),
      stagedCoverageId: null,
      policyDraft: clone(data.policy),
      selectedTierId: data.profile.tierId,
      curationSection: 'access',
      curationSearch: '',
      expandedInstructorId: null,
      catalogSetupOpen: false,
      catalogSetupDraft: null,
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

  function categoriesForItems(items) {
    return [...new Set(items.map(categoryForItem).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function renderFilters(categories) {
    if (!categories.length) return '';
    return `
      <div class="filter-bar collectable" data-collectable aria-label="Filter classes">
        ${categories.map(category => {
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
    const scopedIds = scopedPlayTypeIds(effectivePolicy());
    const eligibleClasses = state.data.availableClasses
      .filter(item => scopedIds.has(item.playTypeId))
      .filter(item => isAllowed(item.playTypeId))
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    const available = eligibleClasses
      .filter(itemMatchesFilters)
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    const restrictedCount = state.data.availableClasses
      .filter(item => scopedIds.has(item.playTypeId) && !isAllowed(item.playTypeId)).length;
    const policyState = state.policyDirty ? 'current draft' : 'published';
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
            <p>Filtered by the ${policyState} ${escapeHtml(activeTier()?.label || 'instructor')} policy. ${restrictedCount} admitted class${restrictedCount === 1 ? ' is' : 'es are'} restricted; classes outside the facility catalog stay hidden.</p>
          </div>
        </div>
        ${renderFilters(categoriesForItems(eligibleClasses))}
        ${renderGroupedEvents(available, 'available')}
      </section>
    `;
  }

  function renderAllView() {
    const scopedIds = scopedPlayTypeIds(effectivePolicy());
    const mine = state.data.myClasses
      .filter(item => scopedIds.has(item.playTypeId))
      .map(item => ({ ...item, allContext: 'readonly-mine' }));
    const available = state.data.availableClasses
      .filter(item => scopedIds.has(item.playTypeId))
      .map(item => ({
        ...item,
        allContext: isAllowed(item.playTypeId) ? 'readonly-available' : 'restricted'
      }));
    const full = state.data.fullClasses
      .filter(item => scopedIds.has(item.playTypeId))
      .map(item => ({ ...item, allContext: 'full' }));
    const catalogClasses = [...mine, ...available, ...full]
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    const all = catalogClasses
      .filter(itemMatchesFilters)
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    return `
      <section class="section-block" aria-labelledby="all-classes-title">
        <div class="section-header collectable" data-collectable>
          <div>
            <h3 id="all-classes-title">All Classes</h3>
            <p>A read-only view of assigned, eligible, restricted, and full classes inside the facility’s admitted catalog.</p>
          </div>
        </div>
        ${renderFilters(categoriesForItems(catalogClasses))}
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
      <section class="instructor-type-manager" aria-labelledby="instructor-types-title">
        <div class="instructor-type-manager__head">
          <div>
            <p class="eyebrow">Program structure</p>
            <h3 id="instructor-types-title">Instructor types</h3>
            <p>Create as many instructor types as the facility needs, then select one to curate its policy.</p>
          </div>
          <form id="instructor-type-form" class="instructor-type-form">
            <label>
              <span>New type name</span>
              <input type="text" name="label" required placeholder="e.g. Community Host" />
            </label>
            <button type="submit" class="secondary-button">Add instructor type</button>
          </form>
        </div>
        <div class="tier-selector" role="list" aria-label="Instructor types">
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
      </section>
    `;
  }

  function renderAdminNavigation() {
    const sections = [
      ['access', 'Access policy', 'Categories, play types, and points'],
      ['instructors', 'Instructors', 'Add, level, or remove participants'],
      ['incentives', 'Incentives', 'Define what participation points unlock'],
      ['conversions', 'Conversions', 'Map downstream actions to bonus points']
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
    const scope = state.policyDraft.catalogScope || {};
    const entries = Object.entries(scope);
    const scopedCount = scopedPlayTypeIds(state.policyDraft).size;
    return `
      <section class="curation-card category-access" aria-labelledby="category-access-title">
        <div class="curation-card__head">
          <div>
            <p class="eyebrow">Broad controls</p>
            <h3 id="category-access-title">Program catalog</h3>
            <p>Only admitted categories and play types appear in the policy workspace.</p>
          </div>
          <button type="button" class="secondary-button" data-action="open-catalog-setup">Configure catalog</button>
        </div>
        <div class="catalog-scope-summary">
          ${entries.map(([category, config]) => {
            const count = config.mode === 'all'
              ? state.policyDraft.playTypes.filter(type => type.category === category).length
              : (config.playTypeIds || []).length;
            return `
              <article class="catalog-scope-chip">
                <strong>${escapeHtml(category)}</strong>
                <span>${config.mode === 'all' ? 'Entire category' : `${count} selected play type${count === 1 ? '' : 's'}`}</span>
              </article>
            `;
          }).join('') || '<div class="empty-state">No Court Reserve categories are admitted yet.</div>'}
        </div>
        <p class="catalog-scope-count">${scopedCount} play type${scopedCount === 1 ? '' : 's'} available for instructor-type policies.</p>
      </section>
    `;
  }

  function renderPolicyPlayTypeRow(type, tier) {
    const allowed = tier?.allowedPlayTypeIds?.includes(type.id);
    const points = tier?.pointsByType?.[type.id] ?? type.defaultPoints;
    return `
      <article class="play-type-row ${allowed ? 'is-allowed' : 'is-restricted'}">
        <div class="play-type-main">
          <span>${type.futureEvents} future events</span>
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
  }

  function renderCurationCatalog() {
    const tier = selectedDraftTier();
    const query = state.curationSearch.trim().toLowerCase();
    const scopedIds = scopedPlayTypeIds(state.policyDraft);
    const playTypes = state.policyDraft.playTypes.filter(type => {
      if (!scopedIds.has(type.id)) return false;
      if (!query) return true;
      return `${type.name} ${type.category} ${type.source}`.toLowerCase().includes(query);
    });
    const groups = scopedCategories(state.policyDraft)
      .map(category => ({ category, types: playTypes.filter(type => type.category === category) }))
      .filter(group => group.types.length);
    return `
      <section class="curation-card curation-catalog" aria-labelledby="catalog-title">
        <div class="curation-card__head">
          <div>
            <p class="eyebrow">Court Reserve source catalog</p>
            <h3 id="catalog-title">Play-type access</h3>
            <p>Allow or restrict the facility’s admitted play types for ${escapeHtml(tier?.label || 'this level')}.</p>
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
          ${groups.map(group => `
            <section class="play-type-group">
              <div class="play-type-group__heading">
                <strong>${escapeHtml(group.category)}</strong>
                <span>${group.types.length} admitted</span>
              </div>
              ${group.types.map(type => renderPolicyPlayTypeRow(type, tier)).join('')}
            </section>
          `).join('') || '<div class="empty-state">No admitted play types match this search.</div>'}
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
            <div><strong>${Math.max(0, scopedPlayTypeIds(state.policyDraft).size - draftAllowedCount())}</strong><span>Restricted</span></div>
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
          ${renderPolicyEditor()}
          ${renderCategoryAccess()}
        </aside>
      </div>
      <div class="concept-boundary" role="note">
        <strong>Court Reserve remains the source</strong>
        Categories, play types, and scheduled classes are read from Court Reserve. Catalog setup admits a small working subset; instructor-type policies then allow or restrict only that subset.
      </div>
    `;
  }

  function renderInstructorAdminHistory(instructor) {
    const entries = state.data.instructorHistory?.[instructor.id] || [];
    const totalPoints = entries.reduce((sum, entry) => sum + Number(entry.points || 0), 0);
    return `
      <div class="roster-history" id="history-${escapeHtml(instructor.id)}">
        <div class="roster-history__summary">
          <div><strong>${entries.length}</strong><span>Completed assignments</span></div>
          <div><strong>${formatNumber(totalPoints)}</strong><span>Program points</span></div>
          <div><strong>${escapeHtml(tierById(state.policyDraft, instructor.tierId)?.label || 'Unassigned')}</strong><span>Current type</span></div>
        </div>
        <div class="roster-history__list">
          ${entries.map(entry => {
            const date = startOfToday();
            date.setDate(date.getDate() + Number(entry.dayOffset || 0));
            return `
              <div class="roster-history__row">
                <div><strong>${escapeHtml(entry.name)}</strong><span>${formatDay(date)}</span></div>
                <span>${escapeHtml(entry.status || 'Completed')}</span>
                <strong>${formatNumber(entry.points)} pt</strong>
              </div>
            `;
          }).join('') || '<div class="empty-state">No completed program activity yet.</div>'}
        </div>
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
              <article class="roster-entry ${state.expandedInstructorId === instructor.id ? 'is-expanded' : ''}">
                <div class="roster-row">
                  <div class="roster-avatar">${escapeHtml(instructor.initials)}</div>
                  <button type="button" class="roster-person roster-person-button" data-action="toggle-instructor-history" data-instructor-id="${escapeHtml(instructor.id)}" aria-expanded="${state.expandedInstructorId === instructor.id}" aria-controls="history-${escapeHtml(instructor.id)}">
                    <strong>${escapeHtml(instructor.name)}</strong>
                    <span>${escapeHtml(instructor.email)} · ${state.expandedInstructorId === instructor.id ? 'Hide history' : 'View history'}</span>
                  </button>
                  <label>
                    <span>Level</span>
                    <select data-instructor-tier data-instructor-id="${escapeHtml(instructor.id)}">
                      ${state.policyDraft.tiers.map(tier => `<option value="${escapeHtml(tier.id)}" ${tier.id === instructor.tierId ? 'selected' : ''}>${escapeHtml(tier.label)}</option>`).join('')}
                    </select>
                  </label>
                  <div class="roster-actions">
                    <button type="button" class="reset-button" data-action="reset-password" data-instructor-id="${escapeHtml(instructor.id)}">Reset password</button>
                    <button type="button" class="remove-button" data-action="remove-instructor" data-instructor-id="${escapeHtml(instructor.id)}">Remove</button>
                  </div>
                </div>
                ${state.expandedInstructorId === instructor.id ? renderInstructorAdminHistory(instructor) : ''}
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

  function renderConversionDestinations(conversion) {
    const selected = new Set(conversion.outcomeIds || []);
    const choices = conversion.outcomeType === 'play-type'
      ? state.policyDraft.playTypes.map(type => ({ id: type.id, name: type.name }))
      : (state.policyDraft.membershipTypes || []);
    return choices.map(choice => `
      <label>
        <input
          type="checkbox"
          data-conversion-destination
          data-conversion-id="${escapeHtml(conversion.id)}"
          data-destination-id="${escapeHtml(choice.id)}"
          ${selected.has(choice.id) ? 'checked' : ''}
        />
        <span>${escapeHtml(choice.name)}</span>
      </label>
    `).join('');
  }

  function conversionDestinationSummary(conversion) {
    const selected = new Set(conversion.outcomeIds || []);
    const choices = conversion.outcomeType === 'play-type'
      ? state.policyDraft.playTypes.map(type => ({ id: type.id, name: type.name }))
      : (state.policyDraft.membershipTypes || []);
    const names = choices.filter(choice => selected.has(choice.id)).map(choice => choice.name);
    if (!names.length) return 'Choose destinations';
    if (names.length === 1) return names[0];
    return `${names.length} destinations selected`;
  }

  function renderConversionAdministration() {
    const conversions = state.policyDraft.conversions || [];
    const scopedIds = scopedPlayTypeIds(state.policyDraft);
    const sources = state.policyDraft.playTypes.filter(type => scopedIds.has(type.id));
    return `
      <div class="administration-grid administration-grid--conversions">
        <section class="curation-card conversion-editor" aria-labelledby="conversion-title">
          <div class="curation-card__head">
            <div>
              <p class="eyebrow">Attribution rules</p>
              <h3 id="conversion-title">Conversion mappings</h3>
              <p>Connect an instructor-led starting point to one or more later membership or class actions, then award fixed conversion points when one happens inside the attribution window.</p>
            </div>
            <span class="count-badge">${conversions.length} rules</span>
          </div>
          <div class="conversion-list">
            ${conversions.map(conversion => `
              <article class="conversion-rule">
                <div class="conversion-rule__heading">
                  <label>
                    <span>Rule name</span>
                    <input type="text" value="${escapeHtml(conversion.name)}" data-conversion-field="name" data-conversion-id="${escapeHtml(conversion.id)}" />
                  </label>
                  <button type="button" class="remove-button" data-action="remove-conversion" data-conversion-id="${escapeHtml(conversion.id)}">Remove</button>
                </div>
                <div class="conversion-map">
                  <label>
                    <span>Conversion starts at</span>
                    <select data-conversion-field="sourcePlayTypeId" data-conversion-id="${escapeHtml(conversion.id)}">
                      ${sources.map(type => `<option value="${escapeHtml(type.id)}" ${type.id === conversion.sourcePlayTypeId ? 'selected' : ''}>${escapeHtml(type.name)}</option>`).join('')}
                    </select>
                  </label>
                  <span class="conversion-arrow" aria-hidden="true">→</span>
                  <label>
                    <span>Converts to</span>
                    <select data-conversion-field="outcomeType" data-conversion-id="${escapeHtml(conversion.id)}">
                      <option value="membership" ${conversion.outcomeType === 'membership' ? 'selected' : ''}>Membership type</option>
                      <option value="play-type" ${conversion.outcomeType === 'play-type' ? 'selected' : ''}>Another class type</option>
                    </select>
                  </label>
                  <details class="conversion-destination-dropdown">
                    <summary>
                      <span>Destinations</span>
                      <strong data-destination-summary>${escapeHtml(conversionDestinationSummary(conversion))}</strong>
                    </summary>
                    <div class="conversion-destination-options">${renderConversionDestinations(conversion)}</div>
                  </details>
                </div>
                <div class="conversion-terms">
                  <div class="conversion-window">
                    <label>
                      <span>Within</span>
                      <input type="number" min="1" step="1" value="${escapeHtml(conversion.windowValue)}" data-conversion-field="windowValue" data-conversion-id="${escapeHtml(conversion.id)}" />
                    </label>
                    <label>
                      <span>Time unit</span>
                      <select data-conversion-field="windowUnit" data-conversion-id="${escapeHtml(conversion.id)}">
                        <option value="hours" ${conversion.windowUnit === 'hours' ? 'selected' : ''}>Hours</option>
                        <option value="days" ${conversion.windowUnit === 'days' ? 'selected' : ''}>Days</option>
                      </select>
                    </label>
                  </div>
                  <label class="conversion-points-field">
                    <span>Conversion points</span>
                    <div><input type="number" min="0" step="0.25" value="${escapeHtml(conversion.conversionPoints)}" data-conversion-field="conversionPoints" data-conversion-id="${escapeHtml(conversion.id)}" /><strong>pt</strong></div>
                  </label>
                </div>
              </article>
            `).join('') || '<div class="empty-state">No conversion rules are configured.</div>'}
          </div>
        </section>

        <section class="curation-card add-conversion-card" aria-labelledby="add-conversion-title">
          <div class="curation-card__head">
            <div>
              <p class="eyebrow">New attribution rule</p>
              <h3 id="add-conversion-title">Add a conversion</h3>
              <p>Choose the instructor-led starting point. Destinations, time window, and conversion points can be refined immediately after adding it.</p>
            </div>
          </div>
          <form id="conversion-form" class="admin-form">
            <label class="wide-field"><span>Rule name</span><input name="name" type="text" required placeholder="Intro class to membership" /></label>
            <label class="wide-field">
              <span>Starting play type</span>
              <select name="sourcePlayTypeId">${sources.map(type => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`).join('')}</select>
            </label>
            <button type="submit" class="primary-button">Add conversion rule</button>
          </form>
        </section>
      </div>
      <div class="concept-boundary" role="note">
        <strong>Attribution, not billing</strong>
        A conversion rule measures whether a downstream Court Reserve action happened inside the configured window. Conversion points are awarded separately from the source class points; they do not alter membership price, class price, or payroll.
      </div>
    `;
  }

  function renderCatalogSetupDialog() {
    if (!state.catalogSetupOpen) return '';
    const draft = state.catalogSetupDraft || {};
    return `
      <div class="catalog-modal-backdrop">
        <section class="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title">
          <header class="catalog-modal__header">
            <div>
              <p class="eyebrow">Initial program setup</p>
              <h2 id="catalog-modal-title">Choose the program catalog</h2>
              <p>Admit only the Court Reserve categories and play types this facility wants instructors to claim.</p>
            </div>
            <button type="button" class="modal-close" data-action="close-catalog-setup" aria-label="Close catalog setup">×</button>
          </header>
          <div class="catalog-setup-list">
            ${policyCategories(state.policyDraft).map(category => {
              const config = draft[category];
              const included = Boolean(config);
              const types = state.policyDraft.playTypes.filter(type => type.category === category);
              const selected = new Set(config?.playTypeIds || []);
              return `
                <article class="catalog-setup-category ${included ? 'is-included' : ''}">
                  <div class="catalog-setup-category__head">
                    <div>
                      <strong>${escapeHtml(category)}</strong>
                      <span>${types.length} Court Reserve play type${types.length === 1 ? '' : 's'}</span>
                    </div>
                    <button type="button" class="scope-toggle ${included ? 'is-included' : ''}" data-action="toggle-catalog-category" data-category="${escapeHtml(category)}">${included ? 'Included' : 'Add category'}</button>
                  </div>
                  ${included ? `
                    <div class="scope-mode-row">
                      <button type="button" class="mini-policy-button ${config.mode === 'all' ? 'is-active' : ''}" data-action="set-catalog-category-mode" data-category="${escapeHtml(category)}" data-scope-mode="all">Everything in ${escapeHtml(category)}</button>
                      <button type="button" class="mini-policy-button ${config.mode === 'selected' ? 'is-active' : ''}" data-action="set-catalog-category-mode" data-category="${escapeHtml(category)}" data-scope-mode="selected">Choose play types</button>
                    </div>
                    <div class="scope-play-types ${config.mode === 'all' ? 'is-all' : ''}">
                      ${types.map(type => `
                        <label>
                          <input type="checkbox" data-scope-play-type data-category="${escapeHtml(category)}" data-play-type-id="${escapeHtml(type.id)}" ${config.mode === 'all' || selected.has(type.id) ? 'checked' : ''} ${config.mode === 'all' ? 'disabled' : ''} />
                          <span>${escapeHtml(type.name)}</span>
                        </label>
                      `).join('')}
                    </div>
                  ` : ''}
                </article>
              `;
            }).join('')}
          </div>
          <footer class="catalog-modal__footer">
            <p>This determines what enters the policy workspace; it does not modify Court Reserve.</p>
            <div>
              <button type="button" class="secondary-button" data-action="close-catalog-setup">Cancel</button>
              <button type="button" class="primary-button" data-action="apply-catalog-setup">Use this catalog</button>
            </div>
          </footer>
        </section>
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
            <p>Curate eligibility, manage participating instructors, define member benefits, and map downstream conversions to bonus points.</p>
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
            : state.curationSection === 'conversions'
              ? renderConversionAdministration()
            : renderAccessAdministration()}
      </section>
      ${renderCatalogSetupDialog()}
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
    const content = state.activeView === 'all'
      ? renderAllView()
      : state.activeView === 'history'
        ? renderHistoryView()
        : renderAvailableView();
    return `
      ${state.policyDirty ? '<div class="draft-preview-banner" role="note"><strong>Draft policy preview</strong><span>Eligibility and points reflect the current unpublished Program Administration settings.</span></div>' : ''}
      ${content}
    `;
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
    captureCollectorLayouts();
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
    elements.view.querySelectorAll('[data-action="publish-policy"], [data-action="reset-policy-draft"]').forEach(button => {
      button.disabled = false;
    });
    const status = elements.view.querySelector('.curation-statusbar > span');
    if (status) status.textContent = 'Draft changes are ready to publish';
    const versionState = elements.view.querySelector('.policy-version strong');
    if (versionState) versionState.textContent = 'Unpublished changes';
  }

  function toggleDraftPlayType(id) {
    const tier = selectedDraftTier();
    if (!tier || !scopedPlayTypeIds(state.policyDraft).has(id)) return;
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
    const scopedIds = scopedPlayTypeIds(state.policyDraft);
    tier.allowedPlayTypeIds = allowed ? Array.from(scopedIds) : [];
    if (allowed) {
      state.policyDraft.playTypes.filter(type => scopedIds.has(type.id)).forEach(type => {
        if (!(type.id in tier.pointsByType)) tier.pointsByType[type.id] = type.defaultPoints ?? 1;
      });
    }
    markPolicyDirty();
    render();
  }

  function openCatalogSetup() {
    state.catalogSetupDraft = clone(state.policyDraft.catalogScope || {});
    state.catalogSetupOpen = true;
    render();
  }

  function closeCatalogSetup() {
    state.catalogSetupOpen = false;
    state.catalogSetupDraft = null;
    render();
  }

  function toggleCatalogCategory(category) {
    if (!state.catalogSetupDraft) return;
    if (state.catalogSetupDraft[category]) delete state.catalogSetupDraft[category];
    else {
      const firstType = state.policyDraft.playTypes.find(type => type.category === category);
      state.catalogSetupDraft[category] = {
        mode: 'selected',
        playTypeIds: firstType ? [firstType.id] : []
      };
    }
    render();
  }

  function setCatalogCategoryMode(category, mode) {
    const config = state.catalogSetupDraft?.[category];
    if (!config || !['all', 'selected'].includes(mode)) return;
    config.mode = mode;
    if (mode === 'selected' && !(config.playTypeIds || []).length) {
      const firstType = state.policyDraft.playTypes.find(type => type.category === category);
      config.playTypeIds = firstType ? [firstType.id] : [];
    }
    render();
  }

  function setCatalogPlayType(category, id, checked) {
    const config = state.catalogSetupDraft?.[category];
    if (!config) return;
    const selected = new Set(config.playTypeIds || []);
    if (checked) selected.add(id);
    else selected.delete(id);
    config.playTypeIds = Array.from(selected);
    config.mode = 'selected';
    render();
  }

  function applyCatalogSetup() {
    const nextScope = clone(state.catalogSetupDraft || {});
    Object.entries(nextScope).forEach(([category, config]) => {
      if (config.mode === 'selected' && !(config.playTypeIds || []).length) delete nextScope[category];
    });
    const nextPolicy = { ...state.policyDraft, catalogScope: nextScope };
    const scopedIds = scopedPlayTypeIds(nextPolicy);
    if (!scopedIds.size) {
      showAlert('Choose at least one category or play type for the program catalog.');
      return;
    }
    state.policyDraft.catalogScope = nextScope;
    state.policyDraft.tiers.forEach(tier => {
      tier.allowedPlayTypeIds = (tier.allowedPlayTypeIds || []).filter(id => scopedIds.has(id));
    });
    state.catalogSetupOpen = false;
    state.catalogSetupDraft = null;
    markPolicyDirty();
    render();
    showAlert(`${scopedIds.size} Court Reserve play types admitted to the draft program catalog.`);
  }

  function publishPolicy() {
    state.data.policy = clone(state.policyDraft);
    state.data.instructorDirectory = Object.fromEntries(
      (state.data.policy.instructors || []).map(instructor => [instructor.initials, instructor.name])
    );
    state.policyDirty = false;
    state.activeFilters = new Set(scopedCategories().map(slug));
    render();
    showAlert('Policy published to this browser-only concept. The instructor workspace now reflects it.');
  }

  function resetPolicyDraft() {
    state.policyDraft = clone(state.data.policy);
    state.policyDirty = false;
    state.catalogSetupOpen = false;
    state.catalogSetupDraft = null;
    if (!tierById(state.policyDraft, state.selectedTierId)) {
      state.selectedTierId = state.data.profile.tierId;
    }
    render();
  }

  function previewSelectedTier() {
    state.data.profile.tierId = state.selectedTierId;
    state.activeMode = 'instructor';
    state.activeView = 'available';
    state.activeFilters = new Set(scopedCategories().map(slug));
    state.selectedAvailable.clear();
    state.stagedCoverageId = null;
    render();
    showAlert(`Instructor workspace previewing ${activeTier()?.label || 'the selected level'}.`);
    window.scrollTo({ top: elements.goalCard.offsetTop, behavior: 'smooth' });
  }

  function addInstructorType(form) {
    const data = new FormData(form);
    const label = String(data.get('label') || '').trim();
    if (!label) return;
    let id = slug(label) || `instructor-type-${Date.now()}`;
    while (state.policyDraft.tiers.some(tier => tier.id === id)) id = `${id}-2`;
    state.policyDraft.tiers.push({
      id,
      label,
      description: 'Facility-defined instructor participation type.',
      monthlyTargetPoints: 5,
      rolloverCap: 5,
      achievement: `${label} pathway complete`,
      allowedPlayTypeIds: [],
      pointsByType: {}
    });
    state.selectedTierId = id;
    markPolicyDirty();
    render();
    showAlert(`${label} created. Its access policy is ready to configure.`);
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
    if (!state.data.instructorHistory) state.data.instructorHistory = {};
    state.data.instructorHistory[id] = [];
    markPolicyDirty();
    render();
    showAlert(`${name} added to the draft participation roster.`);
  }

  function removeInstructor(id) {
    const instructor = (state.policyDraft.instructors || []).find(item => item.id === id);
    if (!instructor) return;
    state.policyDraft.instructors = state.policyDraft.instructors.filter(item => item.id !== id);
    if (state.expandedInstructorId === id) state.expandedInstructorId = null;
    markPolicyDirty();
    render();
    showAlert(`${instructor.name} removed from the draft participation roster.`);
  }

  function resetInstructorPassword(id) {
    const instructor = (state.policyDraft.instructors || []).find(item => item.id === id);
    if (!instructor) return;
    showAlert(`Password reset simulated for ${instructor.name}. No email was sent.`);
  }

  function toggleInstructorHistory(id) {
    state.expandedInstructorId = state.expandedInstructorId === id ? null : id;
    render();
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

  function addConversion(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const sourcePlayTypeId = String(data.get('sourcePlayTypeId') || '').trim();
    if (!name || !sourcePlayTypeId) return;
    let id = slug(name) || `conversion-${Date.now()}`;
    while ((state.policyDraft.conversions || []).some(rule => rule.id === id)) id = `${id}-2`;
    const defaultMembership = state.policyDraft.membershipTypes?.[0]?.id || '';
    if (!state.policyDraft.conversions) state.policyDraft.conversions = [];
    state.policyDraft.conversions.push({
      id,
      name,
      sourcePlayTypeId,
      outcomeType: 'membership',
      outcomeIds: defaultMembership ? [defaultMembership] : [],
      windowValue: 2,
      windowUnit: 'days',
      conversionPoints: 1.5
    });
    markPolicyDirty();
    render();
    showAlert(`${name} added to the draft conversion rules.`);
  }

  function removeConversion(id) {
    const conversion = (state.policyDraft.conversions || []).find(rule => rule.id === id);
    if (!conversion) return;
    state.policyDraft.conversions = state.policyDraft.conversions.filter(rule => rule.id !== id);
    markPolicyDirty();
    render();
    showAlert(`${conversion.name} removed from the draft conversion rules.`);
  }

  function setConversionDestination(id, destinationId, checked, control) {
    const conversion = (state.policyDraft.conversions || []).find(rule => rule.id === id);
    if (!conversion) return;
    const selected = new Set(conversion.outcomeIds || []);
    if (checked) selected.add(destinationId);
    else if (selected.size > 1) selected.delete(destinationId);
    else {
      showAlert('Each conversion rule needs at least one destination.');
      if (control) control.checked = true;
      return;
    }
    conversion.outcomeIds = Array.from(selected);
    markPolicyDirty();
    const summary = control?.closest('.conversion-destination-dropdown')?.querySelector('[data-destination-summary]');
    if (summary) summary.textContent = conversionDestinationSummary(conversion);
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
    const { action, view, filter, classId, tierId, playTypeId, section, category, scopeMode, instructorId, incentiveId, conversionId } = actionTarget.dataset;
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
    if (action === 'open-catalog-setup') openCatalogSetup();
    if (action === 'close-catalog-setup') closeCatalogSetup();
    if (action === 'toggle-catalog-category') toggleCatalogCategory(category);
    if (action === 'set-catalog-category-mode') setCatalogCategoryMode(category, scopeMode);
    if (action === 'apply-catalog-setup') applyCatalogSetup();
    if (action === 'set-curation-section') {
      state.curationSection = section;
      render();
    }
    if (action === 'remove-instructor') removeInstructor(instructorId);
    if (action === 'reset-password') resetInstructorPassword(instructorId);
    if (action === 'toggle-instructor-history') toggleInstructorHistory(instructorId);
    if (action === 'remove-incentive') removeIncentive(incentiveId);
    if (action === 'remove-conversion') removeConversion(conversionId);
    if (action === 'publish-policy') publishPolicy();
    if (action === 'reset-policy-draft') resetPolicyDraft();
    if (action === 'preview-tier') previewSelectedTier();
  }

  function handlePolicyChange(event) {
    const tier = selectedDraftTier();
    if (!tier) return;
    if (event.target.matches('[data-scope-play-type]')) {
      setCatalogPlayType(
        event.target.dataset.category,
        event.target.dataset.playTypeId,
        event.target.checked
      );
      return;
    }
    if (event.target.matches('[data-conversion-destination]')) {
      setConversionDestination(
        event.target.dataset.conversionId,
        event.target.dataset.destinationId,
        event.target.checked,
        event.target
      );
      return;
    }
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
      return;
    }
    if (event.target.matches('[data-conversion-field]')) {
      const conversion = (state.policyDraft.conversions || []).find(
        rule => rule.id === event.target.dataset.conversionId
      );
      if (!conversion) return;
      const field = event.target.dataset.conversionField;
      conversion[field] = event.target.type === 'number'
        ? Math.max(field === 'windowValue' ? 1 : 0, Number(event.target.value || 0))
        : event.target.value;
      if (field === 'outcomeType') {
        const defaultOutcome = conversion.outcomeType === 'play-type'
          ? state.policyDraft.playTypes[0]?.id || ''
          : state.policyDraft.membershipTypes?.[0]?.id || '';
        conversion.outcomeIds = defaultOutcome ? [defaultOutcome] : [];
      }
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

  function captureCollectorLayouts() {
    clearCollector();
    collectorLayouts = new WeakMap();
    if (!state || state.activeMode !== 'instructor') return;
    elements.view.querySelectorAll('[data-collectable]').forEach(item => {
      const rect = item.getBoundingClientRect();
      collectorLayouts.set(item, {
        documentLeft: rect.left + window.scrollX,
        documentTop: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      });
    });
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
      const layout = collectorLayouts.get(item);
      if (!layout) return;
      const rect = {
        left: layout.documentLeft - window.scrollX,
        top: layout.documentTop - window.scrollY,
        width: layout.width,
        height: layout.height
      };
      const covered = goalRect.bottom + 2 - rect.top;
      const progress = Math.max(0, Math.min(1, covered / (rect.height + 2)));
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
      const pull = progress * progress * (3 - (2 * progress));
      const collectX = targetX * pull;
      const collectY = targetY * pull;
      const fadeProgress = Math.max(0, Math.min(1, (progress - 0.28) / 0.24));
      const opacity = 1 - fadeProgress;
      const hidden = progress >= 0.52;
      item.style.setProperty('--collect-x', `${collectX.toFixed(1)}px`);
      item.style.setProperty('--collect-y', `${collectY.toFixed(1)}px`);
      item.style.setProperty('--collect-scale-x', (1 - 0.08 * pull).toFixed(3));
      item.style.setProperty('--collect-scale-y', (1 - 0.08 * pull).toFixed(3));
      item.style.setProperty('--collect-opacity', opacity.toFixed(3));
      item.style.setProperty('--collect-visibility', hidden ? 'hidden' : 'visible');
    });
  }

  function scheduleCollector() {
    if (collectorFrame) cancelAnimationFrame(collectorFrame);
    collectorFrame = requestAnimationFrame(() => {
      collectorFrame = 0;
      updateCollector();
    });
  }

  function recaptureCollectorAfterResize() {
    clearTimeout(collectorResizeTimer);
    collectorResizeTimer = setTimeout(() => {
      captureCollectorLayouts();
      scheduleCollector();
    }, 120);
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
    if (event.target.id === 'instructor-type-form') {
      event.preventDefault();
      addInstructorType(event.target);
    }
    if (event.target.id === 'instructor-form') {
      event.preventDefault();
      addInstructor(event.target);
    }
    if (event.target.id === 'incentive-form') {
      event.preventDefault();
      addIncentive(event.target);
    }
    if (event.target.id === 'conversion-form') {
      event.preventDefault();
      addConversion(event.target);
    }
  });
  elements.primaryAction.addEventListener('click', commitPrimaryAction);
  elements.reset.addEventListener('click', () => {
    resetState();
    showAlert('The fictional concept data and policy draft have been reset.');
  });
  window.addEventListener('scroll', scheduleCollector, { passive: true });
  window.addEventListener('resize', recaptureCollectorAfterResize);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state?.catalogSetupOpen) closeCatalogSetup();
  });

  init();
})();
