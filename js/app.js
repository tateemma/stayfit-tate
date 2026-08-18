/* Main app: routing, rendering, session logic, timers. Vanilla JS, no build step. */

const $app = document.getElementById('app');
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function todayStr(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}
function h(strings, ...vals) { // tiny escape helper for template literals used as HTML
  return strings.reduce((acc, s, i) => acc + s + (vals[i] !== undefined ? vals[i] : ''), '');
}
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---------------- Router ----------------
const routes = {};
function route(pattern, fn) { routes[pattern] = fn; }
function navigate(hash) { window.location.hash = hash; }

async function render() {
  const hash = window.location.hash || '#/';
  const [, path, param] = hash.match(/^#\/(\w[\w-]*)?(?:\/(.+))?$/) || [null, '', ''];
  const key = path || '';
  const fn = routes[key] || routes['404'];
  await fn(param);
  highlightNav(key);
}
window.addEventListener('hashchange', render);

function highlightNav(key) {
  document.querySelectorAll('.navbtn').forEach(b => {
    b.classList.toggle('active', b.dataset.route === key || (key === '' && b.dataset.route === 'home'));
  });
}

// ---------------- Timer component ----------------
let _timerInterval = null;
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
function startTimer(totalSeconds, displayEl, onDone) {
  clearInterval(_timerInterval);
  let remaining = totalSeconds;
  const tick = () => {
    const m = Math.floor(remaining / 60), s = remaining % 60;
    displayEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
    if (remaining <= 0) {
      clearInterval(_timerInterval);
      beep();
      onDone && onDone();
      return;
    }
    remaining--;
  };
  tick();
  _timerInterval = setInterval(tick, 1000);
}
function stopTimer() { clearInterval(_timerInterval); }

// ---------------- Home / Today ----------------
route('', async () => {
  const today = todayStr();
  const dow = new Date().getDay();
  const schedule = await getSetting('schedule', DEFAULT_SCHEDULE);
  const scheduledId = schedule[dow];
  const existingSession = await getSessionByDate(today);
  const allSessions = await getAllSessions();
  const thisMonth = today.slice(0, 7);
  const monthCount = allSessions.filter(s => s.date.startsWith(thisMonth)).length;
  const totalCount = allSessions.length;

  const program = scheduledId ? getProgram(scheduledId) : null;

  const todayHabitLog = await getHabitLog(today);
  const todayHabits = (todayHabitLog && todayHabitLog.habits) || {};
  const { counts: weekCounts } = await getWeekHabitCounts(new Date());

  $app.innerHTML = h`
    <div class="header">
      <div class="hdate">${fmtDateLong(today)}</div>
      <div class="stats-row">
        <div class="stat"><div class="stat-num">${totalCount}</div><div class="stat-label">Total sessions</div></div>
        <div class="stat"><div class="stat-num">${monthCount}</div><div class="stat-label">This month</div></div>
      </div>
    </div>
    ${program ? h`
      <div class="card program-card">
        <div class="card-title">${existingSession ? '✅ Logged today' : "Today's Workout"}</div>
        <div class="program-name">${esc(program.title)}</div>
        <div class="program-focus">${esc(program.focus)}</div>
        <p class="note">${esc(program.note)}</p>
        <p class="fatburn">🔥 ${esc(program.fatBurn)}</p>
        ${existingSession
          ? h`<div class="kcal-pill">${existingSession.calories?.total || 0} kcal burned</div>
              <button class="btn btn-secondary" data-go="session/${program.id}">Edit today's log</button>`
          : h`<button class="btn btn-primary" data-go="session/${program.id}">Start Workout</button>`
        }
      </div>
    ` : h`
      <div class="card">
        <div class="card-title">Rest Day</div>
        <p class="note">No workout scheduled today. You can still log a workout manually below, or just track your habits.</p>
      </div>
    `}
    <div class="card">
      <div class="card-title">Or pick a different session</div>
      <div class="pill-row">
        ${PROGRAMS.map(p => h`<button class="pill" data-go="session/${p.id}">${esc(p.shortTitle)}</button>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Daily Habits</div>
      ${HABITS.map(hb => h`
        <label class="check-line">
          <input type="checkbox" class="daily-habit-check" data-habit="${hb.id}" ${todayHabits[hb.id] ? 'checked' : ''}/>
          <div class="ex-name">${esc(hb.label)}</div>
        </label>
      `).join('')}
      <div class="habit-week-summary">
        ${HABITS.map(hb => h`
          <div class="habit-week-row">
            <span class="habit-week-label">${esc(hb.label)}</span>
            <span class="habit-week-count ${weekCounts[hb.id] >= WEEKLY_HABIT_TARGET ? 'hit' : ''}">${weekCounts[hb.id]}/${WEEKLY_HABIT_TARGET} this week</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  $app.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => navigate('#/' + el.dataset.go)));
  $app.querySelectorAll('.daily-habit-check').forEach(cb => cb.addEventListener('change', async (e) => {
    const log = await getHabitLog(today);
    const habits = (log && log.habits) || {};
    habits[e.target.dataset.habit] = e.target.checked;
    await saveHabitLog(today, habits);
    render();
  }));
});

// ---------------- Session screen ----------------
route('session', async (programId) => {
  const program = getProgram(programId);
  if (!program) { navigate('#/'); return; }
  const today = todayStr();
  const existing = await getSessionByDate(today);
  const cardioDefaultsSavedRaw = await getSetting('cardioDefaults', CARDIO_DEFAULTS);
  const cardioDefaultsSaved = { ...CARDIO_DEFAULTS, ...cardioDefaultsSavedRaw };

  const existingCardio = (existing?.programId === programId && existing.cardio) ? existing.cardio : {};
  const cardioKeys = programId === 'lower-body' ? ['stairmaster', 'walk', 'elliptical'] : ['walk', 'elliptical'];
  const state = {
    programId,
    date: today,
    cardio: Object.fromEntries(cardioKeys.map(key =>
      [key, existingCardio[key] || { ...cardioDefaultsSaved[key], done: false }]
    )),
    doneExercises: new Set(existing?.programId === programId ? (existing.doneExercises || []) : []),
    exerciseWeights: existing?.programId === programId ? (existing.exerciseWeights || {}) : {}
  };

  function exerciseRow(ssIdx, exIdx, ex) {
    const key = `${ssIdx}:${exIdx}`;
    const checked = state.doneExercises.has(key);
    const weight = state.exerciseWeights[key] || '';
    return h`
      <div class="exercise-row ${checked ? 'done' : ''}" data-exkey="${key}">
        <label class="check-line">
          <input type="checkbox" class="ex-check" data-exkey="${key}" ${checked ? 'checked' : ''}/>
          <div>
            <div class="ex-name">${esc(ex.name)}</div>
            <div class="ex-meta">${esc(ex.target)} · ${esc(ex.equipment)}</div>
          </div>
        </label>
        <div class="ex-actions">
          <input type="number" step="0.5" class="weight-input" data-exkey="${key}" placeholder="kg used" value="${esc(weight)}"/>
          ${ex.workSeconds ? h`
            <button class="btn-timer" data-work-timer="${key}" data-work-seconds="${ex.workSeconds}">▶ ${ex.workSeconds}s</button>
            <span class="timer-display" id="work-timer-${key}"></span>
          ` : ''}
          <button class="btn-timer" data-rest="${ssIdx}">⏱ Rest</button>
        </div>
      </div>
    `;
  }

  function supersetBlock(ss, ssIdx) {
    return h`
      <div class="card superset-card">
        <div class="card-title">${esc(ss.name)} <span class="sets-badge">${ss.sets} sets</span></div>
        ${ss.exercises.map((ex, exIdx) => exerciseRow(ssIdx, exIdx, ex)).join('')}
        <div class="timer-display-row" data-rest-display="${ssIdx}" style="display:none">
          <span>Rest:</span><span class="timer-display" id="rest-timer-${ssIdx}">--:--</span>
        </div>
      </div>
    `;
  }

  function cardioBlock(key, cfg) {
    return h`
      <div class="card cardio-card">
        <div class="check-line">
          <input type="checkbox" class="cardio-check" data-cardio="${key}" ${cfg.done ? 'checked' : ''}/>
          <div class="card-title" style="margin:0">${esc(cfg.label)}</div>
        </div>
        <div class="cardio-fields">
          <label>Minutes <input type="number" class="cardio-field" data-cardio="${key}" data-field="minutes" value="${cfg.minutes}"/></label>
          <label>${cfg.unit === 'incline' ? 'Incline' : cfg.unit === 'level' ? 'Level' : 'Resistance'} <input type="number" class="cardio-field" data-cardio="${key}" data-field="intensity" value="${cfg.intensity}"/></label>
        </div>
        <p class="note cardio-note">Use the machine's own timer/console — just check off when done.</p>
      </div>
    `;
  }

  async function renderCalorieEstimate() {
    const est = await estimateSessionCalories(program, state.cardio, state.doneExercises);
    const el = document.getElementById('kcal-live');
    if (el) el.textContent = `${est.total} kcal (est.)`;
    return est;
  }

  $app.innerHTML = h`
    <div class="header">
      <button class="back-btn" id="back-btn">← Back</button>
      <div class="hdate">${esc(program.title)} · ${fmtDateLong(today)}</div>
    </div>
    <div class="card">
      <div class="card-title">Cardio</div>
      ${cardioKeys.map(key => cardioBlock(key, state.cardio[key])).join('')}
    </div>
    ${program.supersets.map(supersetBlock).join('')}
    <div class="card finish-card">
      <div id="kcal-live" class="kcal-pill">0 kcal (est.)</div>
      <button class="btn btn-primary" id="finish-btn">Finish & Save Session</button>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate('#/'));

  $app.querySelectorAll('.ex-check').forEach(cb => cb.addEventListener('change', (e) => {
    const key = e.target.dataset.exkey;
    if (e.target.checked) state.doneExercises.add(key); else state.doneExercises.delete(key);
    e.target.closest('.exercise-row').classList.toggle('done', e.target.checked);
    renderCalorieEstimate();
  }));
  $app.querySelectorAll('.weight-input').forEach(inp => inp.addEventListener('change', (e) => {
    state.exerciseWeights[e.target.dataset.exkey] = e.target.value;
  }));
  $app.querySelectorAll('.cardio-check').forEach(cb => cb.addEventListener('change', (e) => {
    state.cardio[e.target.dataset.cardio].done = e.target.checked;
    renderCalorieEstimate();
  }));
  $app.querySelectorAll('.cardio-field').forEach(inp => inp.addEventListener('change', (e) => {
    const key = e.target.dataset.cardio, field = e.target.dataset.field;
    state.cardio[key][field] = Number(e.target.value) || 0;
    renderCalorieEstimate();
  }));
  $app.querySelectorAll('[data-work-timer]').forEach(btn => btn.addEventListener('click', (e) => {
    const key = e.target.dataset.workTimer;
    const seconds = Number(e.target.dataset.workSeconds);
    const disp = document.getElementById(`work-timer-${key}`);
    startTimer(seconds, disp);
  }));
  $app.querySelectorAll('[data-rest]').forEach(btn => btn.addEventListener('click', (e) => {
    const ssIdx = e.target.dataset.rest;
    const ss = program.supersets[ssIdx];
    const row = $app.querySelector(`[data-rest-display="${ssIdx}"]`);
    row.style.display = 'flex';
    const disp = document.getElementById(`rest-timer-${ssIdx}`);
    startTimer(ss.restSeconds || 60, disp);
  }));

  document.getElementById('finish-btn').addEventListener('click', async () => {
    const est = await estimateSessionCalories(program, state.cardio, state.doneExercises);
    const session = {
      id: existing ? existing.id : undefined,
      date: today,
      programId,
      cardio: state.cardio,
      doneExercises: Array.from(state.doneExercises),
      exerciseWeights: state.exerciseWeights,
      calories: est,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveSession(session);
    navigate('#/');
  });

  renderCalorieEstimate();
});

// ---------------- Calendar ----------------
let _calCursor = new Date();
route('calendar', async () => {
  const sessions = await getAllSessions();
  const sessionsByDate = {};
  sessions.forEach(s => { sessionsByDate[s.date] = s; });

  const year = _calCursor.getFullYear(), month = _calCursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthKey = `${year}-${String(month+1).padStart(2,'0')}`;
  const monthCount = sessions.filter(s => s.date.startsWith(monthKey)).length;

  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const s = sessionsByDate[dateStr];
    const isToday = dateStr === todayStr();
    cells += h`
      <div class="cal-cell ${s ? 'has-session' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">
        <span class="cal-day-num">${d}</span>
        ${s ? '<span class="cal-check">✓</span>' : ''}
      </div>
    `;
  }

  $app.innerHTML = h`
    <div class="header">
      <div class="stats-row">
        <div class="stat"><div class="stat-num">${sessions.length}</div><div class="stat-label">All-time sessions</div></div>
        <div class="stat"><div class="stat-num">${monthCount}</div><div class="stat-label">${MONTH_NAMES[month]}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="cal-nav">
        <button id="cal-prev">‹</button>
        <div class="cal-month-title">${MONTH_NAMES[month]} ${year}</div>
        <button id="cal-next">›</button>
      </div>
      <div class="cal-grid cal-dow">${DAY_NAMES.map(d => `<div class="cal-dow-cell">${d}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>
    <div id="cal-detail"></div>
  `;
  document.getElementById('cal-prev').addEventListener('click', () => { _calCursor = new Date(year, month - 1, 1); render(); });
  document.getElementById('cal-next').addEventListener('click', () => { _calCursor = new Date(year, month + 1, 1); render(); });
  $app.querySelectorAll('.cal-cell.has-session').forEach(cell => cell.addEventListener('click', async () => {
    const s = sessionsByDate[cell.dataset.date];
    const program = getProgram(s.programId);
    const habitLog = await getHabitLog(s.date);
    const habits = (habitLog && habitLog.habits) || {};
    document.getElementById('cal-detail').innerHTML = h`
      <div class="card">
        <div class="card-title">${fmtDateLong(s.date)}</div>
        <div class="program-name">${esc(program?.title || s.programId)}</div>
        <div class="kcal-pill">${s.calories?.total || 0} kcal</div>
        <div class="habit-summary">
          ${HABITS.map(hb => h`<span class="chip ${habits[hb.id] ? 'yes' : 'no'}">${habits[hb.id] ? '✓' : '✕'} ${esc(hb.label)}</span>`).join('')}
        </div>
        <button class="btn btn-secondary" id="delete-session">Delete this log</button>
      </div>
    `;
    document.getElementById('delete-session').addEventListener('click', async () => {
      if (confirm('Delete this session log?')) {
        await DB.delete('sessions', s.id);
        render();
      }
    });
  }));
});

// ---------------- Progress (weight + photos) ----------------
function fmtMonYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getFullYear()).slice(2);
}

function drawWeightChart(canvas, logs) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth * 2;
  const hgt = canvas.height = 160 * 2;
  ctx.clearRect(0, 0, w, hgt);
  if (logs.length < 2) {
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#8A7A6A';
    ctx.fillText('Log at least 2 weigh-ins to see a trend', 10, hgt/2);
    return;
  }
  const weights = logs.map(l => l.weightKg);
  const min = Math.min(...weights) - 1, max = Math.max(...weights) + 1;
  const padX = 20 * 2, padTop = 20 * 2, padBottom = 40 * 2;
  const plotHeight = hgt - padTop - padBottom;
  const stepX = (w - padX*2) / (logs.length - 1);
  ctx.beginPath();
  ctx.strokeStyle = '#C1604B';
  ctx.lineWidth = 3;
  logs.forEach((l, i) => {
    const x = padX + i * stepX;
    const y = padTop + plotHeight - ((l.weightKg - min) / (max - min)) * plotHeight;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#C1604B';
  logs.forEach((l, i) => {
    const x = padX + i * stepX;
    const y = padTop + plotHeight - ((l.weightKg - min) / (max - min)) * plotHeight;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
  });
  // Date labels (MM-YY) for the first and last entries only, so you can see the time span at a glance.
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#8A7A6A';
  const firstLabel = fmtMonYear(logs[0].date);
  const lastLabel = fmtMonYear(logs[logs.length - 1].date);
  ctx.textAlign = 'left';
  ctx.fillText(firstLabel, padX, hgt - padBottom/2 + 8);
  ctx.textAlign = 'right';
  ctx.fillText(lastLabel, w - padX, hgt - padBottom/2 + 8);
}

function fileToDataUrlResized(file, maxWidth = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

route('progress', async () => {
  const logs = await getAllBodyLogs();
  const photos = await getAllPhotos();
  const latest = logs[logs.length - 1];

  // Group photos by date, newest date first, so uploads from the same day sit together.
  const groupsByDate = {};
  photos.forEach(p => { (groupsByDate[p.date] = groupsByDate[p.date] || []).push(p); });
  const photoGroups = Object.keys(groupsByDate)
    .sort((a, b) => a < b ? 1 : -1)
    .map(date => ({ date, photos: groupsByDate[date] }));

  $app.innerHTML = h`
    <div class="header"><div class="hdate">Progress</div></div>
    <div class="card">
      <div class="card-title">Body Weight ${latest ? `· latest ${latest.weightKg}kg` : ''}</div>
      <canvas id="weight-chart" style="width:100%;height:160px"></canvas>
      <div class="inline-form">
        <input type="number" step="0.1" id="weight-input" placeholder="Weight (kg)"/>
        <button class="btn btn-primary" id="add-weight">Log</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Body Photos</div>
      <div class="photo-upload-row">
        <input type="date" id="photo-date-input" value="${todayStr()}" max="${todayStr()}"/>
        <label class="btn btn-secondary file-btn">
          📷 Add Photo
          <input type="file" id="photo-input" accept="image/*" capture="environment" style="display:none"/>
        </label>
      </div>
      <div class="photo-gallery">
        ${photoGroups.map(g => h`
          <div class="photo-group">
            <div class="photo-group-date">${fmtDateLong(g.date)}</div>
            <div class="photo-strip">
              ${g.photos.map(p => h`
                <div class="photo-item" data-id="${p.id}">
                  <img src="${p.dataUrl}" />
                  <button class="photo-delete" data-id="${p.id}">✕</button>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('') || '<p class="note">No photos yet.</p>'}
      </div>
    </div>
  `;

  drawWeightChart(document.getElementById('weight-chart'), logs);

  document.getElementById('add-weight').addEventListener('click', async () => {
    const val = parseFloat(document.getElementById('weight-input').value);
    if (!val) return;
    await saveBodyLog({ date: todayStr(), weightKg: val });
    render();
  });

  document.getElementById('photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const chosenDate = document.getElementById('photo-date-input').value || todayStr();
    const dataUrl = await fileToDataUrlResized(file);
    await savePhoto({ date: chosenDate, dataUrl });
    render();
  });

  $app.querySelectorAll('.photo-delete').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Delete this photo?')) {
      await deletePhoto(btn.dataset.id);
      render();
    }
  }));
});

// ---------------- Settings ----------------
route('settings', async () => {
  const schedule = await getSetting('schedule', DEFAULT_SCHEDULE);
  const cardioDefaultsRaw = await getSetting('cardioDefaults', CARDIO_DEFAULTS);
  const cardioDefaults = { ...CARDIO_DEFAULTS, ...cardioDefaultsRaw };
  const clientId = await getSetting('googleClientId', '');
  const bodyWeight = await getSetting('defaultBodyWeight', DEFAULT_BODYWEIGHT_KG);

  $app.innerHTML = h`
    <div class="header"><div class="hdate">Settings</div></div>

    <div class="card">
      <div class="card-title">Weekly Schedule</div>
      ${DAY_NAMES.map((dn, idx) => h`
        <div class="schedule-row">
          <span>${dn}</span>
          <select data-day="${idx}">
            <option value="" ${!schedule[idx] ? 'selected' : ''}>Rest day</option>
            ${PROGRAMS.map(p => h`<option value="${p.id}" ${schedule[idx] === p.id ? 'selected' : ''}>${esc(p.shortTitle)}</option>`).join('')}
          </select>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <div class="card-title">Cardio Defaults</div>
      <p class="note">Stairmaster warm-up only runs on Lower Body day.</p>
      <div class="cardio-fields">
        <label>Stairmaster min <input type="number" id="def-stair-min" value="${cardioDefaults.stairmaster.minutes}"/></label>
        <label>Stairmaster level <input type="number" id="def-stair-inc" value="${cardioDefaults.stairmaster.intensity}"/></label>
      </div>
      <div class="cardio-fields">
        <label>Walk min <input type="number" id="def-walk-min" value="${cardioDefaults.walk.minutes}"/></label>
        <label>Walk incline <input type="number" id="def-walk-inc" value="${cardioDefaults.walk.intensity}"/></label>
      </div>
      <div class="cardio-fields">
        <label>Elliptical min <input type="number" id="def-ell-min" value="${cardioDefaults.elliptical.minutes}"/></label>
        <label>Elliptical resistance <input type="number" id="def-ell-inc" value="${cardioDefaults.elliptical.intensity}"/></label>
      </div>
      <button class="btn btn-secondary" id="save-cardio-defaults">Save Defaults</button>
    </div>

    <div class="card">
      <div class="card-title">Calorie Estimate</div>
      <label>Default body weight if none logged (kg)
        <input type="number" id="def-bodyweight" value="${bodyWeight}"/>
      </label>
      <button class="btn btn-secondary" id="save-bodyweight">Save</button>
    </div>

    <div class="card">
      <div class="card-title">Google Drive Backup</div>
      <p class="note">Paste your Google OAuth Client ID (see README for the one-time setup steps), then back up or restore your data. Backups are stored in a private folder in your Drive that only this app can see.</p>
      <input type="text" id="client-id" placeholder="xxxxx.apps.googleusercontent.com" value="${esc(clientId)}"/>
      <button class="btn btn-secondary" id="save-client-id">Save Client ID</button>
      <div class="drive-actions">
        <button class="btn btn-primary" id="backup-btn">⬆ Backup Now</button>
        <button class="btn btn-secondary" id="restore-btn">⬇ Restore</button>
      </div>
      <div id="drive-status" class="note"></div>
    </div>

    <div class="card">
      <div class="card-title">Local Backup (works offline)</div>
      <p class="note">Export a JSON file of all your data as a manual backup, or import one back in.</p>
      <div class="drive-actions">
        <button class="btn btn-secondary" id="export-btn">Export JSON</button>
        <label class="btn btn-secondary file-btn">Import JSON<input type="file" id="import-input" accept="application/json" style="display:none"/></label>
      </div>
    </div>
  `;

  $app.querySelectorAll('[data-day]').forEach(sel => sel.addEventListener('change', async (e) => {
    const s = await getSetting('schedule', DEFAULT_SCHEDULE);
    s[e.target.dataset.day] = e.target.value || null;
    await setSetting('schedule', s);
  }));

  document.getElementById('save-cardio-defaults').addEventListener('click', async () => {
    const cd = {
      stairmaster: { ...CARDIO_DEFAULTS.stairmaster, minutes: Number(document.getElementById('def-stair-min').value), intensity: Number(document.getElementById('def-stair-inc').value) },
      walk: { ...CARDIO_DEFAULTS.walk, minutes: Number(document.getElementById('def-walk-min').value), intensity: Number(document.getElementById('def-walk-inc').value) },
      elliptical: { ...CARDIO_DEFAULTS.elliptical, minutes: Number(document.getElementById('def-ell-min').value), intensity: Number(document.getElementById('def-ell-inc').value) }
    };
    await setSetting('cardioDefaults', cd);
    alert('Saved.');
  });

  document.getElementById('save-bodyweight').addEventListener('click', async () => {
    await setSetting('defaultBodyWeight', Number(document.getElementById('def-bodyweight').value) || DEFAULT_BODYWEIGHT_KG);
    alert('Saved.');
  });

  document.getElementById('save-client-id').addEventListener('click', async () => {
    await setSetting('googleClientId', document.getElementById('client-id').value.trim());
    alert('Saved.');
  });

  const statusEl = document.getElementById('drive-status');
  document.getElementById('backup-btn').addEventListener('click', async () => {
    const cid = document.getElementById('client-id').value.trim();
    if (!cid) return alert('Paste your Google Client ID first.');
    try {
      const res = await backupToDrive(cid, (msg) => statusEl.textContent = msg);
      statusEl.textContent = `✅ Backed up: ${res.sessions} sessions, ${res.bodyLogs} weigh-ins, ${res.photos} photos.`;
    } catch (e) {
      statusEl.textContent = '❌ ' + e.message;
    }
  });
  document.getElementById('restore-btn').addEventListener('click', async () => {
    const cid = document.getElementById('client-id').value.trim();
    if (!cid) return alert('Paste your Google Client ID first.');
    if (!confirm('This will overwrite local data with your Drive backup. Continue?')) return;
    try {
      const res = await restoreFromDrive(cid, (msg) => statusEl.textContent = msg);
      statusEl.textContent = `✅ Restored: ${res.sessions} sessions, ${res.bodyLogs} weigh-ins, ${res.photos} photos.`;
    } catch (e) {
      statusEl.textContent = '❌ ' + e.message;
    }
  });

  document.getElementById('export-btn').addEventListener('click', async () => {
    const payload = await buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gym-tracker-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('This will overwrite local data with the imported file. Continue?')) return;
    const text = await file.text();
    const payload = JSON.parse(text);
    await DB.clear('sessions'); await DB.clear('bodyLogs'); await DB.clear('photos'); await DB.clear('habitLogs');
    for (const s of payload.sessions || []) await DB.put('sessions', s);
    for (const b of payload.bodyLogs || []) await DB.put('bodyLogs', b);
    for (const p of payload.photos || []) await DB.put('photos', p);
    for (const hl of payload.habitLogs || []) await DB.put('habitLogs', hl);
    if (payload.schedule) await setSetting('schedule', payload.schedule);
    if (payload.cardioDefaults) await setSetting('cardioDefaults', payload.cardioDefaults);
    alert('Import complete.');
    navigate('#/');
  });
});

// ---------------- Programs browser ----------------
route('programs', async () => {
  $app.innerHTML = h`
    <div class="header"><div class="hdate">Programs</div></div>
    ${PROGRAMS.map(p => h`
      <div class="card">
        <div class="card-title">${esc(p.title)}</div>
        <div class="program-focus">${esc(p.focus)}</div>
        <p class="note">${esc(p.note)}</p>
        <p class="fatburn">🔥 ${esc(p.fatBurn)}</p>
        ${p.supersets.map(ss => h`
          <div class="mini-superset">
            <strong>${esc(ss.name)}</strong> (${ss.sets} sets)
            <ul>${ss.exercises.map(ex => `<li>${esc(ex.name)} — ${esc(ex.target)}</li>`).join('')}</ul>
          </div>
        `).join('')}
        <button class="btn btn-primary" data-go="session/${p.id}">Start this workout</button>
      </div>
    `).join('')}
  `;
  $app.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => navigate('#/' + el.dataset.go)));
});

routes['404'] = async () => { $app.innerHTML = '<div class="card">Not found.</div>'; };

// ---------------- Boot ----------------
window.addEventListener('DOMContentLoaded', () => {
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});
