// Generates src/theme-dark.generated.css: remaps the light slate/blue Tailwind palette used
// across the dashboards and modals onto the cinematic dark-blue theme of the landing page.
// Rules are unlayered, so they win over Tailwind's layered utilities. Every colour utility
// found in src/ gets a rule (unchanged ones keep their palette value) so base, hover and
// focus states stay in the same cascade layer and keep their usual precedence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const outFile = path.join(srcDir, 'theme-dark.generated.css');

const NEUTRALS = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
const ACCENTS = ['blue', 'indigo'];
const HUES = {
  sky: ['#bae6fd', '#7dd3fc', '#38bdf8', '14,165,233'],
  cyan: ['#a5f3fc', '#67e8f9', '#22d3ee', '6,182,212'],
  emerald: ['#a7f3d0', '#6ee7b7', '#34d399', '16,185,129'],
  green: ['#bbf7d0', '#86efac', '#4ade80', '34,197,94'],
  teal: ['#99f6e4', '#5eead4', '#2dd4bf', '20,184,166'],
  lime: ['#d9f99d', '#bef264', '#a3e635', '132,204,22'],
  amber: ['#fde68a', '#fcd34d', '#fbbf24', '245,158,11'],
  yellow: ['#fef08a', '#fde047', '#facc15', '234,179,8'],
  orange: ['#fed7aa', '#fdba74', '#fb923c', '249,115,22'],
  red: ['#fecaca', '#fca5a5', '#f87171', '239,68,68'],
  rose: ['#fecdd3', '#fda4af', '#fb7185', '244,63,94'],
  pink: ['#fbcfe8', '#f9a8d4', '#f472b6', '236,72,153'],
  purple: ['#e9d5ff', '#d8b4fe', '#c084fc', '168,85,247'],
  violet: ['#ddd6fe', '#c4b5fd', '#a78bfa', '139,92,246'],
  fuchsia: ['#f5d0fe', '#f0abfc', '#e879f9', '217,70,239'],
};
const ACCENT_RGB = '59,139,255';
const COLORS = [...NEUTRALS, ...ACCENTS, ...Object.keys(HUES), 'white', 'black'];

const PROPS = {
  bg: 'background-color',
  text: 'color',
  border: 'border-color',
  divide: 'border-color',
  ring: '--tw-ring-color',
  outline: 'outline-color',
  placeholder: 'color',
  from: '--tw-gradient-from',
  via: '--tw-gradient-via',
  to: '--tw-gradient-to',
};

const PSEUDO = {
  hover: ':hover',
  focus: ':focus',
  'focus-visible': ':focus-visible',
  'focus-within': ':focus-within',
  active: ':active',
  disabled: ':disabled',
  checked: ':checked',
};
const SCREENS = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem', '2xl': '96rem' };

const rgba = (rgb, a) => (a >= 1 ? `rgb(${rgb})` : `rgba(${rgb},${+a.toFixed(3)})`);
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
const original = (color, shade, op) => {
  const v = shade ? `var(--color-${color}-${shade})` : `var(--color-${color})`;
  return op == null ? v : `color-mix(in oklab, ${v} ${op}%, transparent)`;
};

// Returns the dark-theme value for one colour utility, or the original palette value
function darkValue(prop, color, shade, op, isHover) {
  const a = op == null ? 1 : op / 100;
  const s = Number(shade);

  if (color === 'black') return original(color, null, op);

  if (prop === 'bg' || ['from', 'via', 'to'].includes(prop)) {
    if (color === 'white') return isHover ? rgba('20,30,48', a) : rgba('13,21,36', a);
    if (NEUTRALS.includes(color)) {
      if (isHover && s <= 200) return rgba('255,255,255', [0.04, 0.06, 0.09][s === 50 ? 0 : s === 100 ? 1 : 2] * a);
      if (op != null && s >= 900) return rgba('2,5,10', Math.max(a, 0.6));
      const map = {
        50: '7,11,20', 100: '17,26,41', 200: '27,39,56', 300: '42,56,80', 400: '68,82,106',
        500: '91,104,126', 600: '52,66,90', 700: '38,51,74', 800: '25,36,58', 900: '30,45,72', 950: '4,7,13',
      };
      return rgba(map[s], a);
    }
    if (ACCENTS.includes(color)) {
      if (s <= 300) return rgba(ACCENT_RGB, [0.1, 0.16, 0.24, 0.34][[50, 100, 200, 300].indexOf(s)] * a);
      if (s >= 950) return rgba('8,24,52', a);
      return rgba({ 400: '107,170,255', 500: '75,150,255', 600: ACCENT_RGB, 700: '42,111,224', 800: '31,91,192', 900: '22,66,140' }[s], a);
    }
    if (s <= 300) return rgba(HUES[color][3], [0.1, 0.16, 0.24, 0.34][[50, 100, 200, 300].indexOf(s)] * a);
    if (s >= 900) return rgba(HUES[color][3], 0.22 * a);
    return original(color, shade, op);
  }

  if (prop === 'text' || prop === 'placeholder') {
    if (color === 'white') return original(color, null, op);
    if (prop === 'placeholder' && NEUTRALS.includes(color)) return '#556173';
    if (NEUTRALS.includes(color)) {
      const map = { 950: '#f4f7fb', 900: '#e9eef6', 800: '#d6deea', 700: '#b9c4d4', 600: '#9aa6b8', 500: '#8b97a9', 400: '#627086' };
      return map[s] ? rgba(hexToRgb(map[s]), a) : original(color, shade, op);
    }
    if (ACCENTS.includes(color)) {
      if (s >= 800) return rgba('184,212,255', a);
      if (s >= 300) return rgba('143,192,255', a);
      return original(color, shade, op);
    }
    if (s >= 800) return rgba(hexToRgb(HUES[color][0]), a);
    if (s >= 600) return rgba(hexToRgb(HUES[color][1]), a);
    if (s === 500) return rgba(hexToRgb(HUES[color][2]), a);
    return original(color, shade, op);
  }

  // border / divide / ring / outline
  if (color === 'white') return original(color, null, op);
  if (NEUTRALS.includes(color)) {
    const map = { 50: 0.05, 100: 0.05, 200: 0.08, 300: 0.14, 400: 0.22, 500: 0.3 };
    return rgba('255,255,255', (map[s] ?? 0.1) * a);
  }
  if (ACCENTS.includes(color)) {
    if (s <= 200) return rgba(ACCENT_RGB, 0.25 * a);
    if (s === 300) return rgba(ACCENT_RGB, 0.4 * a);
    return rgba(ACCENT_RGB, a);
  }
  if (s <= 200) return rgba(HUES[color][3], 0.25 * a);
  if (s === 300) return rgba(HUES[color][3], 0.4 * a);
  return original(color, shade, op);
}

const escapeClass = (cls) => cls.replace(/([:/.[\]%#()!,])/g, '\\$1');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return /\.(jsx?|tsx?)$/.test(d.name) ? [p] : [];
  });
}

const tokenRe = new RegExp(
  String.raw`(?<![\w-])((?:[a-z0-9-]+:)*)(${Object.keys(PROPS).join('|')})-(${COLORS.join('|')})(?:-(50|[1-9]00|950))?(?:\/(\d{1,3}))?(?![\w-])`,
  'g'
);

const tokens = new Map();
for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(tokenRe)) {
    const [full, variantStr, prop, color, shade, op] = m;
    if (!['white', 'black'].includes(color) && !shade) continue;
    if (['white', 'black'].includes(color) && shade) continue;
    tokens.set(full, { variants: variantStr.split(':').filter(Boolean), prop, color, shade, op: op ? Number(op) : null });
  }
}

const base = [];
const responsive = Object.fromEntries(Object.keys(SCREENS).map((k) => [k, []]));

for (const [cls, t] of [...tokens].sort(([a], [b]) => a.localeCompare(b))) {
  const screens = t.variants.filter((v) => SCREENS[v]);
  const states = t.variants.filter((v) => !SCREENS[v]);
  if (screens.length > 1 || states.some((v) => !PSEUDO[v] && v !== 'group-hover' && v !== 'placeholder')) continue;

  const isHover = states.some((v) => v === 'hover' || v === 'group-hover');
  const value = darkValue(t.prop, t.color, t.shade, t.op, isHover);

  let sel = `.${escapeClass(cls)}`;
  for (const v of states) if (PSEUDO[v]) sel += PSEUDO[v];
  if (states.includes('group-hover')) sel = `.group:hover ${sel}`;
  if (t.prop === 'placeholder' || states.includes('placeholder')) sel += '::placeholder';
  if (t.prop === 'divide') sel += ' > :not(:last-child)';

  const decl = `${PROPS[t.prop]}: ${value};`;
  const rule = `${sel} { ${decl} }`;
  (screens.length ? responsive[screens[0]] : base).push(rule);
}

let css = `/* AUTO-GENERATED by scripts/build-dark-theme.mjs. Do not edit; run "npm run theme". */\n`;
css += base.join('\n') + '\n';
for (const [screen, rules] of Object.entries(responsive)) {
  if (rules.length) css += `@media (width >= ${SCREENS[screen]}) {\n${rules.map((r) => '  ' + r).join('\n')}\n}\n`;
}
fs.writeFileSync(outFile, css);
console.log(`theme-dark: ${tokens.size} colour utilities -> ${path.relative(root, outFile)}`);
