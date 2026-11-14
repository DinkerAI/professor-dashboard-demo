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

  function enabledCount(record) {
    return Math.max(1, Object.values(record || {}).filter(Boolean).length);
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
    const ageRange = Math.max(1, number(grid.ageMax) - number(grid.ageMin));
    const duprBands = Math.max(1, Math.ceil(duprRange / Math.max(0.25, number(grid.duprIncrement, 0.5))));
    const ageBands = Math.max(1, Math.ceil(ageRange / Math.max(1, number(grid.ageIncrement, 10))));
    const groupFormats = enabledCount(grid.groups) * enabledCount(grid.formats);
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
      ? clamp(teams / activeDivisions, minTeams, maxTeams)
      : 0;
    const poolGames = activeDivisions * (teamsPerDivision * Math.max(1, number(grid.poolGamesPerTeam, 4)) / 2);
    const championshipGames = grid.championshipBracket
      ? activeDivisions * (Math.max(0, Math.min(4, Math.floor(teamsPerDivision)) - 1) + (grid.bronzeMatch ? 1 : 0))
      : 0;
    const games = Math.max(0, Math.round(poolGames + championshipGames));
    const hours = games * Math.max(5, number(grid.matchMinutes, 25)) / Math.max(1, number(grid.courts, 1)) / 60;
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
    let low = 20;
    let high = 2000;
    for (let index = 0; index < 28; index += 1) {
      const middle = (low + high) / 2;
      if (calculateOperations(middle).hours < target) low = middle;
      else high = middle;
    }
    return Math.max(20, Math.round((low + high) / 20) * 10);
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

  function divisionSpread(result) {
    const metrics = gridMetrics();
    const count = Math.min(18, Math.max(6, metrics.duprBands * 3));
    const labels = [];
    for (let index = 0; index < count; index += 1) {
      const band = index % metrics.duprBands;
      const low = number(state.grid.duprMin) + band * number(state.grid.duprIncrement, 0.5);
      const ageBand = index % metrics.ageBands;
      const ageStart = number(state.grid.ageMin) + ageBand * number(state.grid.ageIncrement, 10);
      const weight = 0.68 + 0.32 * Math.sin((index + 1) * 1.7) ** 2;
      const teams = round(clamp(result.teamsPerDivision * weight, 0, number(state.grid.maxTeams, 12)), 1);
      labels.push({
        id: index,
        label: `${formatNumber(low, 1)} · ${ageStart}+`,
        teams,
        runnable: teams >= number(state.grid.minTeams, 4)
      });
    }
    return labels;
  }

  function renderDivisionSpread(result) {
    const spread = divisionSpread(result);
    const max = Math.max(1, number(state.grid.maxTeams, 12));
    const runnable = spread.filter(item => item.runnable).length;
    elements.runnableDivisions.textContent = formatNumber(result.activeDivisions);
    elements.divisionSpread.innerHTML = spread.map(item => `
      <div class="division-bar ${item.runnable ? 'is-runnable' : 'needs-combination'}" title="${escapeHtml(item.label)} · ${formatNumber(item.teams, 1)} teams">
        <div><span style="height:${Math.max(3, Math.round(item.teams / max * 100))}%"></span></div>
        <strong>${formatNumber(item.teams, 1)}</strong>
        <em>${escapeHtml(item.label)}</em>
      </div>
    `).join('');
    elements.divisionSpread.setAttribute('aria-label', `${runnable} of ${spread.length} sampled divisions meet the minimum-team threshold`);
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
    elements.gridCapacity.textContent = formatNumber(gridMetrics().possibleDivisions);
    elements.driverNote.textContent = state.driver === 'players'
      ? `Runtime is calculated from ${formatNumber(state.players)} max-fill players.`
      : `${formatNumber(state.players)} players fit the ${formatNumber(state.targetHours)}-hour runtime target.`;
  }

  function render() {
    if (state.driver === 'hours') state.players = solvePlayersForHours(state.targetHours);
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
    const remove = event.target.closest('[data-remove-row]');
    if (remove) {
      state.calculationRows = state.calculationRows.filter(row => row.id !== remove.dataset.removeRow);
      render();
    }
  }

  function handleChange(event) {
    if (event.target.matches('[data-field]')) {
      const field = event.target.dataset.field;
      state[field] = Math.max(field === 'players' ? 20 : 1, number(event.target.value));
      state.driver = field === 'players' ? 'players' : 'hours';
      render();
      return;
    }
    if (event.target.matches('[data-grid]')) {
      const field = event.target.dataset.grid;
      state.grid[field] = number(event.target.value);
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
