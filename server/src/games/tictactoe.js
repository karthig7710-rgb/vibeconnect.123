const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export const init = () => ({ board: Array(9).fill(null), turn: 0, line: null });

// returns { error } | { winner?: 0 | 1 | 'draw' }
export function move(state, p, m) {
  if (state.turn !== p) return { error: "It's not your turn." };
  const i = Number(m);
  if (!Number.isInteger(i) || i < 0 || i > 8 || state.board[i] !== null) return { error: 'That square is taken.' };
  state.board[i] = p;
  const line = LINES.find((l) => l.every((x) => state.board[x] === p));
  if (line) { state.line = line; return { winner: p }; }
  if (state.board.every((c) => c !== null)) return { winner: 'draw' };
  state.turn = 1 - p;
  return {};
}
export const view = (s) => s;
