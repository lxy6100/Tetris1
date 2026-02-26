(() => {
  'use strict';

  const STORAGE_KEY = 'tetris_vanilla_save_v1';
  const SCORE_KEY = 'tetris_vanilla_scores_v1';

  const DEFAULTS = {
    boardWidth: 10, boardHeight: 20, hiddenRows: 2,
    showGrid: true, showOutline: true, shadow: 40, theme: 'dark', colorBlind: false,
    gravityMs: 800, levelRule: 'lines', das: 130, arr: 25, softDropMultiplier: 18,
    lockDelay: 500, kickMode: 'srs', inputBufferMs: 80, maxLockResets: 12,
    scoringSystem: 'modern', enableGhost: true, enableHold: true, showBestMove: false,
    safeHardDrop: false, restartKeepSettings: true, difficulty: 'normal',
    volume: 0.35, mute: false, vfx: true, debug: false,
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
    classic: { name:'Classic', goal:null },
    sprint: { name:'Sprint 40', goal:40 },
    survival: { name:'Survival', goal:null },
    challenge: { name:'Challenge', goal:null },
    zen: { name:'Zen', goal:null },
  };

  const DIFF_PRESET = {
    easy: { gravityMs: 1000, lockDelay: 650, das: 150, arr: 35 },
    normal: { gravityMs: 800, lockDelay: 500, das: 130, arr: 25 },
    hardcore: { gravityMs: 550, lockDelay: 250, das: 100, arr: 8 }
  };

  const $ = (id) => document.getElementById(id);
  const boardCanvas = $('board'), bctx = boardCanvas.getContext('2d');
  const holdCanvas = $('holdCanvas'), hctx = holdCanvas.getContext('2d');
  const nextCanvas = $('nextCanvas'), nctx = nextCanvas.getContext('2d');

  const ui = {
    score: $('score'), level: $('level'), lines: $('lines'), combo: $('combo'), b2b: $('b2b'), timer: $('timer'),
    modeName: $('modeName'), modeBanner: $('modeBanner'), overlay: $('overlay'), debugPanel: $('debugPanel'),
    modeSelect: $('modeSelect'), settingsModal: $('settingsModal'), settingsForm: $('settingsForm'), ioText: $('ioText')
  };

  function loadSettings() {
    try { return sanitize({ ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }); }
    catch { return { ...DEFAULTS }; }
  }

  function sanitize(s) {
    const n = (k, min, max, d=DEFAULTS[k]) => s[k] = Number.isFinite(+s[k]) ? Math.max(min, Math.min(max, +s[k])) : d;
    n('boardWidth',8,16); n('boardHeight',16,30); n('shadow',0,100); n('gravityMs',50,2000); n('das',20,500); n('arr',0,200);
    n('softDropMultiplier',1,40); n('lockDelay',50,1500); n('inputBufferMs',0,300); n('maxLockResets',0,20); n('volume',0,1);
    ['showGrid','showOutline','colorBlind','enableGhost','enableHold','showBestMove','safeHardDrop','restartKeepSettings','mute','vfx','debug'].forEach(k => s[k] = !!s[k]);
    ['theme','levelRule','kickMode','scoringSystem','difficulty'].forEach(k => s[k] = s[k] || DEFAULTS[k]);
    return s;
  }

  function saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
  function loadScores() { try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || {}; } catch { return {}; } }
  function saveScores(scores) { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); }

  let settings = loadSettings();
  let state = null;
  let keyState = { left:false, right:false, down:false };
  let keyTimers = { left:0, right:0, down:0 };
  let lastTime = performance.now();
  let pendingInput = [];

  function freshState(mode='classic') {
    const w = settings.boardWidth, h = settings.boardHeight, hr = settings.hiddenRows;
    boardCanvas.width = w * 30; boardCanvas.height = h * 30;
    return {
      board: Array.from({length: h+hr}, () => Array(w).fill('')),
      mode, bag: [], next: [], hold: null, canHold: true,
      piece: null, x: 4, y: 1, r: 0,
      score:0, level:1, lines:0, combo:-1, b2b:0,
      dropAcc:0, lockAcc:0, lockResets:0, lastRotate:false,
      over:false, paused:false, startedAt:performance.now(), elapsedMs:0,
      challengeGoal: { needed:2, remainingMs:30000, failCount:0 },
      stats: { tetris:0, tspin:0, maxCombo:0, pieces:0, apm:0 },
      hardDropArmed: !settings.safeHardDrop,
      garbageAcc:0,
      debug: { fps:0 }
    };
  }

  function refillBag() {
    if (state.bag.length) return;
    const arr = ['I','O','T','S','Z','J','L'];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    state.bag.push(...arr);
  }

  function ensureNext() { while (state.next.length < 6) { refillBag(); state.next.push(state.bag.shift()); } }

  function spawn() {
    ensureNext();
    state.piece = state.next.shift(); ensureNext();
    state.r = 0; state.x = (settings.boardWidth / 2) | 0; state.y = 1;
    state.canHold = true; state.lockAcc = 0; state.lockResets = 0; state.lastRotate = false; state.stats.pieces++;
    if (collision(state.x, state.y, state.r)) return gameOver();
  }

  function getCells(type=state.piece, r=state.r) { return PIECES[type].cells[((r%4)+4)%4]; }
  function collision(x, y, r, type=state.piece) {
    const B = state.board;
    return getCells(type, r).some(([dx,dy]) => {
      const cx = x + dx, cy = y + dy;
      if (cx < 0 || cx >= settings.boardWidth || cy >= settings.boardHeight + settings.hiddenRows) return true;
      if (cy < 0) return false;
      return !!B[cy][cx];
    });
  }

  function move(dx, dy) {
    if (!collision(state.x + dx, state.y + dy, state.r)) {
      state.x += dx; state.y += dy;
      if (dy !== 0) state.lastRotate = false;
      return true;
    }
    return false;
  }

  function rotate(dir) {
    const nr = state.r + dir;
    for (const [kx, ky] of KICKS[settings.kickMode]) {
      if (!collision(state.x + kx, state.y + ky, nr)) {
        state.r = nr; state.x += kx; state.y += ky; state.lastRotate = true;
        if (state.lockAcc > 0 && state.lockResets < settings.maxLockResets) { state.lockAcc = 0; state.lockResets++; }
        sfx('rotate', 400);
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    let dist = 0;
    while (move(0,1)) dist++;
    state.score += dist * 2;
    lockPiece();
    sfx('hard', 120);
  }

  function ghostY() {
    let gy = state.y;
    while (!collision(state.x, gy+1, state.r)) gy++;
    return gy;
  }

  function hold() {
    if (!settings.enableHold || !state.canHold) return;
    if (!state.hold) { state.hold = state.piece; spawn(); }
    else {
      const t = state.hold; state.hold = state.piece; state.piece = t;
      state.x = (settings.boardWidth / 2) | 0; state.y = 1; state.r = 0;
      if (collision(state.x, state.y, state.r)) gameOver();
    }
    state.canHold = false;
  }

  function lockPiece() {
    const type = state.piece;
    getCells().forEach(([dx,dy]) => {
      const cx = state.x + dx, cy = state.y + dy;
      if (cy >= 0) state.board[cy][cx] = type;
    });
    const tSpin = detectTSpin(type);
    const cleared = clearLines();
    award(cleared, tSpin);
    if (settings.vfx && navigator.vibrate) navigator.vibrate(cleared ? 30 : 10);
    spawn();
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

  function clearLines() {
    let c = 0;
    for (let y = state.board.length - 1; y >= 0; y--) {
      if (state.board[y].every(Boolean)) {
        state.board.splice(y,1); state.board.unshift(Array(settings.boardWidth).fill(''));
        c++; y++;
      }
    }
    if (c) {
      state.lines += c; state.combo++; state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);
      if (c===4) state.stats.tetris++;
      sfx('clear', 700);
    } else state.combo = -1;
    return c;
  }

  function award(lines, tSpin) {
    const L = state.level;
    const baseClassic = [0,40,100,300,1200];
    const baseModern = tSpin ? [0,800,1200,1600,0] : [0,100,300,500,800];
    let add = (settings.scoringSystem === 'classic' ? baseClassic[lines] : baseModern[lines]) * L;
    if (state.combo > 0) add += state.combo * 50 * L;
    if ((lines===4 || tSpin) && state.b2b>0) add = Math.floor(add * 1.5);
    if (lines===4 || tSpin) state.b2b++; else if (lines) state.b2b = 0;
    if (tSpin) state.stats.tspin++;
    if (lines && perfectClear()) add += 2000 * L;
    state.score += add;
    updateLevel();
  }

  function perfectClear() {
    return state.board.slice(settings.hiddenRows).every(row => row.every(c => !c));
  }

  function updateLevel() {
    if (state.mode === 'zen') return state.level = 1;
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
    const hole = (Math.random() * settings.boardWidth) | 0;
    state.board.shift();
    const row = Array(settings.boardWidth).fill('G'); row[hole] = '';
    state.board.push(row);
  }

  function processMode(dt) {
    if (state.mode === 'sprint' && state.lines >= 40) {
      finish('Sprint 完成！');
    } else if (state.mode === 'survival') {
      state.garbageAcc += dt;
      if (state.garbageAcc > 12000) { state.garbageAcc = 0; addGarbageRow(); }
    } else if (state.mode === 'challenge') {
      state.challengeGoal.remainingMs -= dt;
      if (state.challengeGoal.remainingMs <= 0) {
        if (state.combo + 1 < state.challengeGoal.needed) {
          addGarbageRow(); state.challengeGoal.failCount++;
        }
        state.challengeGoal.remainingMs = 30000;
        state.challengeGoal.needed = 1 + ((Math.random()*4)|0);
      }
      ui.modeBanner.textContent = `挑战：30秒内达成连击 ${state.challengeGoal.needed}`;
    }
  }

  function finish(text) {
    state.over = true;
    ui.overlay.textContent = text;
    ui.overlay.classList.remove('hidden');
    saveRecord();
  }

  function gameOver() {
    sfx('lose', 140);
    finish('Game Over');
  }

  function saveRecord() {
    const scores = loadScores();
    const mode = state.mode;
    const rec = scores[mode] || {};
    rec.bestScore = Math.max(rec.bestScore || 0, state.score);
    if (mode === 'sprint') {
      if (!rec.bestTime || state.elapsedMs < rec.bestTime) rec.bestTime = state.elapsedMs;
    }
    rec.lastStats = { lines: state.lines, tetris: state.stats.tetris, tspin: state.stats.tspin, maxCombo: state.stats.maxCombo, elapsedMs: state.elapsedMs };
    scores[mode] = rec;
    saveScores(scores);
  }

  function bestSuggestion() {
    let best = null;
    const piece = state.piece;
    for (let r=0; r<4; r++) {
      for (let x=-2; x<settings.boardWidth+2; x++) {
        let y = -1;
        while (!collision(x, y+1, r, piece)) y++;
        if (collision(x, y, r, piece)) continue;
        const score = heuristic(x,y,r,piece);
        if (!best || score > best.score) best = { x, y, r, score };
      }
    }
    return best;
  }

  function heuristic(x,y,r,piece) {
    const b = state.board.map(row => row.slice());
    getCells(piece,r).forEach(([dx,dy]) => { const cx=x+dx, cy=y+dy; if(cy>=0&&cy<b.length&&cx>=0&&cx<settings.boardWidth) b[cy][cx]=piece; });
    let holes=0, agg=0, bump=0, prev=-1, lines=0;
    for(let col=0; col<settings.boardWidth; col++){
      let seen=false, h=0;
      for(let row=0; row<b.length; row++){
        if(b[row][col]) { if(!seen) h=b.length-row, seen=true; }
        else if(seen) holes++;
      }
      agg += h; if(prev>=0) bump += Math.abs(h-prev); prev=h;
    }
    b.forEach(row=>{ if(row.every(Boolean)) lines++; });
    return lines*3 - agg*0.4 - holes*1.1 - bump*0.25;
  }

  function drawMini(ctx, type, ox, oy, size=22, alpha=1) {
    if (!type) return;
    ctx.save(); ctx.globalAlpha = alpha;
    getCells(type,0).forEach(([dx,dy]) => drawCell(ctx, ox + (dx+1.5)*size, oy + (dy+1.5)*size, PIECES[type].c, size-1, type));
    ctx.restore();
  }

  function drawCell(ctx,x,y,color,size,id='') {
    ctx.fillStyle = color === 'G' ? '#666' : color;
    ctx.shadowColor = color;
    ctx.shadowBlur = settings.shadow / 10;
    ctx.fillRect(x,y,size,size);
    if (settings.showOutline) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeRect(x+0.5,y+0.5,size-1,size-1); }
    if (settings.colorBlind && id) {
      ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font=`${Math.max(8,size/2)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(id[0], x+size/2, y+size/2);
    }
  }

  function render(dt) {
    const cell = boardCanvas.width / settings.boardWidth;
    bctx.clearRect(0,0,boardCanvas.width,boardCanvas.height);
    bctx.fillStyle = '#000'; bctx.fillRect(0,0,boardCanvas.width,boardCanvas.height);

    if (settings.showGrid) {
      bctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid'); bctx.lineWidth=1;
      for (let x=0; x<=settings.boardWidth; x++) { bctx.beginPath(); bctx.moveTo(x*cell,0); bctx.lineTo(x*cell,boardCanvas.height); bctx.stroke(); }
      for (let y=0; y<=settings.boardHeight; y++) { bctx.beginPath(); bctx.moveTo(0,y*cell); bctx.lineTo(boardCanvas.width,y*cell); bctx.stroke(); }
    }

    for (let y=settings.hiddenRows; y<state.board.length; y++) {
      for (let x=0; x<settings.boardWidth; x++) {
        const id = state.board[y][x];
        if (id) drawCell(bctx, x*cell, (y-settings.hiddenRows)*cell, id==='G' ? '#666' : PIECES[id].c, cell-1, id);
      }
    }

    if (!state.over && state.piece) {
      if (settings.enableGhost) {
        const gy = ghostY();
        getCells().forEach(([dx,dy]) => drawCell(bctx, (state.x+dx)*cell, (gy+dy-settings.hiddenRows)*cell, '#ffffff33', cell-1, ''));
      }
      if (settings.showBestMove) {
        const best = bestSuggestion();
        if (best) getCells(state.piece,best.r).forEach(([dx,dy]) => drawCell(bctx, (best.x+dx)*cell, (best.y+dy-settings.hiddenRows)*cell, '#00ff8850', cell-1, ''));
      }
      getCells().forEach(([dx,dy]) => drawCell(bctx, (state.x+dx)*cell, (state.y+dy-settings.hiddenRows)*cell, PIECES[state.piece].c, cell-1, state.piece));
    }

    hctx.clearRect(0,0,holdCanvas.width,holdCanvas.height);
    drawMini(hctx, state.hold, 12, 10);
    nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    state.next.slice(0,5).forEach((p,i)=>drawMini(nctx,p,12, i*58 + 8));

    ui.score.textContent = state.score;
    ui.level.textContent = state.level;
    ui.lines.textContent = state.lines;
    ui.combo.textContent = Math.max(0, state.combo);
    ui.b2b.textContent = state.b2b;
    ui.timer.textContent = fmtTime(state.elapsedMs);

    if (settings.debug) {
      ui.debugPanel.classList.remove('hidden');
      const fps = (1000 / Math.max(16, dt)).toFixed(1);
      ui.debugPanel.innerHTML = `FPS: ${fps}<br/>Piece: ${state.piece}<br/>Pos: (${state.x},${state.y})<br/>DropAcc: ${state.dropAcc.toFixed(1)}<br/>LockAcc: ${state.lockAcc.toFixed(1)}`;
    } else ui.debugPanel.classList.add('hidden');
  }

  function fmtTime(ms) {
    const s = Math.floor(ms/1000), m = Math.floor(s/60), rs = s%60;
    return `${String(m).padStart(2,'0')}:${String(rs).padStart(2,'0')}`;
  }

  function processInput(dt) {
    const LR = [['left',-1],['right',1]];
    for (const [k,dx] of LR) {
      if (keyState[k]) {
        keyTimers[k] += dt;
        if (keyTimers[k] === dt) { move(dx,0); sfx('move',240); }
        else if (keyTimers[k] > settings.das) {
          if (settings.arr === 0) { while (move(dx,0)); }
          else if ((keyTimers[k]-settings.das) >= settings.arr) { move(dx,0); keyTimers[k] = settings.das; }
        }
      } else keyTimers[k] = 0;
    }
    if (keyState.down) {
      keyTimers.down += dt;
      if (keyTimers.down > Math.max(16, gravityMs()/settings.softDropMultiplier)) {
        move(0,1); state.score += 1; keyTimers.down = 0;
      }
    } else keyTimers.down = 0;

    const now = performance.now();
    pendingInput = pendingInput.filter(it => now-it.t <= settings.inputBufferMs);
    while (pendingInput.length) {
      const act = pendingInput.shift().a;
      if (act==='cw') rotate(1);
      else if (act==='ccw') rotate(-1);
      else if (act==='hold') hold();
      else if (act==='hard') {
        if (!settings.safeHardDrop || state.hardDropArmed) hardDrop();
        else { state.hardDropArmed = true; ui.modeBanner.textContent = '再次按 Space 执行硬降'; }
      }
      else if (act==='pause') togglePause();
    }
  }

  function tick(ts) {
    const dt = Math.min(50, ts - lastTime); lastTime = ts;
    if (!state.paused && !state.over) {
      state.elapsedMs += dt;
      processInput(dt);
      processMode(dt);
      state.dropAcc += dt;
      if (state.dropAcc >= gravityMs()) {
        state.dropAcc = 0;
        if (!move(0,1)) {
          state.lockAcc += gravityMs();
          if (state.lockAcc >= settings.lockDelay) lockPiece();
        } else state.lockAcc = 0;
      }
      state.stats.apm = ((state.lines / Math.max(1, state.elapsedMs / 60000)) * 10).toFixed(1);
    }
    render(dt);
    requestAnimationFrame(tick);
  }

  function bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat && ['z','x',' ','ArrowUp','c','p'].includes(e.key.toLowerCase())) return;
      if (e.key === 'Escape') return toggleSettings();
      if (ui.settingsModal.open) return;
      switch (e.key) {
        case 'ArrowLeft': keyState.left = true; break;
        case 'ArrowRight': keyState.right = true; break;
        case 'ArrowDown': keyState.down = true; break;
        case 'ArrowUp': case 'x': case 'X': pendingInput.push({a:'cw',t:performance.now()}); break;
        case 'z': case 'Z': pendingInput.push({a:'ccw',t:performance.now()}); break;
        case ' ': pendingInput.push({a:'hard',t:performance.now()}); break;
        case 'c': case 'C': pendingInput.push({a:'hold',t:performance.now()}); break;
        case 'p': case 'P': pendingInput.push({a:'pause',t:performance.now()}); break;
        case 'r': case 'R': restart(); break;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') keyState.left = false;
      if (e.key === 'ArrowRight') keyState.right = false;
      if (e.key === 'ArrowDown') keyState.down = false;
    });

    document.querySelectorAll('.mobile-controls button').forEach(btn => {
      const act = btn.dataset.act;
      const down = () => {
        if (act==='left'||act==='right'||act==='soft') keyState[act==='soft'?'down':act] = true;
        else if (act==='hard') pendingInput.push({a:'hard',t:performance.now()});
        else if (act==='cw'||act==='ccw'||act==='hold') pendingInput.push({a:act,t:performance.now()});
        else if (act==='pause') pendingInput.push({a:'pause',t:performance.now()});
      };
      const up = () => {
        if (act==='left'||act==='right'||act==='soft') keyState[act==='soft'?'down':act] = false;
      };
      btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); down(); }, {passive:false});
      btn.addEventListener('touchend', up);
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    });
  }

  function restart() {
    const mode = ui.modeSelect.value;
    state = freshState(mode);
    ui.modeName.textContent = MODES[mode].name;
    ui.modeBanner.textContent = `模式：${MODES[mode].name}`;
    ui.overlay.classList.add('hidden');
    applyTheme();
    spawn();
  }

  function applyTheme() {
    document.body.classList.remove('theme-dark','theme-light','theme-neon');
    document.body.classList.add(`theme-${settings.theme}`);
  }

  function togglePause() {
    if (state.over) return;
    state.paused = !state.paused;
    ui.overlay.textContent = state.paused ? 'Paused' : '';
    ui.overlay.classList.toggle('hidden', !state.paused);
  }

  function toggleSettings() {
    if (ui.settingsModal.open) ui.settingsModal.close();
    else {
      fillForm();
      ui.settingsModal.showModal();
    }
  }

  function sfx(type, freq=440) {
    if (settings.mute || settings.volume <= 0) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ac = sfx.ac || (sfx.ac = new Ctx());
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type==='clear' ? 'triangle' : 'square';
      o.frequency.value = freq;
      g.gain.value = settings.volume * 0.12;
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.045);
    } catch {}
  }

  function fillForm() {
    const f = ui.settingsForm;
    Object.keys(DEFAULTS).forEach(k => {
      if (!(k in f.elements)) return;
      const el = f.elements[k];
      if (el.type === 'checkbox') el.checked = !!settings[k];
      else el.value = settings[k];
    });
  }

  function readForm() {
    const f = ui.settingsForm;
    const out = { ...settings };
    Object.keys(DEFAULTS).forEach(k => {
      if (!(k in f.elements)) return;
      const el = f.elements[k];
      out[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    out.hiddenRows = 2;
    return sanitize(out);
  }

  function bindUI() {
    $('startBtn').onclick = restart;
    $('pauseBtn').onclick = () => pendingInput.push({a:'pause',t:performance.now()});
    $('settingsBtn').onclick = toggleSettings;
    $('closeSettings').onclick = () => ui.settingsModal.close();
    $('presetStandard').onclick = () => {
      settings.boardWidth = 10; settings.boardHeight = 20; settings.hiddenRows = 2;
      fillForm();
    };
    $('exportBtn').onclick = () => {
      const payload = { settings, scores: loadScores() };
      ui.ioText.value = JSON.stringify(payload, null, 2);
    };
    $('importBtn').onclick = () => {
      try {
        const data = JSON.parse(ui.ioText.value || '{}');
        if (data.settings) { settings = sanitize({ ...DEFAULTS, ...data.settings }); saveSettings(); }
        if (data.scores) saveScores(data.scores);
        fillForm(); restart();
      } catch { alert('JSON 无效'); }
    };
    ui.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      settings = readForm();
      Object.assign(settings, DIFF_PRESET[settings.difficulty] || {});
      saveSettings();
      ui.settingsModal.close();
      restart();
    });
    ui.modeSelect.addEventListener('change', restart);
  }

  bindInputs();
  bindUI();
  restart();
  requestAnimationFrame((t)=>{ lastTime=t; requestAnimationFrame(tick); });
})();
