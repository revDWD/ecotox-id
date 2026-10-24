// Original pixel art, drawn from text grids so it stays crisp at any size.

const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gridToSvg(rows, palette) {
  const w = Math.max(...rows.map((r) => r.length));
  let body = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (!palette[ch]) { x++; continue; }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      body += rect(x, y, run, 1, palette[ch]);
      x += run;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
}

const PLAYER_ROWS = [
  '.......kkkkkk.....kmmk',
  '......khhhhhhk...kmmmmk',
  '.....khhhhhhhhk..kmmmmk',
  '....kHHHHHHHHHHk.kmmmk.',
  '.....kkkkkkkkkk..knk...',
  '......krrrrrrk...nk....',
  '......krrrrrrk..nk.....',
  '.......kssssk..nk......',
  '......kttttttknk.......',
  '.....kttbbbbtnk........',
  '.....ktbbBBbtk.........',
  '.....ktbbBBbtk.........',
  '.....ktbbbbbtk.........',
  '......kTTTTTTk.........',
  '......kppppppk.........',
  '......kppkkppk.........',
  '......kpk..kpk.........',
  '......kgk..kgk.........',
  '.....kggk..kggk........',
  '.....kkkk..kkkk........',
];
export const SCOUT_PALETTES = [
  { id: 'classic', name: 'Classic', colors: { h: '#f0cd6a', H: '#c99a36', r: '#6b4430', t: '#6fb7a2', T: '#4d927f', p: '#3d4c8c', b: '#c9803d', B: '#9a5a26' } },
  { id: 'field', name: 'Field greens', colors: { h: '#e8c66d', H: '#b48b36', r: '#694b36', t: '#8cbf62', T: '#5e9142', p: '#506c49', b: '#bd8b4f', B: '#8d6035' } },
  { id: 'sunset', name: 'Sunset', colors: { h: '#f4bd70', H: '#d8874c', r: '#6e3f3b', t: '#e58c78', T: '#b85e67', p: '#73518e', b: '#d78654', B: '#a9573f' } },
  { id: 'ocean', name: 'Ocean blue', colors: { h: '#f2d486', H: '#c6a34c', r: '#614b43', t: '#65b7cf', T: '#3886a9', p: '#426bb0', b: '#61a0b9', B: '#39718e' } },
];
const OUTLINE_PALETTE = { k: '#232042', s: '#f2bd94', g: '#5a463a', n: '#c4a062', m: '#eef0ff' };

export const scoutPalette = (id) => SCOUT_PALETTES.find((palette) => palette.id === id) || SCOUT_PALETTES[0];
export const playerSprite = (id) => gridToSvg(PLAYER_ROWS, { ...OUTLINE_PALETTE, ...scoutPalette(id).colors });

function ellipse(cx, cy, rx, ry, color) {
  let out = '';
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
    out += rect(cx - hw, cy + dy, hw * 2, 1, color);
  }
  return out;
}

// The battle scene is drawn twice: a wide 3:2 version and a taller square one for phones.
const BACKDROPS = {
  wide: { h: 80, foe: [94, 43], player: [28, 72] },
  tall: { h: 120, foe: [88, 62], player: [30, 101] },
};

export function backdropSvg(variant = 'wide') {
  const { h, foe, player } = BACKDROPS[variant];
  const horizon = Math.round(h * 0.45);
  const rnd = mulberry32(11);
  let s = '';
  const sky = ['#6fc4f0', '#82cdf3', '#97d6f6', '#addffa', '#c4e8fb'];
  const band = Math.ceil(horizon / sky.length);
  sky.forEach((c, i) => { s += rect(0, i * band, 120, band, c); });
  const cloud = (x, y) => rect(x + 2, y, 8, 2, '#fff') + rect(x, y + 2, 14, 2, '#fff') + rect(x + 3, y + 4, 9, 1, '#e3f3ff');
  s += cloud(10, 6) + cloud(52, 11) + cloud(86, 4);
  for (let x = 0; x < 120; x += 3) {
    const hill = 5 + Math.round(3 * Math.sin(x / 11) + 2 * Math.sin(x / 5));
    s += rect(x, horizon - hill, 3, hill, '#6db882');
  }
  for (let x = 0; x < 120; x += 2) {
    const trees = 3 + Math.round(2 * Math.sin(x / 4 + 1) + rnd() * 2);
    s += rect(x, horizon - trees, 2, trees, '#2f7d4f');
  }
  s += rect(0, horizon, 120, h - horizon, '#86cc6c');
  for (let y = horizon; y < h; y += 8) s += rect(0, y, 120, 4, '#7fc566');
  for (let i = 0; i < Math.round(h * 0.9); i++) {
    const x = Math.floor(rnd() * 118), y = horizon + 2 + Math.floor(rnd() * (h - horizon - 4));
    s += rect(x, y, 2, 1, '#5fae58') + rect(x + 1, y - 1, 1, 1, '#5fae58');
  }
  const [fx, fy] = foe;
  const [px, py] = player;
  s += ellipse(fx, fy + 2, 23, 5, '#4f8f4b') + ellipse(fx, fy, 23, 5, '#b9e08f') + ellipse(fx, fy, 18, 3, '#cdeda2');
  s += ellipse(px, py + 2, 31, 6, '#4f8f4b') + ellipse(px, py, 31, 6, '#b9e08f') + ellipse(px, py, 25, 4, '#cdeda2');
  return `<svg class="backdrop backdrop--${variant}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 ${h}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${s}</svg>`;
}
