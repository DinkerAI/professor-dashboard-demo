(() => {
  'use strict';

  const DATA_URL = 'data/demo.json';
  const views = [
    ['available', 'Available Classes'],
    ['all', 'All Classes'],
    ['history', 'My History']
  ];

  const typeLabels = {
    guided: 'Guided Open Play',
    intro: 'Intro to Pickleball',
    ppu: 'Peak Pickleball University 101/102'
  };

  let sourceData = null;
  let state = null;
  let alertTimer = null;

  const elements = {
    reset: document.getElementById('reset-demo'),
    alert: document.getElementById('demo-alert'),
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

  function resetState() {
    state = {
      data: clone(sourceData),
      activeView: 'available',
      activeFilters: new Set(Object.keys(typeLabels)),
      selectedAvailable: new Set(),
      stagedCoverageId: null
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
    const firstName = profile.name.split(/\s+/)[0] || 'Professor';
    const percentage = profile.targetPoints > 0
      ? Math.min(100, Math.round((profile.completedPoints / profile.targetPoints) * 100))
      : 0;

    elements.firstName.textContent = firstName;
    elements.profileName.textContent = profile.name;
    elements.profileTier.textContent = profile.tier;
    elements.progressCount.textContent = profile.completedPoints;
    elements.progressTarget.textContent = profile.targetPoints;
    elements.progressStatus.textContent = profile.completedPoints >= profile.targetPoints
      ? `${profile.achievement} achieved for this demo month.`
      : `${profile.targetPoints - profile.completedPoints} points until ${profile.achievement}.`;
    elements.progressRollover.textContent = `Rollover ${profile.rolloverPoints}/${profile.rolloverCap}`;
    elements.progressTrack.setAttribute('aria-valuemax', String(profile.targetPoints));
    elements.progressTrack.setAttribute('aria-valuenow', String(profile.completedPoints));
    elements.progressFill.style.width = `${percentage}%`;
    elements.rules.innerHTML = state.data.rules.map(rule => `<li>${escapeHtml(rule)}</li>`).join('');
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
      <div class="filter-bar" aria-label="Filter available classes">
        ${Object.entries(typeLabels).map(([key, label]) => `
          <button
            type="button"
            class="filter-chip ${state.activeFilters.has(key) ? 'is-active' : ''}"
            data-action="toggle-filter"
            data-filter="${key}"
            aria-pressed="${state.activeFilters.has(key)}"
          >${label}</button>
        `).join('')}
      </div>
    `;
  }

  function renderInitials(items) {
    if (!items?.length) return '';
    return `<div class="initials" aria-label="Assigned instructors ${escapeHtml(items.join(', '))}">
      ${items.map(initials => `<span>${escapeHtml(initials)}</span>`).join('')}
    </div>`;
  }

  function eventState(item, context) {
    if (context === 'readonly-mine') {
      return item.coverageRequested ? 'Coverage requested' : 'You are teaching';
    }
    if (context === 'readonly-available') {
      return item.coverageNeeded ? 'Coverage needed' : 'Available';
    }
    if (context === 'mine') {
      if (item.coverageRequested) return 'Coverage requested in demo';
      if (state.stagedCoverageId === item.id) return 'Coverage request staged';
      if (item.locked) return 'Click to request coverage';
      return 'Confirmed · teaching';
    }
    if (context === 'available') {
      if (state.selectedAvailable.has(item.id)) {
        return item.coverageNeeded ? 'Coverage takeover selected' : 'Selected';
      }
      return item.coverageNeeded ? 'Coverage needed' : 'Available';
    }
    if (context === 'full') return item.state || 'Full';
    return 'Available';
  }

  function renderEventCard(item, context = 'available') {
    const selected = state.selectedAvailable.has(item.id);
    const teaching = context === 'mine' || context === 'readonly-mine';
    const coverage = Boolean(item.coverageNeeded || item.coverageRequested || state.stagedCoverageId === item.id);
    const full = context === 'full';
    const interactive = context === 'available' || (context === 'mine' && item.locked && !item.coverageRequested);
    const classes = [
      'event-card',
      selected ? 'is-selected' : '',
      teaching ? 'is-teaching' : '',
      coverage ? 'is-coverage' : '',
      full ? 'is-full' : ''
    ].filter(Boolean).join(' ');
    const tag = interactive ? 'button' : 'article';
    const attrs = interactive
      ? `type="button" data-action="${context === 'available' ? 'toggle-class' : 'stage-coverage'}" data-class-id="${escapeHtml(item.id)}" aria-pressed="${context === 'available' ? selected : state.stagedCoverageId === item.id}"`
      : '';
    const initials = context === 'mine' || context === 'readonly-mine'
      ? item.instructors
      : (item.coverageNeeded ? item.instructors : item.instructors);

    return `
      <${tag} class="${classes}" ${attrs}>
        <div class="event-card__top">
          <h4 class="event-card__title">${escapeHtml(item.name)}</h4>
          ${renderInitials(initials)}
        </div>
        <div class="event-card__when">${formatDay(dateForClass(item))} · ${formatRange(item)}</div>
        <div class="event-card__meta">Courts ${escapeHtml(item.courts)} · Fill ${item.registered}/${item.capacity}</div>
        <div class="event-card__state">${escapeHtml(eventState(item, context))}</div>
        ${item.coverageNeeded ? '<span class="urgency-label">Inside 7 days</span>' : ''}
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

  function renderGroupedEvents(items, context) {
    if (!items.length) return '<div class="empty-state">No classes match the selected filters.</div>';
    return groupByDay(items).map(group => `
      <div class="day-group">
        <h4 class="day-heading">${formatDay(dateForClass(group[0]))}</h4>
        <div class="event-grid">${group.map(item => renderEventCard(item, context)).join('')}</div>
      </div>
    `).join('');
  }

  function renderAvailableView() {
    const myClasses = state.data.myClasses;
    const available = state.data.availableClasses
      .filter(item => state.activeFilters.has(item.type))
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    return `
      <section class="section-block" aria-labelledby="my-classes-title">
        <div class="section-header">
          <div>
            <h3 id="my-classes-title">My Classes</h3>
            <p>Confirmed teaching assignments and coverage controls.</p>
          </div>
        </div>
        <div class="event-grid">
          ${myClasses.map(item => renderEventCard(item, 'mine')).join('') || '<div class="empty-state">No classes selected yet.</div>'}
        </div>
      </section>

      <section class="section-block" aria-labelledby="available-classes-title">
        <div class="section-header">
          <div>
            <h3 id="available-classes-title">Available Classes</h3>
            <p>Select classes, then use the confirmation button above.</p>
          </div>
        </div>
        ${renderFilters()}
        ${renderGroupedEvents(available, 'available')}
      </section>
    `;
  }

  function renderAllView() {
    const mine = state.data.myClasses.map(item => ({ ...item, allContext: 'readonly-mine' }));
    const available = state.data.availableClasses.map(item => ({ ...item, allContext: 'readonly-available' }));
    const full = state.data.fullClasses.map(item => ({ ...item, allContext: 'full' }));
    const all = [...mine, ...available, ...full]
      .filter(item => state.activeFilters.has(item.type))
      .sort((a, b) => dateForClass(a) - dateForClass(b));
    if (!all.length) return '<div class="empty-state">No classes match the selected filters.</div>';
    return `
      <section class="section-block" aria-labelledby="all-classes-title">
        <div class="section-header">
          <div>
            <h3 id="all-classes-title">All Classes</h3>
            <p>A read-only view of availability, instructor capacity, and coverage status.</p>
          </div>
        </div>
        ${renderFilters()}
        ${groupByDay(all).map(group => `
          <div class="day-group">
            <h4 class="day-heading">${formatDay(dateForClass(group[0]))}</h4>
            <div class="event-grid">
              ${group.map(item => renderEventCard(item, item.allContext)).join('')}
            </div>
          </div>
        `).join('')}
      </section>
    `;
  }

  function renderHistoryView() {
    const today = startOfToday();
    return `
      <section class="section-block" aria-labelledby="history-title">
        <div class="section-header">
          <div>
            <h3 id="history-title">My History</h3>
            <p>Completed classes and teaching credit by month.</p>
          </div>
        </div>
        <div class="history-list">
          ${state.data.history.map((month, index) => {
            const monthDate = new Date(today.getFullYear(), today.getMonth() + month.monthOffset, 1);
            const total = month.classes.reduce((sum, item) => sum + Number(item.points || 0), 0);
            return `
              <details class="history-month" ${index === 0 ? 'open' : ''}>
                <summary>
                  ${formatMonth(monthDate)}
                  <span>${month.classes.length} classes · ${total} points</span>
                </summary>
                <div class="history-rows">
                  ${month.classes.map(item => {
                    const date = dateForHistory(month.monthOffset, item.day, item.time);
                    return `
                      <div class="history-row">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${formatDay(date)} · ${formatTime(item.time)}</span>
                        <span>${item.points} pt</span>
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

  function renderPrimaryAction() {
    const selected = Array.from(state.selectedAvailable);
    const coverageSelected = selected.some(id => {
      const item = state.data.availableClasses.find(entry => entry.id === id);
      return item?.coverageNeeded;
    });

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

  function renderView() {
    if (state.activeView === 'all') {
      elements.view.innerHTML = renderAllView();
    } else if (state.activeView === 'history') {
      elements.view.innerHTML = renderHistoryView();
    } else {
      elements.view.innerHTML = renderAvailableView();
    }
  }

  function render() {
    renderProfile();
    renderTabs();
    renderPrimaryAction();
    renderView();
  }

  function setView(view) {
    if (!views.some(([key]) => key === view)) return;
    state.activeView = view;
    state.stagedCoverageId = null;
    state.selectedAvailable.clear();
    render();
  }

  function toggleFilter(filter) {
    if (!(filter in typeLabels)) return;
    if (state.activeFilters.has(filter)) {
      state.activeFilters.delete(filter);
    } else {
      state.activeFilters.add(filter);
    }
    render();
  }

  function toggleClass(id) {
    const item = state.data.availableClasses.find(entry => entry.id === id);
    if (!item) return;
    state.stagedCoverageId = null;
    if (state.selectedAvailable.has(id)) {
      state.selectedAvailable.delete(id);
    } else {
      state.selectedAvailable.add(id);
    }
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
      showAlert('Coverage request recorded in the demo. No external system was contacted.');
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
        locked: Number(item.dayOffset) <= 7,
        coverageRequested: false,
        coverageNeeded: false
      });
    });
    state.data.profile.completedPoints = Math.min(
      state.data.profile.targetPoints + state.data.profile.rolloverCap,
      state.data.profile.completedPoints + selectedItems.reduce((sum, item) => sum + Number(item.points || 0), 0)
    );
    state.selectedAvailable.clear();
    render();
    showAlert(
      selectedItems.length === 1 && selectedItems[0].coverageNeeded
        ? 'Coverage takeover recorded in the demo. CourtReserve sync remains disabled.'
        : `${selectedItems.length} class${selectedItems.length === 1 ? '' : 'es'} added to My Classes in the demo.`
    );
  }

  function handleClick(event) {
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    const { action, view, filter, classId } = actionTarget.dataset;
    if (action === 'set-view') setView(view);
    if (action === 'toggle-filter') toggleFilter(filter);
    if (action === 'toggle-class') toggleClass(classId);
    if (action === 'stage-coverage') stageCoverage(classId);
  }

  async function init() {
    if (new URLSearchParams(window.location.search).get('embed') === '1') {
      document.body.classList.add('is-embed');
    }

    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Demo data returned ${response.status}`);
      sourceData = await response.json();
      resetState();
    } catch (error) {
      elements.view.innerHTML = `
        <div class="empty-state">
          The demo data could not load. Serve this folder over HTTP rather than opening index.html directly.
        </div>
      `;
      console.error(error);
    }
  }

  elements.tabs.addEventListener('click', handleClick);
  elements.view.addEventListener('click', handleClick);
  elements.primaryAction.addEventListener('click', commitPrimaryAction);
  elements.reset.addEventListener('click', () => {
    resetState();
    showAlert('The fictional demo data has been reset.');
  });

  init();
})();
