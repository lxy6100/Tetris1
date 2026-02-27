(() => {
  'use strict';

  const STORAGE_KEY = 'tetris_vanilla_save_v1';
  const SCORE_KEY = 'tetris_vanilla_scores_v1';
  const THEME_KEY = 'tetris_theme';
  const PHASE = { PLAYING: 'PLAYING', PAUSED: 'PAUSED', CLEARING: 'CLEARING', GAMEOVER: 'GAMEOVER' };

  const DEFAULTS = {
    boardWidth: 10,
    boardHeight: 20,
    hiddenRows: 2,
    showGrid: true,
    showOutline: true,
    shadow: 40,
    theme: 'dark',
    colorBlind: false,
    gravityMs: 800,
    levelRule: 'lines',
    das: 130,
    arr: 25,
    softDropMultiplier: 18,
    lockDelay: 500,
    kickMode: 'srs',
    inputBufferMs: 80,
    maxLockResets: 12,
    scoringSystem: 'modern',
    enableGhost: true,
    enableHold: true,
    showBestMove: false,
    safeHardDrop: false,
    restartKeepSettings: true,
    difficulty: 'normal',
    volume: 0.35,
    mute: false,
    vfx: true,
    debug: false,
    debugSeed: 123456,
  };

  const PIECES = {
    I: { c: '#00e5ff', cells: [[[-1,0],[0,0],[1,0],[2,0]],[[1,-1],[1,0],[1,1],[1,2]],[[-1,1],[0,1],[1,1],[2,1]],[[0,-1],[0,0],[0,1],[0,2]]] },
    O: { c: '#ffe66d', cells: [[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]]] },
    T: { c: '#c77dff', cells: [[[-1,0],[0,0],[1,0],[0,1]],[[0,-1],[0,0],[1,0],[0,1]],[[-1,0],[0,0],[1,0],[0,-1]],[[0,-1],[-1,0],[0,0],[0,1]]] },
    S: { c: '#80ed99', cells: [[[0,0],[1,0],[-1,1],[0,1]],[[0,-1],[0,0],[1,0],[1,1]],[[0,0],[1,0],[-1,1],[0,1]],[[0,-1],[0,0],[1,0],[1,1]]] },
    Z: { c: '#ff6b6b', cells: [[[-1,0],[0,0],[0,1],[1,1]],[[1,-1],[0,0],[1,0],[0,1]],[[-1,0],[0,0],[0,1],[1,1]],[[1,-1],[0,0],[1,0],[0,1]]] },
    J: { c: '#4d96ff', cells: [[[-1,0],[0,0],[1,0],[-1,1]],[[0,-1],[0,0],[0,1],[1,1]],[[-1,0],[0,0],[1,0],[1,-1]],[[0,-1],[0,0],[0,1],[-1,-1]]] },
    L: { c: '#ff9f1c', cells: [[[-1,0],[0,0],[1,0],[1,1]],[[0,-1],[0,0],[0,1],[1,-1]],[[-1,0],[0,0],[1,0],[-1,-1]],[[0,-1],[0,0],[0,1],[-1,1]]] },
  };

  const KICKS = {
    simple: [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0]],
    srs: [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[0,-2]],
    off: [[0,0]],
  };

  const MODES = {
    classic: { name:'Classic' },
    sprint: { name:'Sprint 40' },
    survival: { name:'Survival' },
    challenge: { name:'Challenge' },
    zen: { name:'Zen' },
  };

  const DIFF_PRESET = {
    easy: { gravityMs: 1000, lockDelay: 650, das: 150, arr: 35 },
    normal: { gravityMs: 800, lockDelay: 500, das: 130, arr: 25 },
    hardcore: { gravityMs: 550, lockDelay: 250, das: 100, arr: 8 },
  };

  const $ = (id) => document.getElementById(id);
  const boardCanvas = $('board');
  const holdCanvas = $('holdCanvas');
  const nextCanvas = $('nextCanvas');
  const bctx = boardCanvas.getContext('2d');
  const hctx = holdCanvas.getContext('2d');
  const nctx = nextCanvas.getContext('2d');

  const ui = {
    score: $('score'), highScore: $('highScore'), level: $('level'), lines: $('lines'), combo: $('combo'), b2b: $('b2b'), timer: $('timer'),
    modeName: $('modeName'), modeBanner: $('modeBanner'), overlay: $('overlay'), debugPanel: $('debugPanel'), debugControls: $('debugControls'),
    modeSelect: $('modeSelect'), settingsModal: $('settingsModal'), settingsForm: $('settingsForm'), ioText: $('ioText'),
    themeToggleBtn: $('themeToggleBtn'), stepBtn: $('stepBtn'), runSelfTestsBtn: $('runSelfTestsBtn'),
  };

  const clamp = (v, min, max, d) => Number.isFinite(+v) ? Math.max(min, Math.min(max, +v)) : d;
  const deepCloneBoard = (board) => board.map((r) => r.slice());
  const emptyRow = (w) => Array(w).fill('');

  function createRng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sanitize(s) {
    s.boardWidth = clamp(s.boardWidth, 8, 16, DEFAULTS.boardWidth);
    s.boardHeight = clamp(s.boardHeight, 16, 30, DEFAULTS.boardHeight);
    s.hiddenRows = 2;
    s.shadow = clamp(s.shadow, 0, 100, DEFAULTS.shadow);
    s.gravityMs = clamp(s.gravityMs, 50, 2000, DEFAULTS.gravityMs);
    s.das = clamp(s.das, 20, 500, DEFAULTS.das);
    s.arr = clamp(s.arr, 0, 200, DEFAULTS.arr);
    s.softDropMultiplier = clamp(s.softDropMultiplier, 1, 40, DEFAULTS.softDropMultiplier);
    s.lockDelay = clamp(s.lockDelay, 50, 1500, DEFAULTS.lockDelay);
    s.inputBufferMs = clamp(s.inputBufferMs, 0, 300, DEFAULTS.inputBufferMs);
    s.maxLockResets = clamp(s.maxLockResets, 0, 20, DEFAULTS.maxLockResets);
    s.volume = clamp(s.volume, 0, 1, DEFAULTS.volume);
    s.debugSeed = clamp(s.debugSeed, 1, 2147483647, DEFAULTS.debugSeed) | 0;
    ['showGrid','showOutline','colorBlind','enableGhost','enableHold','showBestMove','safeHardDrop','restartKeepSettings','mute','vfx','debug'].forEach((k) => (s[k] = !!s[k]));
    ['theme','levelRule','kickMode','scoringSystem','difficulty'].forEach((k) => (s[k] = s[k] || DEFAULTS[k]));
    return s;
  }

  function loadSettings() {
    try { return sanitize({ ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }); }
    catch { return { ...DEFAULTS }; }
  }
  function saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
  function loadScores() { try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || {}; } catch { return {}; } }
  function saveScores(scores) { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); }

  function highScoreKey(mode) { return `tetris_highScore_${mode}`; }
  function loadHighScore(mode) { return Math.max(0, Number(localStorage.getItem(highScoreKey(mode)) || 0)); }
  function setHighScore(mode, value) { localStorage.setItem(highScoreKey(mode), String(Math.max(0, value | 0))); }

  function getThemePreference() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  let settings = loadSettings();
  let state = null;
  let keyState = { left: false, right: false, down: false };
  let keyTimers = { left: 0, right: 0, down: 0 };
  let lastTime = performance.now();
  let pendingInput = [];

  function freshState(mode='classic') {
    const w = settings.boardWidth;
    const h = settings.boardHeight;
    const hr = settings.hiddenRows;
    boardCanvas.width = w * 30;
    boardCanvas.height = h * 30;
    return {
      board: Array.from({ length: h + hr }, () => emptyRow(w)),
      mode,
      phase: PHASE.PLAYING,
      bag: [],
      next: [],
      hold: null,
      canHold: true,
      piece: null,
      x: 4,
      y: 1,
      r: 0,
      score: 0,
      highScore: loadHighScore(mode),
      level: 1,
      lines: 0,
      combo: -1,
      b2b: 0,
      dropAcc: 0,
      lockAcc: 0,
      lockResets: 0,
      lastRotate: false,
      elapsedMs: 0,
      garbageAcc: 0,
      challengeGoal: { needed: 2, remainingMs: 30000 },
      stats: { tetris: 0, tspin: 0, maxCombo: 0, pieces: 0, apm: 0 },
      hardDropArmed: !settings.safeHardDrop,
      clearAnim: null,
      // 根因注释：旧实现漏清主要属于 A/D/E：动画与删行阶段可能被其他流程干扰。
      // 这里 clearAnim 只保存一次锁定后检测到的 rows 快照，并仅允许 finalize 一次。
      lastFullRows: [],
      rngSeed: settings.debugSeed,
      rng: createRng(settings.debugSeed),
      replay: {
        recording: true,
        startMs: performance.now(),
        events: [],
        playback: null,
      },
    };
  }

  function nowReplay() { return performance.now() - state.replay.startMs; }
  function recordEvent(action) {
    if (!state.replay.recording || state.replay.playback) return;
    state.replay.events.push({ t: Math.floor(nowReplay()), a: action });
  }

  function refillBag() {
    if (state.bag.length) return;
    const arr = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (state.rng() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    state.bag.push(...arr);
  }

  function ensureNext() {
    while (state.next.length < 6) {
      refillBag();
      state.next.push(state.bag.shift());
    }
  }

  function getCells(type=state.piece, r=state.r) { return PIECES[type].cells[((r % 4) + 4) % 4]; }

  function collision(x, y, r, type=state.piece) {
    return getCells(type, r).some(([dx, dy]) => {
      const cx = x + dx;
      const cy = y + dy;
      if (cx < 0 || cx >= settings.boardWidth || cy >= settings.boardHeight + settings.hiddenRows) return true;
      if (cy < 0) return false;
      return !!state.board[cy][cx];
    });
  }

  function spawn() {
    ensureNext();
    state.piece = state.next.shift();
    ensureNext();
    state.r = 0;
    state.x = (settings.boardWidth / 2) | 0;
    state.y = 1;
    state.canHold = true;
    state.lockAcc = 0;
    state.lockResets = 0;
    state.lastRotate = false;
    state.stats.pieces++;
    if (collision(state.x, state.y, state.r)) gameOver();
  }

  function move(dx, dy) {
    if (collision(state.x + dx, state.y + dy, state.r)) return false;
    state.x += dx;
    state.y += dy;
    if (dy !== 0) state.lastRotate = false;
    return true;
  }

  function rotate(dir) {
    const nr = state.r + dir;
    for (const [kx, ky] of KICKS[settings.kickMode]) {
      if (!collision(state.x + kx, state.y + ky, nr)) {
        state.r = nr;
        state.x += kx;
        state.y += ky;
        state.lastRotate = true;
        if (state.lockAcc > 0 && state.lockResets < settings.maxLockResets) {
          state.lockAcc = 0;
          state.lockResets++;
        }
        sfx('rotate', 400);
        return true;
      }
    }
    return false;
  }

  function hold() {
    if (!settings.enableHold || !state.canHold || state.phase !== PHASE.PLAYING) return;
    if (!state.hold) {
      state.hold = state.piece;
      spawn();
    } else {
      const t = state.hold;
      state.hold = state.piece;
      state.piece = t;
      state.x = (settings.boardWidth / 2) | 0;
      state.y = 1;
      state.r = 0;
      if (collision(state.x, state.y, state.r)) gameOver();
    }
    state.canHold = false;
  }

  function detectTSpin(type) {
    if (type !== 'T' || !state.lastRotate) return false;
    const corners = [[-1,-1],[1,-1],[-1,1],[1,1]];
    let occ = 0;
    for (const [dx,dy] of corners) {
      const x = state.x + dx, y = state.y + dy;
      if (x < 0 || x >= settings.boardWidth || y >= settings.boardHeight + settings.hiddenRows || y < 0 || state.board[y][x]) occ++;
    }
    return occ >= 3;
  }

  // 纯函数A：检测所有满行（根因B防护：仅依赖 board[y][x]）
  function findFullRows(board, hiddenRows=0) {
    const rows = [];
    for (let y = hiddenRows; y < board.length; y++) {
      if (board[y].every(Boolean)) rows.push(y);
    }
    return rows;
  }

  // 纯函数B：一次性应用删行（根因A/C防护：过滤重建 + 独立空行）
  function applyLineClear(board, rows, width) {
    const rowsSet = new Set(rows);
    const boardHeight = board.length;
    const kept = board
      .map((row) => row.slice())
      .filter((_, y) => !rowsSet.has(y));
    while (kept.length < boardHeight) kept.unshift(emptyRow(width));
    return kept;
  }

  function lockPiece() {
    if (state.phase !== PHASE.PLAYING) return;
    const type = state.piece;
    getCells().forEach(([dx, dy]) => {
      const cx = state.x + dx;
      const cy = state.y + dy;
      if (cy >= 0) state.board[cy][cx] = type;
    });

    const tSpin = detectTSpin(type);
    const rows = findFullRows(state.board, settings.hiddenRows);
    state.lastFullRows = rows.slice();

    if (rows.length === 0) {
      state.combo = -1;
      spawn();
      return;
    }

    // 根因D/E防护：CLEARING 期间冻结 board 改动，且 clearAnim.done 保障只结算一次。
    state.phase = PHASE.CLEARING;
    state.clearAnim = {
      rows: Object.freeze(rows.slice()),
      startedAt: performance.now(),
      duration: 180,
      tSpin,
      done: false,
    };
    if (settings.vfx && navigator.vibrate) navigator.vibrate(30);
  }

  function finalizeClearOnce() {
    if (!state.clearAnim || state.clearAnim.done) return;
    state.clearAnim.done = true;

    const rows = state.clearAnim.rows;
    state.board = applyLineClear(state.board, rows, settings.boardWidth);
    const cleared = rows.length;

    state.lines += cleared;
    state.combo++;
    state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
    if (cleared === 4) state.stats.tetris++;

    award(cleared, state.clearAnim.tSpin);
    state.clearAnim = null;
    state.phase = PHASE.PLAYING;
    spawn();
    lastTime = performance.now();
  }

  function award(lines, tSpin) {
    const L = state.level;
    const baseClassic = [0, 100, 300, 500, 800];
    const baseModern = tSpin ? [0, 800, 1200, 1600, 0] : [0, 100, 300, 500, 800];
    let add = (settings.scoringSystem === 'classic' ? baseClassic[lines] : baseModern[lines]) * L;
    if (state.combo > 0) add += state.combo * 50 * L;
    if ((lines === 4 || tSpin) && state.b2b > 0) add = Math.floor(add * 1.5);
    if (lines === 4 || tSpin) state.b2b++; else if (lines) state.b2b = 0;
    if (tSpin) state.stats.tspin++;
    if (lines && perfectClear()) add += 2000 * L;
    state.score += add;
    syncHighScore();
    updateLevel();
    sfx('clear', 700);
  }

  function perfectClear() {
    return state.board.slice(settings.hiddenRows).every((row) => row.every((c) => !c));
  }

  function updateLevel() {
    if (state.mode === 'zen') return (state.level = 1);
    if (settings.levelRule === 'lines') state.level = 1 + Math.floor(state.lines / 10);
    else if (settings.levelRule === 'time') state.level = 1 + Math.floor(state.elapsedMs / 60000);
    else state.level = 1 + Math.floor(state.score / 5000);
  }

  function gravityMs() {
    if (state.mode === 'zen') return 1200;
    const v = Math.max(50, settings.gravityMs - (state.level - 1) * 45);
    return state.mode === 'survival' ? Math.max(35, v * 0.7) : v;
  }

  function addGarbageRow() {
    const hole = (state.rng() * settings.boardWidth) | 0;
    state.board.shift();
    const row = Array(settings.boardWidth).fill('G');
    row[hole] = '';
    state.board.push(row);
  }

  function processMode(dt) {
    if (state.mode === 'sprint' && state.lines >= 40) return finish('Sprint 完成！');
    if (state.mode === 'survival') {
      state.garbageAcc += dt;
      if (state.garbageAcc > 12000) {
        state.garbageAcc = 0;
        addGarbageRow();
      }
      return;
    }
    if (state.mode === 'challenge') {
      state.challengeGoal.remainingMs -= dt;
      if (state.challengeGoal.remainingMs <= 0) {
        if (state.combo + 1 < state.challengeGoal.needed) addGarbageRow();
        state.challengeGoal.remainingMs = 30000;
        state.challengeGoal.needed = 1 + ((state.rng() * 4) | 0);
      }
      ui.modeBanner.textContent = `挑战：30秒内达成连击 ${state.challengeGoal.needed}`;
    }
  }

  function syncHighScore() {
    if (state.score > state.highScore) {
      state.highScore = state.score;
      setHighScore(state.mode, state.highScore);
    }
  }

  function clearCurrentModeHighScore() {
    setHighScore(state.mode, 0);
    state.highScore = 0;
  }

  function finish(text) {
    state.phase = PHASE.GAMEOVER;
    ui.overlay.textContent = text;
    ui.overlay.classList.remove('hidden');
    saveRecord();
  }

  function gameOver() {
    sfx('lose', 160);
    finish('GAME OVER');
  }

  function saveRecord() {
    const scores = loadScores();
    const rec = scores[state.mode] || {};
    rec.bestScore = Math.max(rec.bestScore || 0, state.score);
    if (state.mode === 'sprint' && (!rec.bestTime || state.elapsedMs < rec.bestTime)) rec.bestTime = state.elapsedMs;
    rec.lastStats = { lines: state.lines, tetris: state.stats.tetris, tspin: state.stats.tspin, maxCombo: state.stats.maxCombo, elapsedMs: state.elapsedMs };
    scores[state.mode] = rec;
    saveScores(scores);
  }

  function hardDrop() {
    if (state.phase !== PHASE.PLAYING) return;
    let dist = 0;
    while (move(0, 1)) dist++;
    state.score += dist * 2;
    syncHighScore();
    lockPiece();
    sfx('hard', 120);
  }

  function ghostY() {
    let gy = state.y;
    while (!collision(state.x, gy + 1, state.r)) gy++;
    return gy;
  }

  function heuristic(x, y, r, piece) {
    const b = deepCloneBoard(state.board);
    getCells(piece, r).forEach(([dx, dy]) => {
      const cx = x + dx, cy = y + dy;
      if (cy >= 0 && cy < b.length && cx >= 0 && cx < settings.boardWidth) b[cy][cx] = piece;
    });
    let holes = 0, agg = 0, bump = 0, prev = -1, lines = 0;
    for (let col = 0; col < settings.boardWidth; col++) {
      let seen = false, h = 0;
      for (let row = 0; row < b.length; row++) {
        if (b[row][col]) { if (!seen) h = b.length - row; seen = true; }
        else if (seen) holes++;
      }
      agg += h;
      if (prev >= 0) bump += Math.abs(h - prev);
      prev = h;
    }
    b.forEach((row) => { if (row.every(Boolean)) lines++; });
    return lines * 3 - agg * 0.4 - holes * 1.1 - bump * 0.25;
  }

  function bestSuggestion() {
    let best = null;
    for (let r = 0; r < 4; r++) {
      for (let x = -2; x < settings.boardWidth + 2; x++) {
        let y = -1;
        while (!collision(x, y + 1, r, state.piece)) y++;
        if (collision(x, y, r, state.piece)) continue;
        const score = heuristic(x, y, r, state.piece);
        if (!best || score > best.score) best = { x, y, r, score };
      }
    }
    return best;
  }

  function drawCell(ctx, x, y, color, size, id='') {
    ctx.fillStyle = color === 'G' ? '#666' : color;
    ctx.shadowColor = color;
    ctx.shadowBlur = settings.shadow / 10;
    ctx.fillRect(x, y, size, size);
    if (settings.showOutline) {
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    }
    if (settings.colorBlind && id) {
      ctx.fillStyle = 'rgba(255,255,255,.65)';
      ctx.font = `${Math.max(8, size / 2)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(id[0], x + size / 2, y + size / 2);
    }
  }

  function drawMini(ctx, type, ox, oy, size=22) {
    if (!type) return;
    getCells(type, 0).forEach(([dx, dy]) => {
      drawCell(ctx, ox + (dx + 1.5) * size, oy + (dy + 1.5) * size, PIECES[type].c, size - 1, type);
    });
  }

  function render(dt) {
    const cell = boardCanvas.width / settings.boardWidth;
    bctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    bctx.fillStyle = '#000';
    bctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    if (settings.showGrid) {
      bctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid');
      for (let x = 0; x <= settings.boardWidth; x++) { bctx.beginPath(); bctx.moveTo(x * cell, 0); bctx.lineTo(x * cell, boardCanvas.height); bctx.stroke(); }
      for (let y = 0; y <= settings.boardHeight; y++) { bctx.beginPath(); bctx.moveTo(0, y * cell); bctx.lineTo(boardCanvas.width, y * cell); bctx.stroke(); }
    }

    const clearRows = state.clearAnim ? new Set(state.clearAnim.rows) : null;
    const clearProgress = state.clearAnim ? Math.min(1, (performance.now() - state.clearAnim.startedAt) / state.clearAnim.duration) : 0;

    for (let y = settings.hiddenRows; y < state.board.length; y++) {
      for (let x = 0; x < settings.boardWidth; x++) {
        const id = state.board[y][x];
        if (!id) continue;
        if (clearRows && clearRows.has(y)) {
          bctx.save();
          bctx.globalAlpha = 1 - clearProgress;
          bctx.filter = `brightness(${1 + (1 - clearProgress) * 1.1})`;
          drawCell(bctx, x * cell, (y - settings.hiddenRows) * cell, id === 'G' ? '#aaa' : PIECES[id].c, cell - 1, id);
          bctx.restore();
        } else {
          drawCell(bctx, x * cell, (y - settings.hiddenRows) * cell, id === 'G' ? '#666' : PIECES[id].c, cell - 1, id);
        }
      }
    }

    if (state.phase !== PHASE.GAMEOVER && state.piece) {
      if (settings.enableGhost && state.phase === PHASE.PLAYING) {
        const gy = ghostY();
        getCells().forEach(([dx, dy]) => drawCell(bctx, (state.x + dx) * cell, (gy + dy - settings.hiddenRows) * cell, '#ffffff33', cell - 1));
      }
      if (settings.showBestMove && state.phase === PHASE.PLAYING) {
        const best = bestSuggestion();
        if (best) getCells(state.piece, best.r).forEach(([dx, dy]) => drawCell(bctx, (best.x + dx) * cell, (best.y + dy - settings.hiddenRows) * cell, '#00ff8850', cell - 1));
      }
      getCells().forEach(([dx, dy]) => drawCell(bctx, (state.x + dx) * cell, (state.y + dy - settings.hiddenRows) * cell, PIECES[state.piece].c, cell - 1, state.piece));
    }

    hctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    drawMini(hctx, state.hold, 12, 10);
    state.next.slice(0, 5).forEach((p, i) => drawMini(nctx, p, 12, i * 58 + 8));

    ui.score.textContent = state.score;
    ui.highScore.textContent = state.highScore;
    ui.level.textContent = state.level;
    ui.lines.textContent = state.lines;
    ui.combo.textContent = Math.max(0, state.combo);
    ui.b2b.textContent = state.b2b;
    ui.timer.textContent = formatTime(state.elapsedMs);

    if (settings.debug) {
      ui.debugPanel.classList.remove('hidden');
      ui.debugControls.classList.remove('hidden');
      ui.debugPanel.innerHTML = [
        `FPS: ${(1000 / Math.max(16, dt)).toFixed(1)}`,
        `Phase: ${state.phase}`,
        `Board: ${settings.boardWidth}x${settings.boardHeight} (+${settings.hiddenRows} hidden)`,
        `Piece: ${state.piece} @ (${state.x},${state.y}) r=${state.r}`,
        `dropAcc=${state.dropAcc.toFixed(1)}ms lockAcc=${state.lockAcc.toFixed(1)}ms`,
        `CLEARING: ${state.phase === PHASE.CLEARING}`,
        `fullRows: [${state.lastFullRows.join(', ')}]`,
        `seed=${state.rngSeed} replayEvents=${state.replay.events.length}`,
      ].join('<br/>');
    } else {
      ui.debugPanel.classList.add('hidden');
      ui.debugControls.classList.add('hidden');
    }
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function enqueueAction(a, replayed=false) {
    pendingInput.push({ a, t: performance.now(), replayed });
    if (!replayed) recordEvent(a);
  }

  function applyReplayControl(action) {
    if (action === 'leftDown') keyState.left = true;
    else if (action === 'leftUp') keyState.left = false;
    else if (action === 'rightDown') keyState.right = true;
    else if (action === 'rightUp') keyState.right = false;
    else if (action === 'downDown') keyState.down = true;
    else if (action === 'downUp') keyState.down = false;
  }

  function feedReplayEvents() {
    const p = state.replay.playback;
    if (!p || state.phase === PHASE.GAMEOVER) return;
    const now = Math.floor(nowReplay());
    while (p.idx < p.events.length && p.events[p.idx].t <= now) {
      const evt = p.events[p.idx++];
      if (evt.a.endsWith('Down') || evt.a.endsWith('Up')) applyReplayControl(evt.a);
      else pendingInput.push({ a: evt.a, t: performance.now(), replayed: true });
    }
  }

  function processInput(dt) {
    if (state.phase !== PHASE.PLAYING) return;

    for (const [k, dx] of [['left', -1], ['right', 1]]) {
      if (!keyState[k]) { keyTimers[k] = 0; continue; }
      keyTimers[k] += dt;
      if (keyTimers[k] === dt) {
        move(dx, 0);
        sfx('move', 240);
      } else if (keyTimers[k] > settings.das) {
        if (settings.arr === 0) {
          while (move(dx, 0));
        } else if ((keyTimers[k] - settings.das) >= settings.arr) {
          move(dx, 0);
          keyTimers[k] = settings.das;
        }
      }
    }

    if (keyState.down) {
      keyTimers.down += dt;
      if (keyTimers.down > Math.max(16, gravityMs() / settings.softDropMultiplier)) {
        if (move(0, 1)) {
          state.score += 1;
          syncHighScore();
        }
        keyTimers.down = 0;
      }
    } else {
      keyTimers.down = 0;
    }

    const now = performance.now();
    pendingInput = pendingInput.filter((it) => now - it.t <= settings.inputBufferMs + 400);

    while (pendingInput.length) {
      const action = pendingInput.shift().a;
      if (action === 'cw') rotate(1);
      else if (action === 'ccw') rotate(-1);
      else if (action === 'hold') hold();
      else if (action === 'hard') {
        if (!settings.safeHardDrop || state.hardDropArmed) hardDrop();
        else state.hardDropArmed = true;
      }
    }
  }

  function simulateFrame(dt) {
    feedReplayEvents();

    if (state.phase === PHASE.PAUSED || state.phase === PHASE.GAMEOVER) return;

    if (state.phase === PHASE.CLEARING) {
      if (state.clearAnim && performance.now() - state.clearAnim.startedAt >= state.clearAnim.duration) {
        finalizeClearOnce();
      }
      return;
    }

    state.elapsedMs += dt;
    processInput(dt);
    processMode(dt);
    state.dropAcc += dt;

    if (state.dropAcc >= gravityMs()) {
      state.dropAcc = 0;
      if (!move(0, 1)) {
        state.lockAcc += gravityMs();
        if (state.lockAcc >= settings.lockDelay) lockPiece();
      } else {
        state.lockAcc = 0;
      }
    }

    state.stats.apm = ((state.lines / Math.max(1, state.elapsedMs / 60000)) * 10).toFixed(1);
  }

  function tick(ts) {
    const dt = Math.min(50, ts - lastTime);
    lastTime = ts;
    simulateFrame(dt);
    render(dt);
    requestAnimationFrame(tick);
  }

  function togglePause() {
    if (state.phase === PHASE.GAMEOVER || state.phase === PHASE.CLEARING) return;
    if (state.phase === PHASE.PAUSED) {
      state.phase = PHASE.PLAYING;
      ui.overlay.classList.add('hidden');
      lastTime = performance.now();
    } else {
      state.phase = PHASE.PAUSED;
      ui.overlay.textContent = 'PAUSED';
      ui.overlay.classList.remove('hidden');
    }
  }

  function stepFrame() {
    if (state.phase !== PHASE.PAUSED) return;
    const prev = state.phase;
    state.phase = PHASE.PLAYING;
    simulateFrame(16);
    state.phase = prev;
    render(16);
  }

  function restart(replayData=null) {
    const mode = ui.modeSelect.value;
    state = freshState(mode);
    keyState = { left: false, right: false, down: false };
    keyTimers = { left: 0, right: 0, down: 0 };
    pendingInput = [];
    ui.modeName.textContent = MODES[mode].name;
    ui.modeBanner.textContent = `模式：${MODES[mode].name}`;
    ui.overlay.classList.add('hidden');

    if (replayData) {
      state.rngSeed = replayData.seed;
      state.rng = createRng(replayData.seed);
      state.replay.recording = false;
      state.replay.playback = { idx: 0, events: replayData.events || [] };
    }

    spawn();
    lastTime = performance.now();
  }

  function toggleSettings() {
    if (ui.settingsModal.open) ui.settingsModal.close();
    else {
      fillForm();
      ui.settingsModal.showModal();
    }
  }

  function boardToText(board) {
    return board.map((row) => row.map((c) => (c ? (c[0] || '#') : '.')).join('')).join('\n');
  }

  function runLineClearSelfTests() {
    const W = 10;
    const H = 22;
    const HR = 2;
    const mk = () => Array.from({ length: H }, () => emptyRow(W));
    const fill = (b, y, ch='X') => { b[y] = Array(W).fill(ch); };
    const blockCount = (b) => b.flat().filter(Boolean).length;

    const tests = [];

    {
      const b = mk(); fill(b, 20); fill(b, 21);
      tests.push({ name: 'adjacent-2', board: b, expect: 2, hiddenRows: HR });
    }
    {
      const b = mk(); fill(b, 19); fill(b, 20); fill(b, 21);
      tests.push({ name: 'adjacent-3', board: b, expect: 3, hiddenRows: HR });
    }
    {
      const b = mk(); fill(b, 18); fill(b, 19); fill(b, 20); fill(b, 21);
      tests.push({ name: 'adjacent-4', board: b, expect: 4, hiddenRows: HR });
    }
    {
      const b = mk(); fill(b, 19); fill(b, 21);
      tests.push({ name: 'non-adjacent-2', board: b, expect: 2, hiddenRows: HR });
    }
    {
      const b = mk(); fill(b, 0, 'H'); fill(b, 1, 'H');
      tests.push({ name: 'hidden-ignore', board: b, expect: 0, hiddenRows: HR });
    }

    let pass = 0;

    for (const t of tests) {
      const before = deepCloneBoard(t.board);
      const beforeBlocks = blockCount(before);
      const rows = findFullRows(before, t.hiddenRows);
      const after = applyLineClear(before, rows, W);
      const afterBlocks = blockCount(after);
      const reScan = findFullRows(after, t.hiddenRows);

      const ok1 = rows.length === t.expect;
      const ok2 = after.length === H;
      const ok3 = reScan.length === 0;
      const ok4 = beforeBlocks - afterBlocks === t.expect * W;

      if (ok1 && ok2 && ok3 && ok4) {
        pass++;
      } else {
        console.error('[LineClearSelfTestFail]', t.name, {
          expected: t.expect,
          rows,
          reScan,
          beforeBlocks,
          afterBlocks,
          before: boardToText(before),
          after: boardToText(after),
        });
      }
    }

    const ok = pass === tests.length;
    const msg = `[LineClearSelfTests] ${pass}/${tests.length} passed`;
    if (ok) console.log(msg);
    else console.error(msg);
    return ok;
  }

  function installDebugApi() {
    window.__dumpBoard = () => {
      const text = boardToText(state.board);
      console.log(text);
      return text;
    };
    window.__setBoard = (matrix) => {
      const h = settings.boardHeight + settings.hiddenRows;
      const w = settings.boardWidth;
      if (!Array.isArray(matrix) || matrix.length !== h || matrix.some((r) => !Array.isArray(r) || r.length !== w)) {
        throw new Error(`matrix must be ${h}x${w}`);
      }
      state.board = matrix.map((r) => r.map((c) => c || ''));
      state.lastFullRows = findFullRows(state.board, settings.hiddenRows);
    };
    window.runLineClearSelfTests = runLineClearSelfTests;
  }

  function sfx(type, freq=440) {
    if (settings.mute || settings.volume <= 0) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ac = sfx.ac || (sfx.ac = new Ctx());
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type === 'clear' ? 'triangle' : 'square';
      o.frequency.value = freq;
      g.gain.value = settings.volume * 0.12;
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.045);
    } catch {}
  }

  function fillForm() {
    const f = ui.settingsForm;
    Object.keys(DEFAULTS).forEach((k) => {
      if (!(k in f.elements)) return;
      const el = f.elements[k];
      if (el.type === 'checkbox') el.checked = !!settings[k];
      else el.value = settings[k];
    });
  }

  function readForm() {
    const f = ui.settingsForm;
    const out = { ...settings };
    Object.keys(DEFAULTS).forEach((k) => {
      if (!(k in f.elements)) return;
      const el = f.elements[k];
      out[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return sanitize(out);
  }

  function bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') return toggleSettings();
      if (e.key === 'p' || e.key === 'P') return togglePause();
      if (ui.settingsModal.open) return;

      if (e.key === 'r' || e.key === 'R') return restart();
      if (state.phase !== PHASE.PLAYING) return;
      if (e.repeat && ['z','x',' ','arrowup','c'].includes(e.key.toLowerCase())) return;

      switch (e.key) {
        case 'ArrowLeft': keyState.left = true; recordEvent('leftDown'); break;
        case 'ArrowRight': keyState.right = true; recordEvent('rightDown'); break;
        case 'ArrowDown': keyState.down = true; recordEvent('downDown'); break;
        case 'ArrowUp': case 'x': case 'X': enqueueAction('cw'); break;
        case 'z': case 'Z': enqueueAction('ccw'); break;
        case ' ': enqueueAction('hard'); break;
        case 'c': case 'C': enqueueAction('hold'); break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') { keyState.left = false; recordEvent('leftUp'); }
      if (e.key === 'ArrowRight') { keyState.right = false; recordEvent('rightUp'); }
      if (e.key === 'ArrowDown') { keyState.down = false; recordEvent('downUp'); }
    });

    document.querySelectorAll('.mobile-controls button').forEach((btn) => {
      const act = btn.dataset.act;
      const down = () => {
        if (act === 'pause') return togglePause();
        if (state.phase !== PHASE.PLAYING) return;
        if (act === 'left') { keyState.left = true; recordEvent('leftDown'); }
        else if (act === 'right') { keyState.right = true; recordEvent('rightDown'); }
        else if (act === 'soft') { keyState.down = true; recordEvent('downDown'); }
        else if (act === 'hard') enqueueAction('hard');
        else if (act === 'cw' || act === 'ccw' || act === 'hold') enqueueAction(act);
      };
      const up = () => {
        if (act === 'left') { keyState.left = false; recordEvent('leftUp'); }
        else if (act === 'right') { keyState.right = false; recordEvent('rightUp'); }
        else if (act === 'soft') { keyState.down = false; recordEvent('downUp'); }
      };
      btn.addEventListener('touchstart', (e2) => { e2.preventDefault(); down(); }, { passive: false });
      btn.addEventListener('touchend', up);
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    });
  }

  function bindUI() {
    $('startBtn').onclick = () => restart();
    $('pauseBtn').onclick = togglePause;
    $('settingsBtn').onclick = toggleSettings;
    $('closeSettings').onclick = () => ui.settingsModal.close();
    ui.themeToggleBtn.onclick = toggleTheme;
    ui.stepBtn.onclick = stepFrame;
    ui.runSelfTestsBtn.onclick = runLineClearSelfTests;

    $('presetStandard').onclick = () => {
      settings.boardWidth = 10;
      settings.boardHeight = 20;
      settings.hiddenRows = 2;
      fillForm();
    };

    $('exportBtn').onclick = () => {
      ui.ioText.value = JSON.stringify({ settings, scores: loadScores() }, null, 2);
    };

    $('importBtn').onclick = () => {
      try {
        const data = JSON.parse(ui.ioText.value || '{}');
        if (data.settings) settings = sanitize({ ...DEFAULTS, ...data.settings });
        if (data.scores) saveScores(data.scores);
        saveSettings();
        applyTheme();
        restart();
      } catch {
        alert('JSON 无效');
      }
    };

    $('exportReplayBtn').onclick = () => {
      const payload = { seed: state.rngSeed, mode: state.mode, events: state.replay.events };
      ui.ioText.value = JSON.stringify(payload, null, 2);
    };

    $('importReplayBtn').onclick = () => {
      try {
        const data = JSON.parse(ui.ioText.value || '{}');
        if (!Array.isArray(data.events) || !Number.isFinite(+data.seed)) throw new Error('bad replay');
        settings.debugSeed = +data.seed;
        saveSettings();
        if (data.mode && MODES[data.mode]) ui.modeSelect.value = data.mode;
        restart({ seed: +data.seed, events: data.events });
      } catch {
        alert('Replay JSON 无效');
      }
    };

    $('clearHighScoreBtn').onclick = clearCurrentModeHighScore;

    ui.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      settings = readForm();
      Object.assign(settings, DIFF_PRESET[settings.difficulty] || {});
      saveSettings();
      applyTheme();
      ui.settingsModal.close();
      restart();
    });

    ui.modeSelect.addEventListener('change', () => restart());
  }

  settings.theme = settings.theme === 'neon' ? 'neon' : getThemePreference();
  bindInputs();
  bindUI();
  applyTheme();
  restart();
  installDebugApi();

  requestAnimationFrame((t) => {
    lastTime = t;
    requestAnimationFrame(tick);
  });
})();
