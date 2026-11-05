import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const $ = (id) => document.getElementById(id);
const GLYPHS = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};
const state = {
  moves: [], snapshots: [], headers: {}, current: 0, flipped: false,
  engine: null, engineReady: false, engineReadyPromise: null,
  taskQueue: [], activeTask: null, review: [], reviewing: false
};

function setStatus(id, message, kind = '') {
  const node = $(id);
  node.textContent = message;
  node.className = 'status' + (kind ? ` ${kind}` : '');
}

function getHeaders(pgn) {
  const headers = {};
  for (const match of pgn.matchAll(/^\[([^\s]+)\s+"((?:\\.|[^"])*)"\]\s*$/gm)) {
    headers[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return headers;
}

function importPgn(pgn) {
  if (!pgn.trim()) throw new Error('Paste a PGN game or choose a PGN file first.');
  const parsed = new Chess();
  parsed.loadPgn(pgn, { strict: false });
  const moves = parsed.history({ verbose: true });
  if (!moves.length) throw new Error('No valid moves were found in this PGN.');
  const snapshots = [moves[0].before, ...moves.map(move => move.after)];
  state.moves = moves;
  state.snapshots = snapshots;
  state.headers = getHeaders(pgn);
  state.current = moves.length;
  state.review = [];
  state.reviewing = false;
  $('gameSection').hidden = false;
  $('reviewSection').hidden = true;
  $('positionResult').hidden = true;
  $('reviewList').innerHTML = '';
  const white = state.headers.White || 'White';
  const black = state.headers.Black || 'Black';
  $('gameTitle').textContent = `${white} vs ${black}`;
  const meta = [state.headers.Event, state.headers.Date, state.headers.Result].filter(Boolean);
  $('gameMeta').textContent = meta.join(' · ') || `${moves.length} half-moves loaded`;
  $('moveRange').max = String(moves.length);
  $('moveRange').value = String(moves.length);
  renderGame();
  setStatus('importStatus', `Loaded ${moves.length} half-moves successfully.`, 'success');
  $('gameSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function currentGame() {
  return new Chess(state.snapshots[state.current]);
}

function renderBoard() {
  const chess = currentGame();
  const rows = chess.board();
  const board = $('chessboard');
  board.innerHTML = '';
  const lastMove = state.current > 0 ? state.moves[state.current - 1] : null;
  for (let visualRow = 0; visualRow < 8; visualRow++) {
    for (let visualCol = 0; visualCol < 8; visualCol++) {
      const row = state.flipped ? 7 - visualRow : visualRow;
      const col = state.flipped ? 7 - visualCol : visualCol;
      const squareInfo = rows[row][col];
      const squareName = `${'abcdefgh'[col]}${8 - row}`;
      const tile = document.createElement('div');
      tile.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      if (lastMove && (lastMove.from === squareName || lastMove.to === squareName)) tile.style.boxShadow = 'inset 0 0 0 4px #e6d06a';
      if (visualCol === 0) {
        const coord = document.createElement('span');
        coord.className = 'coord';
        coord.textContent = String(8 - row);
        tile.append(coord);
      }
      if (visualRow === 7) {
        const coord = document.createElement('span');
        coord.className = 'coord';
        coord.style.left = 'auto'; coord.style.right = '3px'; coord.style.top = 'auto'; coord.style.bottom = '2px';
        coord.textContent = 'abcdefgh'[col];
        tile.append(coord);
      }
      if (squareInfo) {
        const piece = document.createElement('span');
        piece.className = `piece ${squareInfo.color === 'w' ? 'white' : 'black'}`;
        piece.textContent = GLYPHS[squareInfo.color + squareInfo.type];
        tile.append(piece);
      }
      board.append(tile);
    }
  }
}

function renderMoves() {
  const target = $('moveNotation');
  target.innerHTML = '';
  if (!state.moves.length) return;
  const start = document.createElement('button');
  start.className = `move-chip ${state.current === 0 ? 'active' : ''}`;
  start.textContent = 'Start';
  start.onclick = () => goToMove(0);
  target.append(start);
  state.moves.forEach((move, index) => {
    const button = document.createElement('button');
    button.className = `move-chip ${state.current === index + 1 ? 'active' : ''}`;
    const moveNo = Math.floor(index / 2) + 1;
    button.textContent = move.color === 'w' ? `${moveNo}. ${move.san}` : `${moveNo}… ${move.san}`;
    button.onclick = () => goToMove(index + 1);
    target.append(button);
  });
}

function renderGame() {
  renderBoard();
  renderMoves();
  $('moveRange').value = String(state.current);
  const currentFen = state.snapshots[state.current];
  const position = new Chess(currentFen);
  if (state.current === 0) $('positionLabel').textContent = 'Starting position';
  else {
    const move = state.moves[state.current - 1];
    const number = Math.floor((state.current - 1) / 2) + 1;
    $('positionLabel').textContent = `${number}${move.color === 'w' ? '.' : '…'} ${move.san}`;
  }
  $('turnLabel').textContent = position.turn() === 'w' ? 'White to move' : 'Black to move';
  $('firstMove').disabled = state.current === 0;
  $('prevMove').disabled = state.current === 0;
  $('nextMove').disabled = state.current === state.moves.length;
  $('lastMove').disabled = state.current === state.moves.length;
  $('positionResult').hidden = true;
}

function goToMove(index) {
  state.current = Math.max(0, Math.min(state.moves.length, index));
  renderGame();
}

function formatEvaluation(score) {
  if (score.mate !== null) {
    const mate = score.mate;
    return `${mate > 0 ? '+' : mate < 0 ? '−' : ''}M${Math.abs(mate)}`;
  }
  const pawns = score.cp / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

function parseEngineScore(line, fen) {
  const cp = line.match(/\bscore cp (-?\d+)/);
  const mate = line.match(/\bscore mate (-?\d+)/);
  let value = null;
  if (cp) value = { cp: Number(cp[1]), mate: null };
  else if (mate) value = { cp: null, mate: Number(mate[1]) };
  if (!value) return null;
  const turn = new Chess(fen).turn();
  if (turn === 'b') {
    if (value.cp !== null) value.cp *= -1;
    else value.mate *= -1;
  }
  return value;
}

function scoreToCentipawns(score) {
  if (score.mate !== null) return Math.sign(score.mate || 1) * (100000 - Math.min(Math.abs(score.mate), 99) * 100);
  return score.cp;
}

function pvToSan(fen, pv) {
  if (!pv) return '';
  const chess = new Chess(fen);
  const san = [];
  for (const uci of pv.trim().split(/\s+/).slice(0, 9)) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(uci)) break;
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4]?.toLowerCase() });
      if (!move) break;
      san.push(move.san);
    } catch { break; }
  }
  return san.join(' ');
}

function ensureEngine() {
  if (state.engineReady) return Promise.resolve();
  if (state.engineReadyPromise) return state.engineReadyPromise;
  state.engineReadyPromise = new Promise((resolve, reject) => {
    try {
      const worker = new Worker('engine-loader.js');
      state.engine = worker;
      const timeout = setTimeout(() => reject(new Error('Stockfish did not start. Check your internet connection and reload the app.')), 45000);
      worker.onmessage = event => {
        const line = String(event.data);
        if (line === 'uciok') worker.postMessage('isready');
        else if (line === 'readyok') {
          clearTimeout(timeout);
          state.engineReady = true;
          setStatus('engineStatus', 'Stockfish 19 is ready.', 'success');
          resolve();
        } else handleEngineLine(line);
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Stockfish could not load. Open the app online once, then try again.'));
      };
      worker.postMessage('uci');
    } catch (error) { reject(error); }
  }).catch(error => {
    state.engineReadyPromise = null;
    throw error;
  });
  return state.engineReadyPromise;
}

function handleEngineLine(line) {
  const task = state.activeTask;
  if (!task) return;
  const score = parseEngineScore(line, task.fen);
  if (score) task.score = score;
  const pvMatch = line.match(/\bpv (.+)$/);
  if (pvMatch) task.pv = pvMatch[1];
  const depthMatch = line.match(/\bdepth (\d+)/);
  if (depthMatch && task.onProgress) task.onProgress(Number(depthMatch[1]));
  if (line.startsWith('bestmove ')) {
    const bestMove = line.split(/\s+/)[1];
    const result = { score: task.score || { cp: 0, mate: null }, pv: task.pv || '', bestMove };
    state.activeTask = null;
    task.resolve(result);
    runNextTask();
  }
}

function runNextTask() {
  if (state.activeTask || !state.taskQueue.length || !state.engineReady) return;
  const task = state.taskQueue.shift();
  state.activeTask = task;
  task.score = null; task.pv = '';
  state.engine.postMessage(`position fen ${task.fen}`);
  state.engine.postMessage(`go depth ${task.depth}`);
}

async function analyzeFen(fen, depth, onProgress) {
  await ensureEngine();
  return new Promise(resolve => {
    state.taskQueue.push({ fen, depth, onProgress, resolve });
    runNextTask();
  });
}

function bestMoveSan(fen, uci) {
  if (!uci || uci === '(none)' || uci === '0000') return 'No legal move';
  try {
    const chess = new Chess(fen);
    const result = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4]?.toLowerCase() });
    return result ? result.san : uci;
  } catch { return uci; }
}

async function analyzeCurrentPosition() {
  const button = $('analyzePosition');
  button.disabled = true;
  $('positionResult').hidden = false;
  $('bestMove').textContent = '…';
  $('evaluation').textContent = '…';
  $('principalVariation').textContent = 'Starting Stockfish…';
  setStatus('engineStatus', 'Analyzing current position…');
  try {
    const fen = state.snapshots[state.current];
    const depth = Number($('depthSelect').value);
    const result = await analyzeFen(fen, depth, currentDepth => setStatus('engineStatus', `Searching · depth ${currentDepth}`));
    $('bestMove').textContent = bestMoveSan(fen, result.bestMove);
    $('evaluation').textContent = formatEvaluation(result.score);
    $('principalVariation').textContent = result.pv ? `Line: ${pvToSan(fen, result.pv)}` : 'No principal variation returned.';
    setStatus('engineStatus', 'Position analysis complete.', 'success');
  } catch (error) { setStatus('engineStatus', error.message, 'error'); }
  finally { button.disabled = false; }
}

function classifyLoss(loss) {
  if (loss >= 300) return ['blunder', 'Blunder'];
  if (loss >= 150) return ['mistake', 'Mistake'];
  if (loss >= 75) return ['inaccuracy', 'Inaccuracy'];
  return ['good', 'Good'];
}

function renderReview() {
  const list = $('reviewList');
  list.innerHTML = '';
  state.review.forEach((item, index) => {
    const row = document.createElement('button');
    row.className = `review-row ${item.category}`;
    const moveNo = Math.floor(index / 2) + 1;
    const prefix = item.move.color === 'w' ? `${moveNo}.` : `${moveNo}…`;
    const no = document.createElement('span'); no.className = 'move-no'; no.textContent = prefix;
    const middle = document.createElement('span');
    const san = document.createElement('span'); san.className = 'review-san'; san.textContent = item.move.san;
    const note = document.createElement('span'); note.className = 'review-note'; note.textContent = item.label;
    middle.append(san, document.createElement('br'), note);
    const loss = document.createElement('span'); loss.className = 'review-loss'; loss.textContent = item.loss >= 0 ? `−${(item.loss / 100).toFixed(2)}` : '—';
    row.append(no, middle, loss);
    row.onclick = () => { goToMove(index + 1); $('gameSection').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    list.append(row);
  });
  const counts = ['blunder', 'mistake', 'inaccuracy'].map(category => state.review.filter(item => item.category === category).length);
  $('reviewCount').textContent = `${counts[0]} blunders · ${counts[1]} mistakes · ${counts[2]} inaccuracies`;
}

async function reviewWholeGame() {
  if (state.reviewing) return;
  state.reviewing = true;
  $('reviewGame').disabled = true;
  $('analyzePosition').disabled = true;
  $('reviewSection').hidden = false;
  $('reviewProgress').hidden = false;
  $('reviewList').innerHTML = '';
  $('reviewCount').textContent = 'Review in progress';
  state.review = [];
  const total = state.snapshots.length;
  const evaluations = [];
  const depth = Math.min(Number($('depthSelect').value), 13);
  setStatus('engineStatus', `Reviewing ${state.moves.length} moves at depth ${depth}…`);
  try {
    for (let i = 0; i < total; i++) {
      const pct = Math.round((i / total) * 100);
      $('progressBar').style.width = `${pct}%`;
      $('progressText').textContent = `Analyzing position ${i + 1} of ${total}`;
      setStatus('engineStatus', `Reviewing game · position ${i + 1}/${total}`);
      const result = await analyzeFen(state.snapshots[i], depth, d => {
        $('progressText').textContent = `Position ${i + 1}/${total} · engine depth ${d}`;
      });
      evaluations.push(scoreToCentipawns(result.score));
    }
    for (let i = 0; i < state.moves.length; i++) {
      const move = state.moves[i];
      const whiteLoss = evaluations[i] - evaluations[i + 1];
      const loss = move.color === 'w' ? whiteLoss : -whiteLoss;
      const boundedLoss = Math.max(0, loss);
      const [category, label] = classifyLoss(boundedLoss);
      state.review.push({ move, loss: boundedLoss, category, label });
    }
    $('progressBar').style.width = '100%';
    $('progressText').textContent = 'Review complete.';
    renderReview();
    setStatus('engineStatus', 'Whole-game review complete.', 'success');
  } catch (error) {
    setStatus('engineStatus', error.message, 'error');
    $('progressText').textContent = 'Review stopped. Try again with a lower depth or a shorter game.';
  } finally {
    state.reviewing = false;
    $('reviewGame').disabled = false;
    $('analyzePosition').disabled = false;
  }
}

$('pgnFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { importPgn(await file.text()); }
  catch (error) { setStatus('importStatus', error.message, 'error'); }
  event.target.value = '';
});
$('loadPgnButton').addEventListener('click', () => {
  try { importPgn($('pgnText').value); }
  catch (error) { setStatus('importStatus', error.message, 'error'); }
});
$('firstMove').addEventListener('click', () => goToMove(0));
$('prevMove').addEventListener('click', () => goToMove(state.current - 1));
$('nextMove').addEventListener('click', () => goToMove(state.current + 1));
$('lastMove').addEventListener('click', () => goToMove(state.moves.length));
$('moveRange').addEventListener('input', event => goToMove(Number(event.target.value)));
$('flipButton').addEventListener('click', () => { state.flipped = !state.flipped; renderBoard(); });
$('analyzePosition').addEventListener('click', analyzeCurrentPosition);
$('reviewGame').addEventListener('click', reviewWholeGame);

let installPrompt = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; $('installButton').hidden = false;
});
$('installButton').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('installButton').hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
