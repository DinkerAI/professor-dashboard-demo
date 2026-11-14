(() => {
  'use strict';

  const DATA_URL = '/data/tournament-demo.json';
  const modeLabels = {
    static: 'Static amount',
    perPlayer: 'Per player',
    perMedal: 'Per medal',
    perHour: 'Per tournament hour',
    perCourt: 'Per court',
    percentGross: '% of gross revenue',
    percentNet: '% of remaining net'
  };

  const elements = {
    reset: document.getElementById('reset-calculator'),
    name: document.getElementById('tournament-name'),
    scenarioStrip: document.getElementById('scenario-strip'),
    scenarioBody: document.getElementById('scenario-table-body'),
    rows: document.getElementById('calculation-rows'),
    addRow: document.getElementById('add-calculation-row'),
    maxNet: document.getElementById('max-net'),
    maxLedger: document.getElementById('max-ledger'),
    divisionSpread: document.getElementById('division-spread'),
    runnableDivisions: document.getElementById('runnable-divisions'),
    divisionFilter: document.getElementById('division-filter'),
    divisionSummary: document.getElementById('division-summary'),
    combineSpread: document.getElementById('toggle-combine-spread'),
    registrationMarks: document.getElementById('registration-marks'),
    registrationAverage: document.getElementById('registration-average'),
    gridCapacity: document.getElementById('grid-capacity'),
    driverNote: document.getElementById('driver-note')
  };

  let sourceData;
  let state;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, digits = 0) {
    const factor = 10 ** digits;
    return Math.round((number(value) + Number.EPSILON) * factor) / factor;
  }

  function money(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(number(value));
  }

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    }).format(number(value));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function teamSize() {
    const singles = Boolean(state.grid.formats.singles);
    const doubles = Boolean(state.grid.formats.doubles);
    if (singles && doubles) return 1.65;
    return singles ? 1 : 2;
  }

  function averageRegistrationFee() {
    const marks = state.pricing.registrationMarks || [];
    if (!marks.length) return 0;
    return marks.reduce((sum, mark) => sum + number(mark.amount), 0) / marks.length;
  }

  function gridMetrics() {
    const grid = state.grid;
    const duprRange = Math.max(0.25, number(grid.duprMax) - number(grid.duprMin));
    const ageRange = Math.max(1, number(grid.ageMax) - number(grid.ageMin) + 1);
    const duprBands = Math.max(1, Math.ceil(duprRange / Math.max(0.25, number(grid.duprIncrement, 0.5))));
    const ageBands = Math.max(1, Math.ceil(ageRange / Math.max(1, number(grid.ageIncrement, 10))));
    const groupFormats = divisionProfiles().length;
    return {
      duprBands,
      ageBands,
      possibleDivisions: duprBands * ageBands * groupFormats
    };
  }

  function calculateOperations(players) {
    const grid = state.grid;
    const metrics = gridMetrics();
    const playerCount = Math.max(0, number(players));
    const entries = playerCount * Math.max(1, number(grid.averageEventsPerPlayer, 1));
    const teams = entries / teamSize();
    const minTeams = Math.max(2, number(grid.minTeams, 4));
    const maxTeams = Math.max(minTeams, number(grid.maxTeams, 12));
    const activeDivisions = playerCount > 0
      ? Math.max(1, Math.min(metrics.possibleDivisions, Math.floor(teams / minTeams)))
      : 0;
    const teamsPerDivision = activeDivisions
      ? clamp(teams / activeDivisions, 0, maxTeams)
      : 0;
    const poolGames = activeDivisions * (teamsPerDivision * Math.max(1, number(grid.poolGamesPerTeam, 4)) / 2);
    const advancingTeams = Math.min(4, Math.floor(teamsPerDivision));
    const semifinalGames = grid.championshipBracket && advancingTeams >= 4 ? activeDivisions * 2 : 0;
    const goldGames = grid.championshipBracket && advancingTeams >= 2 ? activeDivisions : 0;
    const bronzeGames = grid.championshipBracket && grid.bronzeMatch && advancingTeams >= 4 ? activeDivisions : 0;
    const championshipGames = semifinalGames + goldGames + bronzeGames;
    const games = Math.max(0, Math.round(poolGames + championshipGames));
    const totalMinutes =
      poolGames * Math.max(5, number(grid.poolMatchMinutes, 25)) +
      semifinalGames * Math.max(5, number(grid.championshipMatchMinutes, 35)) +
      bronzeGames * Math.max(5, number(grid.bronzeMatchMinutes, 40)) +
      goldGames * Math.max(5, number(grid.goldMatchMinutes, 45));
    const hours = totalMinutes / Math.max(1, number(grid.courts, 1)) / 60;
    const medalPlacements = activeDivisions * 3 * teamSize();
    const medals = Math.max(0, Math.round(medalPlacements));
    const volunteers = Math.max(1, Math.round(
      number(grid.courts) * 0.5 + hours / 7 + playerCount / 120
    ));
    return {
      players: Math.round(playerCount),
      entries: Math.round(entries),
      activeDivisions,
      teamsPerDivision: round(teamsPerDivision, 1),
      medals,
      games,
      poolGames: Math.round(poolGames),
      championshipGames: Math.round(championshipGames),
      hours: round(hours, 1),
      volunteers,
      courts: Math.max(1, Math.round(number(grid.courts, 1)))
    };
  }

  function rowValue(row, operations, grossRevenue) {
    const amount = number(row.amount);
    if (row.mode === 'perPlayer') return operations.players * amount;
    if (row.mode === 'perMedal') return operations.medals * amount;
    if (row.mode === 'perHour') return operations.hours * amount;
    if (row.mode === 'perCourt') return operations.courts * amount;
    if (row.mode === 'percentGross') return grossRevenue * amount / 100;
    return amount;
  }

  function calculateFinancials(operations) {
    const registrationRevenue = operations.players * averageRegistrationFee();
    const eventRevenue = operations.entries * number(state.pricing.eventFee);
    const revenueLines = [
      { label: 'Registration', value: registrationRevenue },
      { label: 'Event entries', value: eventRevenue }
    ];
    const expenseLines = [];
    let grossRevenue = registrationRevenue + eventRevenue;

    const rows = state.calculationRows || [];
    rows.filter(row => row.type === 'revenue' && row.mode !== 'percentGross' && row.mode !== 'percentNet')
      .forEach(row => {
        const value = rowValue(row, operations, grossRevenue);
        grossRevenue += value;
        revenueLines.push({ label: row.title, value });
      });
    rows.filter(row => row.type === 'revenue' && row.mode === 'percentGross')
      .forEach(row => {
        const value = rowValue(row, operations, grossRevenue);
        grossRevenue += value;
        revenueLines.push({ label: row.title, value });
      });

    let expenses = 0;
    rows.filter(row => row.type === 'expense' && row.mode !== 'percentNet')
      .forEach(row => {
        const value = rowValue(row, operations, grossRevenue);
        expenses += value;
        expenseLines.push({ label: row.title, value });
      });

    rows.filter(row => row.mode === 'percentNet').forEach(row => {
      const remainingNet = Math.max(0, grossRevenue - expenses);
      const value = remainingNet * number(row.amount) / 100;
      if (row.type === 'revenue') {
        grossRevenue += value;
        revenueLines.push({ label: row.title, value });
      } else {
        expenses += value;
        expenseLines.push({ label: row.title, value });
      }
    });

    return {
      grossRevenue,
      expenses,
      net: grossRevenue - expenses,
      revenueLines,
      expenseLines
    };
  }

  function calculateScenario(scenario) {
    const operations = calculateOperations(number(state.players) * number(scenario.percent, 1));
    return {
      ...scenario,
      ...operations,
      ...calculateFinancials(operations)
    };
  }

  function solvePlayersForHours(targetHours) {
    const target = Math.max(1, number(targetHours, 1));
    let low = 1;
    let high = 2000;
    for (let index = 0; index < 28; index += 1) {
      const middle = (low + high) / 2;
      if (calculateOperations(middle).hours < target) low = middle;
      else high = middle;
    }
    return Math.max(1, Math.round((low + high) / 2));
  }

  function calculationModeOptions(selected) {
    return Object.entries(modeLabels).map(([value, label]) =>
      `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
    ).join('');
  }

  function renderRegistrationMarks() {
    elements.registrationMarks.innerHTML = state.pricing.registrationMarks.map(mark => `
      <label>
        <span>${escapeHtml(mark.label)}</span>
        <div class="input-unit input-unit--currency"><em>$</em><input type="number" min="0" step="1" data-registration-id="${escapeHtml(mark.id)}" value="${escapeHtml(mark.amount)}" /></div>
      </label>
    `).join('');
    elements.registrationAverage.textContent = money(averageRegistrationFee());
  }

  function renderCalculationRows() {
    elements.rows.innerHTML = state.calculationRows.map(row => `
      <tr>
        <td><input class="table-input table-input--wide" type="text" data-row-id="${escapeHtml(row.id)}" data-row-field="title" value="${escapeHtml(row.title)}" /></td>
        <td>
          <select data-row-id="${escapeHtml(row.id)}" data-row-field="type">
            <option value="revenue" ${row.type === 'revenue' ? 'selected' : ''}>Revenue</option>
            <option value="expense" ${row.type === 'expense' ? 'selected' : ''}>Expense</option>
          </select>
        </td>
        <td><select data-row-id="${escapeHtml(row.id)}" data-row-field="mode">${calculationModeOptions(row.mode)}</select></td>
        <td><input class="table-input" type="number" step="0.25" data-row-id="${escapeHtml(row.id)}" data-row-field="amount" value="${escapeHtml(row.amount)}" /></td>
        <td><button class="remove-row" type="button" data-remove-row="${escapeHtml(row.id)}" aria-label="Remove ${escapeHtml(row.title)}">×</button></td>
      </tr>
    `).join('');
  }

  function renderScenarioStrip(results) {
    elements.scenarioStrip.innerHTML = results.map((result, index) => `
      <article class="scenario-summary ${index === 0 ? 'scenario-summary--primary' : ''}">
        <div><span>${escapeHtml(result.label)}</span><strong>${money(result.net)}</strong></div>
        <p>${formatNumber(result.players)} players · ${formatNumber(result.activeDivisions)} divisions · ${formatNumber(result.hours, 1)} hours</p>
        <div class="scenario-summary__bar"><span style="width:${Math.max(4, number(result.percent) * 100)}%"></span></div>
      </article>
    `).join('');
  }

  function renderScenarioTable(results) {
    elements.scenarioBody.innerHTML = results.map(result => `
      <tr>
        <th>${escapeHtml(result.label)}</th>
        <td>${formatNumber(result.players)}</td>
        <td>${formatNumber(result.activeDivisions)}</td>
        <td>${formatNumber(result.teamsPerDivision, 1)}</td>
        <td>${formatNumber(result.medals)}</td>
        <td>${formatNumber(result.games)}</td>
        <td>${formatNumber(result.hours, 1)}</td>
        <td>${formatNumber(result.volunteers)}</td>
        <td class="${result.net >= 0 ? 'positive' : 'negative'}">${money(result.net)}</td>
      </tr>
    `).join('');
  }

  function renderLedger(result) {
    elements.maxNet.textContent = money(result.net);
    elements.maxNet.classList.toggle('negative', result.net < 0);
    const revenue = result.revenueLines.map(line => `
      <div><span>${escapeHtml(line.label)}</span><strong class="positive">${money(line.value)}</strong></div>
    `).join('');
    const expenses = result.expenseLines.map(line => `
      <div><span>${escapeHtml(line.label)}</span><strong class="negative">${money(line.value)}</strong></div>
    `).join('');
    elements.maxLedger.innerHTML = `
      <div class="ledger-group"><h3>Revenue <span>${money(result.grossRevenue)}</span></h3>${revenue}</div>
      <div class="ledger-group"><h3>Expenses <span>${money(result.expenses)}</span></h3>${expenses || '<div><span>No expense rows</span><strong>$0</strong></div>'}</div>
      <div class="ledger-total"><span>Projected net</span><strong class="${result.net >= 0 ? 'positive' : 'negative'}">${money(result.net)}</strong></div>
    `;
  }

  function divisionProfiles() {
    const profiles = [];
    const groups = state.grid.groups;
    const formats = state.grid.formats;
    if (formats.doubles) {
      if (groups.mens) profiles.push({ key: 'mens-doubles', label: 'Men’s Doubles', short: 'MD', type: 'doubles', weight: 0.98 });
      if (groups.womens) profiles.push({ key: 'womens-doubles', label: 'Women’s Doubles', short: 'WD', type: 'doubles', weight: 0.94 });
      if (groups.mixed) profiles.push({ key: 'mixed-doubles', label: 'Mixed Doubles', short: 'MX', type: 'doubles', weight: 1.08 });
    }
    if (formats.singles) {
      if (groups.mens) profiles.push({ key: 'mens-singles', label: 'Men’s Singles', short: 'MS', type: 'singles', weight: 0.64 });
      if (groups.womens) profiles.push({ key: 'womens-singles', label: 'Women’s Singles', short: 'WS', type: 'singles', weight: 0.6 });
      if (groups.mixed) profiles.push({ key: 'open-singles', label: 'Open Singles', short: 'OS', type: 'singles', weight: 0.54 });
    }
    return profiles.length ? profiles : [{ key: 'open', label: 'Open', short: 'OP', type: 'doubles', weight: 1 }];
  }

  function projectedDivisionSpread(result) {
    const grid = state.grid;
    const metrics = gridMetrics();
    const profiles = divisionProfiles();
    const capacity = Math.max(2, number(grid.maxTeams, 12));
    const floor = Math.max(2, number(grid.minTeams, 4));
    const inventory = [];

    profiles.forEach(profile => {
      for (let duprIndex = 0; duprIndex < metrics.duprBands; duprIndex += 1) {
        const duprMin = number(grid.duprMin) + duprIndex * number(grid.duprIncrement, 0.5);
        const duprMax = Math.min(number(grid.duprMax), duprMin + number(grid.duprIncrement, 0.5));
        const duprCenter = (duprMin + duprMax) / 2;
        for (let ageIndex = 0; ageIndex < metrics.ageBands; ageIndex += 1) {
          const ageMin = number(grid.ageMin) + ageIndex * number(grid.ageIncrement, 10);
          const ageMax = Math.min(number(grid.ageMax), ageMin + number(grid.ageIncrement, 10) - 1);
          const ageCenter = (ageMin + ageMax) / 2;
          const duprWeight = 0.58 + 0.72 * Math.exp(-1 * (((duprCenter - 3.45) / 0.9) ** 2));
          const ageWeight = 0.52 + 0.78 * Math.exp(-1 * (((ageCenter - 43) / 24) ** 2));
          inventory.push({
            id: `${profile.key}-${duprIndex}-${ageIndex}`,
            profile,
            duprMin,
            duprMax,
            duprLabel: `${formatNumber(duprMin, 1)}–${formatNumber(duprMax, 1)}`,
            ageMin,
            ageMax,
            ageCenter,
            ageLabel: `${ageMin}–${ageMax}`,
            capacity,
            weight: profile.weight * duprWeight * ageWeight
          });
        }
      }
    });

    const totalTeams = Math.min(inventory.length * capacity, result.entries / teamSize());
    const weightTotal = inventory.reduce((sum, item) => sum + item.weight, 0) || 1;
    inventory.forEach(item => {
      item.teams = Math.min(capacity, totalTeams * item.weight / weightTotal);
    });
    let remainder = totalTeams - inventory.reduce((sum, item) => sum + item.teams, 0);
    let guard = 0;
    while (remainder > 0.01 && guard < 12) {
      const open = inventory.filter(item => item.teams < capacity - 0.01);
      if (!open.length) break;
      const openWeight = open.reduce((sum, item) => sum + item.weight, 0) || 1;
      open.forEach(item => {
        item.teams += Math.min(capacity - item.teams, remainder * item.weight / openWeight);
      });
      remainder = totalTeams - inventory.reduce((sum, item) => sum + item.teams, 0);
      guard += 1;
    }

    return inventory.map(item => {
      const teams = round(item.teams, 1);
      return {
        ...item,
        teams,
        label: `${item.profile.label} · Age ${item.ageLabel} · DUPR ${item.duprLabel}`,
        shortLabel: `${item.profile.short} ${item.ageLabel} ${item.duprLabel}`,
        runnable: teams >= floor,
        combineCandidate: teams > 0 && teams < floor,
        combined: false
      };
    });
  }

  function filterDivisionSpread(spread) {
    const filter = state.divisionFilter || 'all';
    if (filter === 'all' || filter === 'dupr') return spread;
    if (filter === 'singles') return spread.filter(item => item.profile.type === 'singles');
    return spread.filter(item => item.profile.key === filter);
  }

  function groupItems(items, key) {
    const groups = new Map();
    items.forEach(item => {
      const value = key(item);
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(item);
    });
    return [...groups.values()];
  }

  function summarizeDuprSpread(spread) {
    return groupItems(spread, item => item.duprLabel).map(items => {
      const source = items[0];
      const teams = round(items.reduce((sum, item) => sum + item.teams, 0), 1);
      const capacity = items.reduce((sum, item) => sum + item.capacity, 0);
      return {
        ...source,
        id: `dupr-${source.duprLabel}`,
        teams,
        capacity,
        label: `DUPR ${source.duprLabel} · ${items.length} created divisions`,
        shortLabel: `DUPR ${source.duprLabel}`,
        runnable: items.some(item => item.runnable),
        combineCandidate: items.some(item => item.combineCandidate),
        combined: false
      };
    });
  }

  function combinedSpreadItem(items, status) {
    const source = items[0];
    const teams = round(items.reduce((sum, item) => sum + item.teams, 0), 1);
    const ageMin = Math.min(...items.map(item => item.ageMin));
    const ageMax = Math.max(...items.map(item => item.ageMax));
    const combined = items.length > 1;
    return {
      ...source,
      id: `${source.profile.key}-${source.duprLabel}-${ageMin}-${ageMax}`,
      teams,
      capacity: Math.max(source.capacity, teams),
      ageMin,
      ageMax,
      ageLabel: `${ageMin}–${ageMax}`,
      label: `${source.profile.label} · Age ${ageMin}–${ageMax} · DUPR ${source.duprLabel}`,
      shortLabel: `${source.profile.short} ${ageMin}–${ageMax} ${source.duprLabel}`,
      runnable: status !== 'leftover',
      combineCandidate: status === 'leftover',
      combined
    };
  }

  function combineDivisionSpreadByAge(spread) {
    const floor = Math.max(2, number(state.grid.minTeams, 4));
    const output = [];
    groupItems(spread.filter(item => item.teams > 0), item => `${item.profile.key}|${item.duprLabel}`)
      .forEach(group => {
        const sorted = [...group].sort((a, b) => a.ageCenter - b.ageCenter);
        let pool = [];
        const flush = status => {
          if (!pool.length) return;
          output.push(combinedSpreadItem(pool, status));
          pool = [];
        };
        sorted.forEach(item => {
          if (item.teams >= floor) {
            flush('leftover');
            output.push(combinedSpreadItem([item], 'standalone'));
            return;
          }
          pool.push(item);
          if (pool.reduce((sum, poolItem) => sum + poolItem.teams, 0) >= floor) flush('combined');
        });
        flush('leftover');
      });
    return output;
  }

  function renderDivisionSpread(result) {
    const raw = projectedDivisionSpread(result);
    let spread = filterDivisionSpread(raw);
    const filter = state.divisionFilter || 'all';
    if (filter === 'dupr') spread = summarizeDuprSpread(spread);
    else if (state.combineSpread) spread = combineDivisionSpreadByAge(spread);
    spread.sort((a, b) => a.duprMin - b.duprMin || a.profile.short.localeCompare(b.profile.short) || a.ageMin - b.ageMin);

    const runnable = spread.filter(item => item.runnable).length;
    const candidates = spread.filter(item => item.combineCandidate).length;
    const combined = spread.filter(item => item.combined).length;
    elements.runnableDivisions.textContent = formatNumber(runnable);
    elements.divisionSummary.textContent = spread.length
      ? `${formatNumber(spread.length)} projected divisions · ${formatNumber(runnable)} runnable · ${formatNumber(combined)} age-combined · ${formatNumber(candidates)} still need combining`
      : 'No projected divisions match this view. Enable the related group and format to model it.';

    elements.divisionSpread.innerHTML = spread.length ? spread.map((item, index) => {
      const height = Math.max(3, Math.round(item.teams / Math.max(1, item.capacity) * 100));
      const stateClass = item.combined ? 'is-combined' : item.runnable ? 'is-runnable' : 'needs-combination';
      return `
        <div class="division-bar ${stateClass}" title="${escapeHtml(item.label)} · ${formatNumber(item.teams, 1)} teams">
          <div><span style="--bar-height:${height}%;--bar-delay:${Math.min(360, index * 16)}ms"></span></div>
          <strong>${formatNumber(item.teams, 1)}</strong>
          <em>${escapeHtml(item.shortLabel)}</em>
        </div>
      `;
    }).join('') : '<div class="division-empty">No divisions in this view.</div>';
    elements.divisionSpread.setAttribute('aria-label', `${runnable} of ${spread.length} displayed divisions are runnable`);
  }

  function syncControls() {
    elements.name.value = state.name;
    document.querySelectorAll('[data-driver]').forEach(button => {
      const active = button.dataset.driver === state.driver;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('[data-field="players"]').value = state.players;
    document.querySelector('[data-field="targetHours"]').value = state.targetHours;
    document.querySelectorAll('[data-grid]').forEach(input => {
      input.value = state.grid[input.dataset.grid];
    });
    document.querySelectorAll('[data-grid-toggle]').forEach(input => {
      input.checked = Boolean(state.grid[input.dataset.gridToggle]);
    });
    document.querySelectorAll('[data-group]').forEach(input => {
      input.checked = Boolean(state.grid.groups[input.dataset.group]);
    });
    document.querySelectorAll('[data-format]').forEach(input => {
      input.checked = Boolean(state.grid.formats[input.dataset.format]);
    });
    document.querySelector('[data-pricing="eventFee"]').value = state.pricing.eventFee;
    elements.divisionFilter.value = state.divisionFilter || 'all';
    elements.combineSpread.textContent = state.combineSpread ? 'Show raw ages' : 'Combine ages';
    elements.combineSpread.disabled = state.divisionFilter === 'dupr';
    elements.gridCapacity.textContent = formatNumber(gridMetrics().possibleDivisions);
    elements.driverNote.textContent = state.driver === 'players'
      ? `Runtime is calculated from ${formatNumber(state.players)} max-fill players.`
      : `${formatNumber(state.players)} players fit the ${formatNumber(state.targetHours)}-hour runtime target.`;
  }

  function render() {
    if (state.driver === 'hours') state.players = solvePlayersForHours(state.targetHours);
    else state.targetHours = calculateOperations(state.players).hours;
    syncControls();
    renderRegistrationMarks();
    renderCalculationRows();
    const results = state.scenarios.map(calculateScenario);
    renderScenarioStrip(results);
    renderScenarioTable(results);
    renderLedger(results[0]);
    renderDivisionSpread(results[0]);
  }

  function addCalculationRow() {
    state.calculationRows.push({
      id: `row-${Date.now()}`,
      title: 'New assumption',
      type: 'expense',
      mode: 'static',
      amount: 0
    });
    render();
  }

  function ensureToggle(record, key, checked, control) {
    record[key] = checked;
    if (!Object.values(record).some(Boolean)) {
      record[key] = true;
      control.checked = true;
    }
  }

  function handleClick(event) {
    const driver = event.target.closest('[data-driver]');
    if (driver) {
      state.driver = driver.dataset.driver;
      if (state.driver === 'hours') state.players = solvePlayersForHours(state.targetHours);
      render();
      return;
    }
    if (event.target.closest('#toggle-combine-spread')) {
      state.combineSpread = !state.combineSpread;
      render();
      return;
    }
    const remove = event.target.closest('[data-remove-row]');
    if (remove) {
      state.calculationRows = state.calculationRows.filter(row => row.id !== remove.dataset.removeRow);
      render();
    }
  }

  function handleChange(event) {
    if (event.target.matches('#division-filter')) {
      state.divisionFilter = event.target.value;
      render();
      return;
    }
    if (event.target.matches('[data-field]')) {
      const field = event.target.dataset.field;
      state[field] = Math.max(1, number(event.target.value));
      state.driver = field === 'players' ? 'players' : 'hours';
      render();
      return;
    }
    if (event.target.matches('[data-grid]')) {
      const field = event.target.dataset.grid;
      const minimums = {
        courts: 1,
        poolGamesPerTeam: 1,
        poolMatchMinutes: 5,
        championshipMatchMinutes: 5,
        bronzeMatchMinutes: 5,
        goldMatchMinutes: 5,
        duprMin: 2,
        duprMax: 2.5,
        duprIncrement: 0.25,
        ageMin: 8,
        ageMax: 9,
        ageIncrement: 1,
        minTeams: 2,
        maxTeams: 2,
        averageEventsPerPlayer: 1
      };
      const minimum = minimums[field] ?? 0;
      state.grid[field] = Math.max(minimum, number(event.target.value, minimum));
      if (field === 'courts' || field === 'poolGamesPerTeam' || field === 'ageIncrement' || field === 'minTeams' || field === 'maxTeams') {
        state.grid[field] = Math.round(state.grid[field]);
      }
      if (field === 'duprMin' && state.grid.duprMin >= state.grid.duprMax) state.grid.duprMax = state.grid.duprMin + 0.5;
      if (field === 'duprMax' && state.grid.duprMax <= state.grid.duprMin) state.grid.duprMin = state.grid.duprMax - 0.5;
      if (field === 'ageMin' && state.grid.ageMin >= state.grid.ageMax) state.grid.ageMax = state.grid.ageMin + 1;
      if (field === 'ageMax' && state.grid.ageMax <= state.grid.ageMin) state.grid.ageMin = state.grid.ageMax - 1;
      if (field === 'minTeams' && state.grid.minTeams > state.grid.maxTeams) state.grid.maxTeams = state.grid.minTeams;
      if (field === 'maxTeams' && state.grid.maxTeams < state.grid.minTeams) state.grid.minTeams = state.grid.maxTeams;
      render();
      return;
    }
    if (event.target.matches('[data-grid-toggle]')) {
      state.grid[event.target.dataset.gridToggle] = event.target.checked;
      render();
      return;
    }
    if (event.target.matches('[data-group]')) {
      ensureToggle(state.grid.groups, event.target.dataset.group, event.target.checked, event.target);
      render();
      return;
    }
    if (event.target.matches('[data-format]')) {
      ensureToggle(state.grid.formats, event.target.dataset.format, event.target.checked, event.target);
      render();
      return;
    }
    if (event.target.matches('[data-pricing]')) {
      state.pricing[event.target.dataset.pricing] = Math.max(0, number(event.target.value));
      render();
      return;
    }
    if (event.target.matches('[data-registration-id]')) {
      const mark = state.pricing.registrationMarks.find(item => item.id === event.target.dataset.registrationId);
      if (mark) mark.amount = Math.max(0, number(event.target.value));
      render();
      return;
    }
    if (event.target.matches('[data-row-field]')) {
      const row = state.calculationRows.find(item => item.id === event.target.dataset.rowId);
      if (!row) return;
      const field = event.target.dataset.rowField;
      row[field] = field === 'amount' ? number(event.target.value) : event.target.value;
      render();
    }
  }

  function resetDemo() {
    state = clone(sourceData);
    render();
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Data request failed with ${response.status}`);
      sourceData = await response.json();
      resetDemo();
      document.addEventListener('click', handleClick);
      document.addEventListener('change', handleChange);
      elements.name.addEventListener('input', event => {
        state.name = event.target.value;
      });
      elements.addRow.addEventListener('click', addCalculationRow);
      elements.reset.addEventListener('click', resetDemo);
    } catch (error) {
      document.querySelector('.calculator-shell').innerHTML = `
        <div class="load-error"><strong>The tournament demo could not load.</strong><span>${escapeHtml(error.message)}</span></div>
      `;
    }
  }

  init();
})();
