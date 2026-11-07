export const ROWS = 6;
export const COLS = 7;

export const init = () => ({ board: Array(ROWS * COLS).fill(null), turn: 0, last: null, line: null });

function findLine(board, r, c, p) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [r * COLS + c];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr * COLS + cc] === p) {
        cells.push(rr * COLS + cc);
        rr += dr * s; cc += dc * s;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export function move(state, p, m) {
  if (state.turn !== p) return { error: "It's not your turn." };
  const c = Number(m);
  if (!Number.isInteger(c) || c < 0 || c >= COLS) return { error: 'Invalid column.' };
  let r = ROWS - 1;
  while (r >= 0 && state.board[r * COLS + c] !== null) r--;
  if (r < 0) return { error: 'That column is full.' };
  state.board[r * COLS + c] = p;
  state.last = r * COLS + c;
  const line = findLine(state.board, r, c, p);
  if (line) { state.line = line; return { winner: p }; }
  if (state.board.every((x) => x !== null)) return { winner: 'draw' };
  state.turn = 1 - p;
  return {};
}
export const view = (s) => s;
