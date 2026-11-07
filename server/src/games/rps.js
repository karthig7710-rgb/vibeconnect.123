const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

// Best of 3: first to 2 round wins. Draw rounds are replayed.
export const init = () => ({ choices: [null, null], score: [0, 0], round: 1, last: null, target: 2 });

export function move(state, p, m) {
  if (!CHOICES.includes(m)) return { error: 'Pick rock, paper or scissors.' };
  if (state.choices[p]) return { error: 'You already picked. Waiting for your friend.' };
  state.choices[p] = m;
  if (!state.choices[0] || !state.choices[1]) return {};
  const [a, b] = state.choices;
  const w = a === b ? 'draw' : BEATS[a] === b ? 0 : 1;
  state.last = { choices: [a, b], winner: w };
  state.choices = [null, null];
  state.round += 1;
  if (w !== 'draw') {
    state.score[w] += 1;
    if (state.score[w] >= state.target) return { winner: w };
  }
  return {};
}

// Hide the opponent's pending pick
export const view = (s, viewer) => ({ ...s, choices: s.choices.map((c, i) => (c && i !== viewer ? 'hidden' : c)) });
