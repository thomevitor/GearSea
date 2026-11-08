/* GEARSEA
   Clique esquerdo: um braço vira gancho. Gruda em rebite e teto, não no óleo.
   Clique de novo, ou E, estilinga. Clique direito queima. */

const TILE = 40;
let COLS = 96;
const ROWS = 22;
const ROUGH = 1;
const SLICK = 2;
const GEAR = 3;
const FENCE = 4;
const BELT_R = 5;
const BELT_L = 6;

const PW = 20;
const PH = 28;
const GRAV = 1750;
const WALK = 250;
const PIX = 3;
const LAUNCH = 920;

const canvas = document.getElementById("c");
const screen = canvas.getContext("2d");
const buf = document.createElement("canvas");
const ctx = buf.getContext("2d");

const down = {};
const pressed = {};
const mouse = { x: 0, y: 0, down: false, pressed: false, released: false, moved: false, right: false, rightPressed: false };
let viewW = 640;
let viewH = 360;

const cam = { x: 0, y: 0, shake: 0 };
let time = 0;
let mode = "title";
let goal = "Corre antes de pular. Parado, o pulo não atravessa.";
let flash = 0;
let hint = "";
let paused = false;

const did = { grab: false, burn: false, sling: false, slick: false, attack: false };

let phase = 0;
let phaseName = "DOCA FRIA";
let runKind = "campaign";
let procSeed = 1;
let procDiff = "mid";
let procRooms = 6;
let forge = 0;
const usedSeeds = new Set();
let menu = "main";
let menuIndex = 0;
let menuLeave = 0;
let sign = { x: 160, y: 400 };
let map;
let pads = [];
let ents = [];
let bullets = [];
let particles = [];
let labels = [];
let lamps = [];
let shells = [];
let player;
let spawns = [];
let spawnIndex = 0;
let exitZone = null;
let daylight = null;

const MELODY = [
  220, 0, 262, 294, 262, 220, 196, 0,
  220, 262, 330, 294, 262, 0, 220, 196,
  174, 0, 220, 196, 174, 164, 174, 196,
  220, 262, 294, 262, 220, 196, 174, 0,
];
const BASS = [110, 110, 131, 110, 87, 98, 110, 82];
const BOSS_MELODY = [
  196, 185, 196, 0, 155, 196, 233, 196,
  146, 0, 155, 196, 185, 146, 130, 0,
  196, 233, 196, 155, 0, 185, 196, 146,
  130, 155, 196, 233, 196, 0, 146, 130,
];
const BOSS_BASS = [73, 73, 65, 73, 82, 73, 65, 61];
const audio = { ctx: null, master: null, next: 0, step: 0, started: false };

function ac() {
  if (!audio.ctx) audio.ctx = new AudioContext();
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  return audio.ctx;
}

function tone(freq, dur, type, vol, slide) {
  try {
    const a = ac();
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (err) {
    /* sem áudio */
  }
}

function startMusic() {
  if (audio.started) return;
  audio.started = true;
  const a = ac();
  const master = a.createGain();
  master.gain.value = 0.9;
  master.connect(a.destination);
  audio.master = master;
  audio.next = a.currentTime + 0.06;
  audio.step = 0;
}

function musicTick() {
  if (!audio.started || !audio.ctx) return;
  const a = audio.ctx;
  const boss = mode === "play" && ents.some((e) => e.kind === "boss" && !e.dead);
  if (audio.boss !== boss) {
    audio.boss = boss;
    audio.step = 0;
  }
  const eighth = boss ? 60 / 132 / 2 : 60 / 86 / 2;
  const melody = boss ? BOSS_MELODY : MELODY;
  const bass = boss ? BOSS_BASS : BASS;
  let guard = 0;
  while (audio.next < a.currentTime + 0.28 && guard++ < 10) {
    const i = audio.step % melody.length;
    const lead = melody[i];
    if (lead) note(lead, audio.next, eighth * (boss ? 0.7 : 0.9), boss ? "square" : "square", boss ? 0.055 : 0.045);
    if (boss && lead && i % 2 === 0) note(lead * 2, audio.next, eighth * 0.25, "square", 0.02);
    if (i % 4 === 0) note(bass[(i / 4) % bass.length], audio.next, eighth * (boss ? 4 : 3.2), boss ? "sawtooth" : "triangle", boss ? 0.06 : 0.07);
    if (i % 2 === 1) hat(audio.next);
    audio.next += eighth;
    audio.step++;
  }
}

function note(freq, when, dur, type, vol) {
  const a = audio.ctx;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(audio.master);
  o.start(when);
  o.stop(when + dur + 0.02);
}

function hat(when) {
  const a = audio.ctx;
  const frames = Math.max(1, Math.floor(a.sampleRate * 0.03));
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = 1600;
  g.gain.setValueAtTime(0.03, when);
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.master);
  src.start(when);
}

function setTile(x, y, t) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
  map[y * COLS + x] = t;
}

function tile(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return ROUGH;
  return map[y * COLS + x];
}

function rect(x, y, w, h, t) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setTile(x + i, y + j, t);
}

function fillSea(x, y, w, h) {
  rect(x, y, w, h, GEAR);
}

function belt(x, y, w, dir) {
  rect(x, y, w, 1, dir < 0 ? BELT_L : BELT_R);
}

function addStar(tx, ty) {
  ents.push({
    kind: "star",
    x: tx * TILE + 12,
    y: ty * TILE + 8,
    w: 16,
    h: 16,
    dead: false,
    solid: false,
  });
}

function isGrip(t) {
  return t === ROUGH || t === FENCE || t === BELT_R || t === BELT_L;
}

function isSolidTile(t) {
  return isGrip(t) || t === SLICK;
}

function beltUnder() {
  const feet = player.y + player.h;
  const rows = [Math.floor(feet / TILE), Math.floor((feet + 3) / TILE)];
  const xs = [player.x + 4, player.x + player.w * 0.5, player.x + player.w - 4];
  let dir = 0;
  for (const y of rows) {
    for (const x of xs) {
      const t = tile(Math.floor(x / TILE), y);
      if (t === BELT_R) dir += 1;
      else if (t === BELT_L) dir -= 1;
    }
  }
  return Math.sign(dir);
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function overlapsSolid(b) {
  const x0 = Math.floor(b.x / TILE);
  const y0 = Math.floor(b.y / TILE);
  const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
  const y1 = Math.floor((b.y + b.h - 0.01) / TILE);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (isSolidTile(tile(x, y))) return true;
    }
  }
  for (const e of ents) {
    if (e.solid && !e.dead && aabb(b, e)) return true;
  }
  return false;
}

function makeDoor(tx, floorTile, opts) {
  ents.push({
    kind: "door",
    name: "porta",
    role: "door",
    x: tx * TILE,
    y: (floorTile - 2) * TILE,
    w: 80,
    h: 80,
    solid: true,
    dead: false,
    open: 0,
  });
  ents.push({
    kind: "burn",
    name: "painel",
    role: "switch",
    x: (tx - 2) * TILE + 6,
    y: floorTile * TILE - 36,
    w: 28,
    h: 36,
    hp: 1.05,
    max: 1.05,
    solid: true,
    dead: false,
    locked: !!(opts && opts.locked),
  });
}

function carveDoor(x, y0, y1, opts) {
  for (let y = y0; y <= y1; y++) {
    setTile(x, y, ROUGH);
    setTile(x + 1, y, ROUGH);
  }
  setTile(x, y1 - 1, 0);
  setTile(x, y1, 0);
  setTile(x + 1, y1 - 1, 0);
  setTile(x + 1, y1, 0);
  makeDoor(x, y1 + 1, opts);
}

function placeEntry(tx, floorTile) {
  ents.push({
    kind: "entry",
    role: "entry",
    x: tx * TILE,
    y: (floorTile - 2) * TILE,
    w: 80,
    h: 80,
    solid: false,
    dead: true,
    open: 1,
  });
}

function build() {
  pads = [];
  ents = [];
  bullets = [];
  labels = [];
  lamps = [];
  shells = [];
  spawnIndex = 0;
  did.grab = false;
  did.burn = false;
  did.sling = false;
  did.slick = false;
  did.attack = false;
  if (runKind === "proc") prepareProc(procSeed);
  else COLS = 96;
  map = new Uint8Array(COLS * ROWS);
  rect(0, 0, COLS, ROWS, 0);
  rect(0, 20, COLS, 2, ROUGH);
  rect(0, 0, 2, ROWS, ROUGH);
  rect(COLS - 2, 0, 2, ROWS, ROUGH);
  if (runKind === "proc") buildProcedural(procSeed);
  else if (phase <= 0) buildDoca();
  else if (phase === 1) buildTeto();
  else if (phase === 2) buildLinha();
  else buildBoss();
  player = makePlayer(spawns[0].x, spawns[0].y);
}

function buildDoca() {
  phaseName = "DOCA FRIA";
  sign = { x: 4 * TILE, y: 10 * TILE };
  rect(0, 0, COLS, 10, ROUGH);

  // Doca. Chão em ty 16. Vão de 3 tiles pede corrida.
  rect(2, 16, 16, 4, ROUGH);
  belt(8, 16, 6, 1);
  rect(18, 19, 3, 1, ROUGH);
  rect(21, 16, 13, 4, ROUGH);
  setTile(17, 17, SLICK);
  setTile(17, 18, SLICK);

  // Degrau de rebite. Superfície em ty 13.
  rect(34, 13, 17, 7, ROUGH);
  belt(45, 13, 6, 1);

  // Mar de engrenagens. Cair aqui afoga a unidade.
  fillSea(51, 16, 6, 6);

  // Pouso do voo, mesmo nível do degrau.
  rect(57, 13, 37, 7, ROUGH);

  // Muro da madeira, com um buraco que a caixa fecha.
  for (let y = 8; y <= 12; y++) {
    setTile(74, y, ROUGH);
    setTile(75, y, ROUGH);
  }
  setTile(74, 11, 0);
  setTile(74, 12, 0);
  setTile(75, 11, 0);
  setTile(75, 12, 0);

  // Muro da porta, com o mesmo tipo de buraco.
  for (let y = 8; y <= 12; y++) {
    setTile(88, y, ROUGH);
    setTile(89, y, ROUGH);
  }
  setTile(88, 11, 0);
  setTile(88, 12, 0);
  setTile(89, 11, 0);
  setTile(89, 12, 0);

  pads.push({
    x: 50 * TILE - 6,
    y: 9 * TILE,
    w: 18,
    h: 13 * TILE - 9 * TILE - 10,
    nx: 1,
    ny: 0,
  });

  ents.push({
    kind: "burn",
    name: "caixa",
    x: 74 * TILE,
    y: 11 * TILE,
    w: 80,
    h: 80,
    hp: 1.15,
    max: 1.15,
    solid: true,
    dead: false,
  });

  const hall = 13 * TILE;
  ents.push({
    kind: "attack",
    name: "sentinela",
    x: 80 * TILE,
    y: hall - 64,
    w: 28,
    h: 18,
    hp: 1.4,
    max: 1.4,
    solid: false,
    dead: false,
    minX: 78 * TILE,
    maxX: 86 * TILE,
    dir: 1,
    vx: 70,
    baseY: hall - 64,
    aim: 0,
    bob: 0,
  });

  makeDoor(88, 13);

  const low = 16 * TILE;
  const high = 13 * TILE;
  spawns = [
    { x: 6 * TILE, y: low - PH, at: 0 },
    { x: 24 * TILE, y: low - PH, at: 22 * TILE },
    { x: 40 * TILE, y: high - PH, at: 36 * TILE },
    { x: 62 * TILE, y: high - PH, at: 59 * TILE },
    { x: 80 * TILE, y: high - PH, at: 76 * TILE },
  ];

  exitZone = { x: 91 * TILE, y: high - 80, w: 90, h: 80 };
  daylight = null;
  placeEntry(2, 16);

  labels.push({ x: 8 * TILE, y: 15 * TILE - 6, text: "ESTEIRA", sub: "ela arrasta para a frente" });
  labels.push({ x: 44 * TILE, y: 12 * TILE - 4, text: "ESTEIRA", sub: "empurra para o mar" });
  labels.push({ x: 16 * TILE - 8, y: 15 * TILE - 6, text: "OLEO", sub: "essa face escorrega" });
  labels.push({ x: 21 * TILE + 4, y: 15 * TILE - 6, text: "REBITE", sub: "segura e sobe" });
  labels.push({ x: 34 * TILE + 6, y: 12 * TILE - 4, text: "SOBE", sub: "garra no rebite" });
  labels.push({ x: 46 * TILE, y: 10 * TILE, text: "GANCHO", sub: "clique esquerdo no teto" });
  labels.push({ x: 70 * TILE, y: 10 * TILE, text: "MADEIRA", sub: "clique direito queima" });
  labels.push({ x: 84 * TILE, y: 10 * TILE, text: "CAIXA", sub: "o laser abre a porta" });
  labels.push({ x: 50 * TILE, y: 12 * TILE, text: "MAR", sub: "as engrenagens afogam" });
  addStar(28, 15);
  addStar(53, 12);
  addStar(78, 11);

  lamps.push({ x: 8 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 30 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 46 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 66 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 82 * TILE, y: 10 * TILE + 8 });

  shells.push({ x: 8 * TILE, y: low - 22 });
  goal = "Corre antes de pular. Parado, esse pulo fica curto.";
}

function buildTeto() {
  phaseName = "GALERIA";
  sign = { x: 4 * TILE, y: 10 * TILE };
  rect(0, 0, COLS, 10, ROUGH);

  rect(2, 16, 18, 4, ROUGH);
  fillSea(20, 17, 2, 4);
  rect(22, 16, 8, 4, ROUGH);
  rect(30, 15, 6, 5, ROUGH);
  rect(36, 14, 10, 6, ROUGH);
  belt(40, 14, 6, 1);
  fillSea(46, 15, 2, 6);
  rect(48, 14, 8, 6, ROUGH);
  rect(56, 16, 38, 4, ROUGH);

  for (let y = 10; y <= 15; y++) {
    setTile(68, y, ROUGH);
    setTile(69, y, ROUGH);
  }
  setTile(68, 14, 0);
  setTile(68, 15, 0);
  setTile(69, 14, 0);
  setTile(69, 15, 0);
  ents.push({
    kind: "burn",
    name: "caixa",
    x: 68 * TILE,
    y: 14 * TILE,
    w: 80,
    h: 80,
    hp: 1.1,
    max: 1.1,
    solid: true,
    dead: false,
  });

  ents.push({
    kind: "attack",
    name: "sentinela",
    x: 76 * TILE,
    y: 16 * TILE - 64,
    w: 28,
    h: 18,
    hp: 1.2,
    max: 1.2,
    solid: false,
    dead: false,
    minX: 74 * TILE,
    maxX: 82 * TILE,
    dir: 1,
    vx: 55,
    baseY: 16 * TILE - 64,
    aim: 0,
    bob: 0,
  });

  carveDoor(88, 8, 15);
  placeEntry(2, 16);
  addStar(10, 15);
  addStar(42, 13);
  addStar(76, 15);
  spawns = [
    { x: 6 * TILE, y: 16 * TILE - PH, at: 0 },
    { x: 24 * TILE, y: 16 * TILE - PH, at: 22 * TILE },
    { x: 38 * TILE, y: 14 * TILE - PH, at: 36 * TILE },
    { x: 60 * TILE, y: 16 * TILE - PH, at: 56 * TILE },
    { x: 78 * TILE, y: 16 * TILE - PH, at: 72 * TILE },
  ];
  exitZone = { x: 90 * TILE, y: 16 * TILE - 80, w: 90, h: 80 };
  daylight = null;
  lamps.push({ x: 8 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 26 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 42 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 64 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 80 * TILE, y: 10 * TILE + 8 });
  goal = "Corre no vão curto. A esteira empurra o pulo seguinte.";
}

function buildLinha() {
  phaseName = "LINHA";
  sign = { x: 4 * TILE, y: 8 * TILE };
  rect(0, 0, COLS, 9, ROUGH);
  for (let x = 2; x < COLS - 2; x++) setTile(x, 9, SLICK);

  rect(2, 16, 11, 4, ROUGH);
  belt(7, 16, 4, -1);
  fillSea(13, 17, 3, 5);

  rect(16, 16, 14, 4, ROUGH);
  belt(20, 16, 10, 1);
  fillSea(30, 17, 4, 5);

  rect(34, 11, 4, 9, ROUGH);
  setTile(34, 14, SLICK);
  setTile(34, 15, SLICK);
  setTile(34, 16, SLICK);
  fillSea(38, 17, 3, 5);

  rect(41, 16, 16, 4, ROUGH);
  belt(41, 16, 8, -1);

  rect(58, 14, 36, 6, ROUGH);
  for (let y = 6; y <= 13; y++) {
    setTile(72, y, ROUGH);
    setTile(73, y, ROUGH);
  }
  setTile(72, 12, 0);
  setTile(72, 13, 0);
  setTile(73, 12, 0);
  setTile(73, 13, 0);
  ents.push({
    kind: "burn",
    name: "caixa",
    x: 72 * TILE,
    y: 12 * TILE,
    w: 80,
    h: 80,
    hp: 1.15,
    max: 1.15,
    solid: true,
    dead: false,
  });
  const hall = 14 * TILE;
  ents.push({
    kind: "attack",
    name: "sentinela",
    x: 78 * TILE,
    y: hall - 64,
    w: 28,
    h: 18,
    hp: 1.4,
    max: 1.4,
    solid: false,
    dead: false,
    minX: 76 * TILE,
    maxX: 84 * TILE,
    dir: 1,
    vx: 70,
    baseY: hall - 64,
    aim: 0,
    bob: 0,
  });
  carveDoor(88, 8, 13);

  addStar(9, 15);
  addStar(36, 10);
  addStar(76, 13);
  spawns = [
    { x: 4 * TILE, y: 16 * TILE - PH, at: 0 },
    { x: 17 * TILE, y: 16 * TILE - PH, at: 15 * TILE },
    { x: 52 * TILE, y: 16 * TILE - PH, at: 49 * TILE },
    { x: 80 * TILE, y: 14 * TILE - PH, at: 74 * TILE },
  ];
  exitZone = { x: 91 * TILE, y: 14 * TILE - 80, w: 90, h: 80 };
  daylight = null;
  placeEntry(2, 16);
  labels.push({ x: 4 * TILE, y: 14 * TILE, text: "LINHA", sub: "o teto é óleo" });
  labels.push({ x: 8 * TILE, y: 15 * TILE, text: "ESTEIRA", sub: "puxa para trás" });
  labels.push({ x: 22 * TILE, y: 15 * TILE, text: "ESTEIRA", sub: "pula no fim" });
  labels.push({ x: 34 * TILE, y: 10 * TILE, text: "MURO", sub: "gancho de lado" });
  labels.push({ x: 44 * TILE, y: 15 * TILE, text: "ESTEIRA", sub: "não solta o passo" });
  labels.push({ x: 68 * TILE, y: 11 * TILE, text: "CAIXA", sub: "clique direito" });
  labels.push({ x: 84 * TILE, y: 11 * TILE, text: "CAIXA", sub: "o laser abre a porta" });
  lamps.push({ x: 8 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 24 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 46 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 70 * TILE, y: 10 * TILE + 8 });
  lamps.push({ x: 86 * TILE, y: 10 * TILE + 8 });
  goal = "O teto escorrega. As esteiras mandam na linha.";
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let procCols = 96;

function rollProc(seed) {
  const rnd = mulberry32(seed);
  const roll = rnd();
  procDiff = roll < 0.38 ? "easy" : roll < 0.72 ? "mid" : "hard";
  procRooms = procDiff === "easy" ? 4 + Math.floor(rnd() * 2) : procDiff === "mid" ? 6 + Math.floor(rnd() * 2) : 8 + Math.floor(rnd() * 3);
  procCols = procDiff === "easy" ? 84 : procDiff === "mid" ? 120 : 156;
}

function prepareProc(seed) {
  rollProc(seed);
  COLS = procCols;
}

function pickProcRoom(rnd, last) {
  const easy = ["jump2", "step", "belt", "rest"];
  const mid = ["jump2", "step", "belt", "beltgap", "ceil", "crate", "sentinel", "oil"];
  const hard = ["jump3", "beltback", "beltgap", "ceil", "crate", "sentinel", "oil", "jump2"];
  let pool = procDiff === "easy" ? easy : procDiff === "hard" ? hard : mid;
  if (last === "sentinel" || last === "crate") pool = pool.filter((k) => k !== last);
  if (last === "ceil" || last === "jump3") pool = pool.filter((k) => k !== "ceil" && k !== "jump3");
  return pool[Math.floor(rnd() * pool.length)];
}

function stampProcRoom(kind, x, fy, rnd) {
  if (kind === "jump2" || kind === "jump3") {
    const gap = kind === "jump3" ? 3 : 2;
    fillSea(x, fy + 1, gap, 4);
    rect(x + gap, fy, 7, 4, ROUGH);
    return gap + 7;
  }
  if (kind === "step") {
    rect(x, fy - 1, 6, 5, ROUGH);
    rect(x + 6, fy, 5, 4, ROUGH);
    return 11;
  }
  if (kind === "belt" || kind === "beltback") {
    rect(x, fy, 12, 4, ROUGH);
    belt(x + 1, fy, 6, kind === "beltback" ? -1 : 1);
    return 12;
  }
  if (kind === "beltgap") {
    rect(x, fy, 8, 4, ROUGH);
    belt(x + 2, fy, 6, 1);
    fillSea(x + 8, fy + 1, 2, 4);
    rect(x + 10, fy, 6, 4, ROUGH);
    return 16;
  }
  if (kind === "ceil") {
    const span = procDiff === "hard" ? 4 : 3;
    fillSea(x, fy + 1, span, 4);
    rect(x + span, fy, 7, 4, ROUGH);
    return span + 7;
  }
  if (kind === "oil") {
    rect(x, fy - 1, 6, 5, ROUGH);
    setTile(x, fy - 1, SLICK);
    setTile(x, fy, SLICK);
    rect(x + 6, fy, 5, 4, ROUGH);
    return 11;
  }
  if (kind === "crate") {
    rect(x, fy, 5, 4, ROUGH);
    const wx = x + 5;
    for (let y = 10; y <= fy - 1; y++) {
      setTile(wx, y, ROUGH);
      setTile(wx + 1, y, ROUGH);
    }
    setTile(wx, fy - 2, 0);
    setTile(wx, fy - 1, 0);
    setTile(wx + 1, fy - 2, 0);
    setTile(wx + 1, fy - 1, 0);
    ents.push({
      kind: "burn", name: "caixa", x: wx * TILE, y: (fy - 2) * TILE,
      w: 80, h: 80, hp: procDiff === "hard" ? 1.35 : 1.05, max: procDiff === "hard" ? 1.35 : 1.05,
      solid: true, dead: false,
    });
    rect(wx + 2, fy, 6, 4, ROUGH);
    return 13;
  }
  if (kind === "sentinel") {
    rect(x, fy, 14, 4, ROUGH);
    const speed = procDiff === "hard" ? 78 : 48;
    ents.push({
      kind: "attack", name: "sentinela",
      x: (x + 4) * TILE, y: fy * TILE - 64, w: 28, h: 18,
      hp: 1.2, max: 1.2, solid: false, dead: false,
      minX: (x + 2) * TILE, maxX: (x + 12) * TILE, dir: rnd() < 0.5 ? -1 : 1,
      vx: speed, baseY: fy * TILE - 64, aim: 0, bob: rnd() * 3,
    });
    return 14;
  }
  rect(x, fy, 8, 4, ROUGH);
  return 8;
}

function buildProcedural(seed) {
  phaseName = procDiff === "hard" ? "DIFÍCIL" : procDiff === "easy" ? "FÁCIL" : "MÉDIO";
  sign = { x: 4 * TILE, y: 10 * TILE };
  const rnd = mulberry32(seed ^ 0xA5A5A5A5);
  const fy = 16;
  rect(0, 0, COLS, 10, ROUGH);
  let x = 2;
  rect(x, fy, 12, 4, ROUGH);
  placeEntry(2, fy);
  spawns = [{ x: 6 * TILE, y: fy * TILE - PH, at: 0 }];
  addStar(9, fy - 1);
  x = 14;
  let last = "";
  let made = 0;
  while (made < procRooms && x + 22 < COLS) {
    const kind = pickProcRoom(rnd, last);
    const w = stampProcRoom(kind, x, fy, rnd);
    const stand = x + w - 3;
    spawns.push({ x: stand * TILE, y: fy * TILE - PH, at: (x + Math.max(1, w - 6)) * TILE });
    if (rnd() < (procDiff === "easy" ? 0.25 : 0.45)) addStar(stand - 1, fy - 1);
    x += w;
    last = kind;
    made++;
  }
  rect(x, fy, 12, 4, ROUGH);
  const doorX = Math.min(x + 6, COLS - 4);
  carveDoor(doorX, 8, fy - 1);
  exitZone = { x: (doorX + 2) * TILE, y: fy * TILE - 80, w: 90, h: 80 };
  daylight = null;
  for (let lx = 10; lx < doorX; lx += 18) lamps.push({ x: lx * TILE, y: 10 * TILE + 8 });
  goal = procDiff === "hard"
    ? "Mapa difícil. Corre antes dos vãos largos."
    : procDiff === "easy"
      ? "Mapa curto. Os vãos cabem num pulo."
      : "Mapa médio. Esteira, vão e caixa.";
}

function freshSeed() {
  try {
    const saved = JSON.parse(localStorage.getItem("gearsea-seeds") || "[]");
    for (const s of saved) usedSeeds.add(s >>> 0);
  } catch (err) { /* sem histórico */ }
  let seed = 1;
  for (let n = 0; n < 24; n++) {
    seed = (Math.floor(Math.random() * 0x7fffffff) ^ ((Date.now() + n * 997) >>> 0) ^ (Math.floor(performance.now() * 1000) >>> 0)) >>> 0;
    if (!usedSeeds.has(seed)) break;
  }
  usedSeeds.add(seed);
  try {
    const list = [...usedSeeds].slice(-240);
    localStorage.setItem("gearsea-seeds", JSON.stringify(list));
  } catch (err) { /* ignora */ }
  return seed;
}

function buildBoss() {
  phaseName = "CHEFAO";
  sign = { x: 4 * TILE, y: 13 * TILE + 6 };
  rect(0, 0, 46, 13, ROUGH);
  rect(44, 0, 4, ROWS, ROUGH);
  rect(2, 16, 42, 4, ROUGH);
  fillSea(8, 17, 3, 4);
  fillSea(30, 17, 3, 4);
  ents.push({
    kind: "boss",
    name: "nucleo",
    x: 20 * TILE,
    y: 16 * TILE - 56,
    w: 72,
    h: 56,
    solid: false,
    dead: false,
    cores: [1.15, 1.15, 1.15],
    coreMax: 1.15,
    shield: true,
    timer: 0,
    lane: 0,
    swapT: 0,
    minX: 3 * TILE,
    maxX: 34 * TILE,
    homeX: 20 * TILE,
    homeY: 16 * TILE - 56,
    ceilY: 13 * TILE,
  });
  carveDoor(40, 13, 15, { locked: true });
  placeEntry(2, 16);
  spawns = [{ x: 5 * TILE, y: 16 * TILE - PH, at: 0 }];
  exitZone = { x: 42 * TILE, y: 16 * TILE - 80, w: 70, h: 80 };
  daylight = null;
  lamps.push({ x: 12 * TILE, y: 13 * TILE + 8 });
  lamps.push({ x: 28 * TILE, y: 13 * TILE + 8 });
  goal = "";
}

function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    w: PW, h: PH,
    grounded: false,
    wall: 0,
    coyote: 0,
    jumpBuf: 0,
    sling: null,
    slingT: 0,
    arm: 1,
    aimed: false,
    padIgnore: 0,
    arc: 0,
    jumpVx: 0,
    jumpCut: 0,
    face: 1,
    hp: 4,
    heat: 0,
    over: 0,
    inv: 0,
    deadT: 0,
    burning: 0,
    walk: 0,
    onSlick: false,
    ceiling: false,
    cause: "",
    onBelt: 0,
  };
}

function spawnBurst(x, y, color, n, speed, life) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 30,
      life: life * (0.6 + Math.random() * 0.6),
      max: life,
      color,
      size: 2,
      g: 420,
    });
  }
  if (particles.length > 240) particles.splice(0, particles.length - 240);
}

function sampleSide(side) {
  const x = side < 0 ? player.x - 2 : player.x + player.w + 2;
  const ys = [player.y + 6, player.y + player.h * 0.5, player.y + player.h - 4];
  let rough = false;
  let slick = false;
  for (const y of ys) {
    const t = tile(Math.floor(x / TILE), Math.floor(y / TILE));
    if (t === ROUGH) rough = true;
    if (t === SLICK) slick = true;
  }
  return { rough: rough && !slick, slick };
}

function tryMantle() {
  if (!player.wall || !(up() || player.vy < 0)) return;
  const dir = player.wall;
  const probeX = dir < 0 ? player.x - 8 : player.x + player.w + 8;
  const headSolid = isSolidTile(tile(Math.floor(probeX / TILE), Math.floor((player.y + 2) / TILE)));
  const footT = tile(Math.floor(probeX / TILE), Math.floor((player.y + player.h - 2) / TILE));
  const above = isSolidTile(tile(Math.floor((player.x + player.w / 2) / TILE), Math.floor((player.y - 6) / TILE)));
  if (headSolid || !isSolidTile(footT) || footT === SLICK || above) return;
  const top = Math.floor((player.y + player.h - 2) / TILE) * TILE;
  const oldX = player.x;
  const oldY = player.y;
  player.x += dir < 0 ? -(player.w + 8) : player.w + 8;
  player.y = top - player.h - 1;
  if (overlapsSolid(player)) {
    player.x = oldX;
    player.y = oldY;
    return;
  }
  player.wall = 0;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  did.grab = true;
}

function moveBody(dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  let hitX = 0;
  let hitY = 0;
  for (let i = 0; i < steps; i++) {
    player.x += dx / steps;
    if (overlapsSolid(player)) {
      player.x -= dx / steps;
      const s = Math.sign(dx) || 1;
      let guard = 0;
      while (overlapsSolid(player) && guard++ < 8) player.x -= s;
      player.vx = 0;
      hitX = s;
      dx = 0;
    }
    player.y += dy / steps;
    if (overlapsSolid(player)) {
      player.y -= dy / steps;
      const s = Math.sign(dy) || 1;
      let guard = 0;
      while (overlapsSolid(player) && guard++ < 8) player.y -= s;
      if (s > 0) {
        player.grounded = true;
        if (player.vy > 420) {
          spawnBurst(player.x + player.w / 2, player.y + player.h, "#8d97a6", 6, 70, 0.25);
          tone(90, 0.05, "triangle", 0.03, 50);
        }
      }
      player.vy = 0;
      hitY = s;
      dy = 0;
    }
  }
  return { hitX, hitY };
}

function worldMouse() {
  return { x: mouse.x + cam.x, y: mouse.y + cam.y };
}

function padFace(pad) {
  return pad.x + (pad.nx > 0 ? pad.w : 0);
}

function sampleAbove() {
  const y = player.y - 1;
  const xs = [player.x + 4, player.x + player.w * 0.5, player.x + player.w - 4];
  let rough = false;
  let slick = false;
  for (const x of xs) {
    const t = tile(Math.floor(x / TILE), Math.floor(y / TILE));
    if (t === ROUGH) rough = true;
    if (t === SLICK) slick = true;
  }
  return { rough: rough && !slick, slick };
}

function dropSling() {
  player.sling = null;
  player.padIgnore = 0.15;
  player.ceiling = false;
}

function fireHook() {
  if (player.deadT > 0 || player.padIgnore > 0 || hookLock > 0) return;
  const ox = player.x + PW / 2;
  const oy = player.y + 12;
  const c = worldMouse();
  let dx = c.x - ox;
  let dy = c.y - oy;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  player.arm = dx < -0.2 ? -1 : dx > 0.2 ? 1 : player.face;
  player.face = player.arm || 1;
  const hit = raycast(ox, oy, dx, dy, 340);
  if (hit.tile === GEAR) {
    spawnBurst(hit.x, hit.y, "#c4a15a", 6, 50, 0.2);
    tone(70, 0.08, "sawtooth", 0.04, 40);
    hookLock = 0.16;
    return;
  }
  if (hit.tile === SLICK) {
    player.onSlick = true;
    did.slick = true;
    spawnBurst(hit.x, hit.y, "#9eefe4", 6, 70, 0.2);
    tone(120, 0.06, "square", 0.04, 60);
    hookLock = 0.16;
    return;
  }
  if (!isGrip(hit.tile)) {
    tone(220, 0.04, "square", 0.02, 140);
    hookLock = 0.12;
    return;
  }
  const prevX = hit.x - dx * 6;
  const prevY = hit.y - dy * 6;
  const tx = Math.floor(hit.x / TILE);
  const ty = Math.floor(hit.y / TILE);
  const rx = prevX - (tx + 0.5) * TILE;
  const ry = prevY - (ty + 0.5) * TILE;
  let nx = 0;
  let ny = 0;
  if (Math.abs(rx) > Math.abs(ry)) nx = Math.sign(rx) || 1;
  else ny = Math.sign(ry) || -1;
  const faceX = nx > 0 ? (tx + 1) * TILE : tx * TILE;
  const faceY = ny > 0 ? (ty + 1) * TILE : ty * TILE;
  player.sling = {
    hook: true, nx, ny,
    anchorX: nx !== 0 ? faceX : hit.x,
    anchorY: ny !== 0 ? faceY : hit.y,
    x: tx * TILE, y: ty * TILE, w: TILE, h: TILE,
  };
  player.slingT = 0;
  player.aimed = false;
  player.vx = 0;
  player.vy = 0;
  player.wall = 0;
  player.ceiling = false;
  player.grounded = false;
  if (nx !== 0) {
    player.x = nx > 0 ? faceX + 1 : faceX - player.w - 1;
    player.y = hit.y - player.h * 0.5;
  } else if (ny > 0) {
    player.y = faceY;
    player.x = hit.x - player.w * 0.5;
  } else {
    player.y = faceY - player.h - 1;
    player.x = hit.x - player.w * 0.5;
  }
  pinSling(0);
  if (!player.sling) return;
  tone(190, 0.07, "square", 0.05, 120);
  cam.shake = 3;
  did.grab = true;
}

function pinSling(dt) {
  const pad = player.sling;
  if (!pad) return;
  const speed = 150 * dt;
  if (pad.ny !== 0) {
    if (left()) player.x -= speed;
    if (right()) player.x += speed;
    const tx = Math.floor((player.x + player.w * 0.5) / TILE);
    const ty = pad.ny > 0
      ? Math.floor((pad.anchorY - 1) / TILE)
      : Math.floor(pad.anchorY / TILE);
    if (!isGrip(tile(tx, ty))) {
      dropSling();
      return;
    }
    pad.anchorX = (tx + 0.5) * TILE;
    if (pad.ny > 0) player.y = pad.anchorY;
    else player.y = pad.anchorY - player.h - 1;
  } else {
    if (up()) player.y -= speed;
    if (downKey()) player.y += speed;
    const ty = Math.floor((player.y + player.h * 0.5) / TILE);
    const tx = pad.nx > 0
      ? Math.floor((pad.anchorX - 1) / TILE)
      : Math.floor(pad.anchorX / TILE);
    if (!isGrip(tile(tx, ty))) {
      dropSling();
      return;
    }
    pad.anchorY = (ty + 0.5) * TILE;
    player.x = pad.nx > 0 ? pad.anchorX + 1 : pad.anchorX - player.w - 1;
  }
  player.vx = 0;
  player.vy = 0;
  player.arm = pad.anchorX < player.x + player.w * 0.5 ? -1 : 1;
  if (!overlapsSolid(player)) return;
  const ox = player.x;
  const oy = player.y;
  for (let i = 1; i <= 12; i++) {
    const d = i * 4;
    const tries = pad.nx !== 0 ? [d, -d] : [d, -d];
    for (const step of tries) {
      player.x = ox + (pad.nx !== 0 ? 0 : step);
      player.y = oy + (pad.nx !== 0 ? step : 0);
      if (!overlapsSolid(player)) return;
    }
  }
  player.x = ox;
  player.y = oy;
  dropSling();
}

function slingVector() {
  const pad = player.sling;
  let ax;
  let ay;
  const keyX = (right() ? 1 : 0) - (left() ? 1 : 0);
  const keyY = (downKey() ? 1 : 0) - (up() ? 1 : 0);
  if (keyX || keyY) {
    ax = keyX || pad.nx * 0.4;
    ay = keyY;
  } else if (player.aimed) {
    const c = worldMouse();
    ax = c.x - (player.x + player.w / 2);
    ay = c.y - (player.y + player.h / 2);
  } else if (pad.ny > 0) {
    ax = player.face || 1;
    ay = 0.2;
  } else {
    ax = pad.nx || player.face || 1;
    ay = pad.ny || -0.36;
  }
  let len = Math.hypot(ax, ay) || 1;
  ax /= len;
  ay /= len;
  const dot = ax * pad.nx + ay * pad.ny;
  if (dot < 0.05) {
    ax = ax * 0.35 + pad.nx;
    ay = ay * 0.35 + pad.ny;
    len = Math.hypot(ax, ay) || 1;
    ax /= len;
    ay /= len;
  }
  return { ax, ay };
}

function launchVelocity() {
  const aim = slingVector();
  const pad = player.sling;
  let vx = aim.ax * LAUNCH;
  let vy = aim.ay * LAUNCH;
  if (pad && pad.ny > 0) {
    if (vy < 80) vy = 220;
  } else if (aim.ay > -0.25 && aim.ay < 0.35) {
    vy = Math.min(vy, -280);
  }
  return { vx, vy };
}

function releaseSling() {
  const fly = launchVelocity();
  player.vx = fly.vx;
  player.vy = fly.vy;
  player.jumpVx = player.vx;
  player.sling = null;
  player.padIgnore = 0.45;
  player.arc = 0.45;
  player.grounded = false;
  player.wall = 0;
  did.sling = true;
  cam.shake = 6;
  tone(210, 0.12, "square", 0.05, 90);
  spawnBurst(player.x, player.y + 12, "#f2c14b", 8, 140, 0.3);
}

function left() { return down.KeyA || down.ArrowLeft; }
function right() { return down.KeyD || down.ArrowRight; }
function up() { return down.KeyW || down.ArrowUp; }
function downKey() { return down.KeyS || down.ArrowDown; }

function wishDir() {
  return (right() ? 1 : 0) - (left() ? 1 : 0);
}

function steer(dt, wish, rate) {
  const delta = wish - player.vx;
  if (Math.abs(delta) < 0.5) {
    player.vx = wish;
    return;
  }
  const step = Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
  player.vx += step;
}

function commitJump() {
  const dir = wishDir();
  const spd = player.vx;
  const abs = Math.abs(spd);
  const reverse = dir && abs > 50 && Math.sign(spd) !== dir;
  let vertical = 575 - Math.min(110, abs * 0.28);
  let vx = spd;
  if (!dir) vx *= 0.94;
  else if (reverse) {
    vx = dir * (130 + abs * 0.45);
    vertical += 24;
  } else if (abs > 50) vx = dir * Math.min(325, abs + 36);
  else vx = dir * 128;
  if (downKey()) vertical *= 0.52;
  player.vx = vx;
  player.vy = -vertical;
  player.jumpVx = vx;
  player.jumpCut = 0.1;
  player.grounded = false;
  player.coyote = 0;
  player.jumpBuf = 0;
  player.arc = 0;
  spawnBurst(player.x + player.w / 2 - dir * 3, player.y + player.h, "#c8d0da", abs > 140 ? 6 : 3, 40 + abs * 0.12, 0.16);
  tone(320 + abs * 0.4, 0.05, "square", 0.03, 160);
}

function commitWallJump() {
  const away = -player.wall;
  const holdOut = (away < 0 && left()) || (away > 0 && right());
  const holdIn = (player.wall < 0 && left()) || (player.wall > 0 && right());
  let vx;
  let vy;
  if (holdIn && !holdOut) {
    vx = away * 64;
    vy = -540;
  } else if (holdOut) {
    vx = away * 250;
    vy = -470;
  } else {
    vx = away * 150;
    vy = -520;
  }
  player.vx = vx;
  player.vy = vy;
  player.jumpVx = vx;
  player.wall = 0;
  player.grounded = false;
  player.jumpBuf = 0;
  player.arc = 0;
  player.jumpCut = 0.08;
  player.coyote = 0;
  tone(360, 0.07, "square", 0.04, 160);
}

function updateCeiling(dt) {
  const dir = wishDir();
  if (dir) steer(dt, dir * 180, 1200);
  else {
    player.vx *= Math.exp(-dt * 8);
    if (Math.abs(player.vx) < 6) player.vx = 0;
  }
  player.vy = 0;
  if (pressed.Space || pressed.KeyS || pressed.ArrowDown) {
    player.ceiling = false;
    player.vy = 180;
    player.jumpBuf = 0;
    return;
  }
  moveBody(player.vx * dt, 0);
  if (!sampleAbove().rough) player.ceiling = false;
  else player.vy = 0;
  if (Math.abs(player.vx) > 20) player.walk += dt * Math.abs(player.vx) * 0.02;
  if (Math.abs(player.vx) > 12) player.face = Math.sign(player.vx);
  if (player.y > ROWS * TILE + 40) kill();
  updateHazards(dt);
  updateCheckpoint();
}

function updatePlayer(dt) {
  if (player.deadT > 0) {
    player.deadT -= dt;
    player.vx = 0;
    player.vy += GRAV * dt;
    moveBody(0, player.vy * dt);
    if (player.deadT <= 0) respawn();
    return;
  }

  player.padIgnore = Math.max(0, player.padIgnore - dt);
  player.inv = Math.max(0, player.inv - dt);
  player.burning = Math.max(0, player.burning - dt);
  player.arc = Math.max(0, player.arc - dt);
  player.jumpCut = Math.max(0, player.jumpCut - dt);
  if (player.jumpCut > 0 && player.vy < -60 && !down.Space && !down.KeyW && !down.ArrowUp) {
    player.vy *= 0.5;
    player.jumpCut = 0;
  }

  const onCeiling = player.ceiling || (player.sling && player.sling.ny > 0);
  if (player.over > 0) {
    player.over -= dt;
    player.heat = Math.max(0, player.heat - 55 * dt);
  } else if (!mouse.right || (player.sling && !onCeiling)) {
    player.heat = Math.max(0, player.heat - 38 * dt);
  }

  player.onBelt = 0;
  hookLock = Math.max(0, hookLock - dt);
  if (player.sling && (mouse.pressed || pressed.KeyE) && player.slingT > 0.12) releaseSling();
  else if (!player.sling && mouse.pressed) fireHook();

  if (player.sling) {
    player.slingT += dt;
    pinSling(dt);
    if (mouse.moved) player.aimed = true;
    player.face = player.arm;
    return;
  }

  if (player.ceiling) {
    updateCeiling(dt);
    return;
  }

  const dir = wishDir();
  const beltDir = player.grounded ? beltUnder() : 0;
  player.onBelt = beltDir;
  if (player.grounded) {
    const carry = beltDir * 160;
    if (dir) {
      const turning = Math.abs(player.vx) > 30 && Math.sign(player.vx) !== dir;
      steer(dt, dir * WALK + carry, turning ? 2200 : 1450);
    } else steer(dt, carry, 800);
  } else if (dir) {
    const cap = Math.max(Math.abs(player.jumpVx) + 24, WALK * 0.85);
    const wish = dir * cap;
    steer(dt, wish, player.arc > 0 ? 80 : 160);
  } else if (player.arc <= 0) {
    player.vx *= Math.exp(-dt * 0.45);
  }

  player.vy += GRAV * dt;
  if (player.vy > 900) player.vy = 900;

  if (pressed.Space || pressed.KeyW || pressed.ArrowUp) player.jumpBuf = 0.12;
  else player.jumpBuf = Math.max(0, player.jumpBuf - dt);

  player.grounded = false;
  const hit = moveBody(player.vx * dt, player.vy * dt);
  player.onSlick = false;
  const above = sampleAbove();
  if (above.slick && !player.grounded && hit.hitY < 0) {
    player.onSlick = true;
    did.slick = true;
  }
  if (above.rough && !player.grounded && hit.hitY < 0 && player.padIgnore <= 0) {
    player.ceiling = true;
    player.vy = 0;
    player.wall = 0;
    did.grab = true;
  }

  const sideL = sampleSide(-1);
  const sideR = sampleSide(1);
  if (player.ceiling) {
    player.wall = 0;
  } else if (!player.grounded) {
    const intoL = left() || player.vx < -35;
    const intoR = right() || player.vx > 35;
    const grabL = sideL.rough && (intoL || (player.wall === -1 && !right()));
    const grabR = sideR.rough && (intoR || (player.wall === 1 && !left()));
    if (grabL && !(grabR && right())) {
      player.wall = -1;
      if (player.arc <= 0) player.vx = 0;
      did.grab = true;
    } else if (grabR) {
      player.wall = 1;
      if (player.arc <= 0) player.vx = 0;
      did.grab = true;
    } else player.wall = 0;

    if ((sideL.slick && (left() || player.vx < 0)) || (sideR.slick && (right() || player.vx > 0))) {
      player.onSlick = true;
      did.slick = true;
      player.wall = 0;
      player.vy = Math.max(player.vy, 280);
    }
  } else player.wall = 0;

  if (player.wall && player.arc <= 0) {
    if (up()) player.vy = -155;
    else if (downKey()) player.vy = 230;
    else player.vy = Math.min(player.vy, 42);
    if (pressed.Space || pressed.KeyW || pressed.ArrowUp) commitWallJump();
    else tryMantle();
    if (Math.random() < dt * 14) {
      const hx = player.wall < 0 ? player.x - 2 : player.x + player.w + 2;
      spawnBurst(hx, player.y + 16, "#d7dde6", 1, 30, 0.12);
    }
  }

  if (player.grounded) player.coyote = 0.1;
  else player.coyote = Math.max(0, player.coyote - dt);

  if (player.jumpBuf > 0 && !player.wall && (player.grounded || player.coyote > 0)) commitJump();
  else if (player.grounded) {
    player.jumpVx = player.vx;
    player.arc = 0;
  }

  if (Math.abs(player.vx) > 20 && player.grounded) player.walk += dt * Math.abs(player.vx) * 0.02;
  if (player.sling) player.face = player.arm * -1 || 1;
  else if (Math.abs(player.vx) > 12) player.face = Math.sign(player.vx);
  else player.face = worldMouse().x >= player.x + player.w / 2 ? 1 : -1;

  if (player.y > ROWS * TILE + 40) kill();
  updateHazards(dt);
  updateCheckpoint();
}

function tileOverlaps(kind) {
  const x0 = Math.floor(player.x / TILE);
  const y0 = Math.floor(player.y / TILE);
  const x1 = Math.floor((player.x + player.w - 0.01) / TILE);
  const y1 = Math.floor((player.y + player.h - 0.01) / TILE);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) if (tile(x, y) === kind) return true;
  }
  return false;
}

function updateHazards(dt) {
  if (tileOverlaps(GEAR)) {
    kill("gear");
    return;
  }
  for (const e of ents) {
    if (e.kind !== "star" || e.dead) continue;
    if (!aabb(player, e)) continue;
    e.dead = true;
    spawnBurst(e.x + 8, e.y + 8, "#f2c14b", 8, 80, 0.28);
    tone(660, 0.08, "square", 0.04, 880);
  }
  for (const e of ents) {
    if (e.dead || e.kind !== "attack") continue;
    if (aabb(player, e)) hurt(1, e.x);
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (aabb(player, { x: b.x - 4, y: b.y - 4, w: 8, h: 8 })) {
      bullets.splice(i, 1);
      hurt(1, b.x);
    }
  }
}

function hurt(n, fromX) {
  if (player.inv > 0 || player.deadT > 0 || mode !== "play") return;
  player.hp -= n;
  player.inv = 1.05;
  player.vy = -260;
  player.vx = Math.sign(player.x - fromX) * 210 || 180;
  player.jumpVx = player.vx;
  player.wall = 0;
  player.ceiling = false;
  player.sling = null;
  cam.shake = 8;
  flash = 0.22;
  tone(90, 0.12, "sawtooth", 0.06, 40);
  if (player.hp <= 0) {
    player.hp = 0;
    player.deadT = 0.7;
    spawnBurst(player.x + 10, player.y + 10, "#ffb089", 12, 160, 0.4);
  }
}

function kill(reason) {
  if (player.deadT > 0) return;
  player.hp = 0;
  player.deadT = 0.65;
  player.cause = reason || "";
  player.wall = 0;
  player.ceiling = false;
  player.sling = null;
  cam.shake = 10;
  flash = 0.3;
  spawnBurst(player.x + 10, player.y + 14, "#ffd0a8", 14, 180, 0.45);
  tone(60, 0.22, "sawtooth", 0.05, 28);
}

function respawn() {
  const s = spawns[spawnIndex];
  player = makePlayer(s.x, s.y);
  player.inv = 1.1;
  bullets.length = 0;
  for (const e of ents) {
    if (e.kind === "boss" && !e.dead) {
      e.x = e.homeX;
      e.y = e.homeY;
      e.lane = 0;
      e.swapT = 0;
      e.timer = 0;
      e.shield = true;
      e.cores = e.cores.map(() => e.coreMax);
    }
    if (e.kind === "attack" && e.hp > 0) {
      e.hp = e.max;
      e.aim = 0;
      e.x = (e.minX + e.maxX) / 2;
    }
  }
}

function updateCheckpoint() {
  if (player.sling || !player.grounded) return;
  for (let i = spawns.length - 1; i > spawnIndex; i--) {
    const s = spawns[i];
    const there = player.x > s.at;
    if (there) {
      spawnIndex = i;
      tone(520, 0.06, "square", 0.025, 700);
      break;
    }
  }
}

function bossCores(e) {
  return [
    { i: 0, x: e.x + 10, y: e.y + 32 },
    { i: 1, x: e.x + e.w * 0.5, y: e.y + 40 },
    { i: 2, x: e.x + e.w - 10, y: e.y + 32 },
  ];
}

function updateBoss(e, dt) {
  if (e.dead) return;
  e.timer += dt;
  e.swapT = (e.swapT || 0) + dt;
  const cycle = 6.6;
  const t = e.timer % cycle;
  e.shield = t < 4.2;
  const floorY = 16 * TILE - e.h;
  const ceilY = e.ceilY;
  const speed = e.shield ? 100 : 160;
  const dx = (player.x + player.w * 0.5) - (e.x + e.w * 0.5);
  e.x += Math.sign(dx || 1) * Math.min(Math.abs(dx), speed * dt);
  if (e.x < e.minX) e.x = e.minX;
  if (e.x > e.maxX) e.x = e.maxX;
  const targetY = e.lane ? ceilY : floorY;
  const dy = targetY - e.y;
  e.y += Math.sign(dy || 1) * Math.min(Math.abs(dy), 320 * dt);
  const settled = Math.abs(dy) < 3;
  if (settled) e.y = targetY;
  if (settled && e.swapT > 2.6) {
    const want = player.y + player.h < 13 * TILE ? 1 : 0;
    if (want !== e.lane || e.swapT > 4.4) {
      e.lane = e.lane ? 0 : 1;
      e.swapT = 0;
    }
  }
  if (player.deadT <= 0 && aabb(player, e)) hurt(1, e.x + e.w * 0.5);
}

function updateEnts(dt) {
  for (const e of ents) {
    if (e.kind === "boss") updateBoss(e, dt);
    if ((e.role === "door" || e.role === "entry") && e.dead) e.open = Math.min(1, (e.open || 0) + dt * 1.6);
  }
  for (const e of ents) {
    if (e.dead || e.kind !== "attack") continue;
    e.bob += dt;
    e.x += e.dir * e.vx * dt;
    if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
    if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
    e.y = e.baseY + Math.sin(e.bob * 2.2) * 8;
    const see = Math.abs(e.y - player.y) < 100 && Math.abs(e.x - player.x) < 340 && player.deadT <= 0;
    if (see) {
      e.aim += dt;
      if (e.aim > 0.75 && e.aim - dt <= 0.75) {
        const ang = Math.atan2(player.y + 10 - (e.y + 8), player.x + 10 - (e.x + 14));
        bullets.push({
          x: e.x + 14,
          y: e.y + 8,
          vx: Math.cos(ang) * 230,
          vy: Math.sin(ang) * 230,
          life: 3,
        });
        tone(280, 0.05, "square", 0.025, 160);
      }
      if (e.aim > 2.4) e.aim = 0;
    } else e.aim = Math.max(0, e.aim - dt * 2);
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const tx = Math.floor(b.x / TILE);
    const ty = Math.floor(b.y / TILE);
    if (b.life <= 0 || isSolidTile(tile(tx, ty))) bullets.splice(i, 1);
  }
}

function eyePos() {
  return {
    x: player.x + PW / 2 + player.face * 3,
    y: player.y + 12,
  };
}

function raycast(x, y, dx, dy, maxDist) {
  const step = 5;
  const n = Math.ceil(maxDist / step);
  let px = x;
  let py = y;
  for (let i = 0; i < n; i++) {
    px += dx * step;
    py += dy * step;
    const t = tile(Math.floor(px / TILE), Math.floor(py / TILE));
    if (t === GEAR || isSolidTile(t)) return { x: px, y: py, tile: t, ent: null };
    for (const e of ents) {
      if (e.dead) continue;
      if (e.kind === "attack" || e.kind === "boss" || e.solid) {
        if (px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h) {
          return { x: px, y: py, tile: 0, ent: e };
        }
      }
    }
    for (const b of bullets) {
      if (Math.hypot(b.x - px, b.y - py) < 8) return { x: px, y: py, tile: 0, ent: null, bullet: b };
    }
  }
  return { x: x + dx * maxDist, y: y + dy * maxDist, tile: 0, ent: null };
}

let beam = null;
let laserSnd = 0;
let fireLock = 0;
let hookLock = 0;

function updateLaser(dt) {
  beam = null;
  fireLock = Math.max(0, fireLock - dt);
  const onCeiling = player.ceiling || (player.sling && player.sling.ny > 0);
  if ((player.sling && !onCeiling) || player.deadT > 0 || mode !== "play") return;
  const firing = (mouse.right || down.KeyF || down.KeyJ) && fireLock <= 0;
  if (!firing || player.over > 0) return;
  player.heat += 48 * dt;
  if (player.heat >= 100) {
    player.heat = 100;
    player.over = 1.05;
    tone(80, 0.12, "square", 0.04, 40);
    return;
  }
  const eye = eyePos();
  const c = worldMouse();
  let dx = c.x - eye.x;
  let dy = c.y - eye.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const hit = raycast(eye.x, eye.y, dx, dy, 460);
  beam = { x0: eye.x, y0: eye.y, x1: hit.x, y1: hit.y, hit };
  if (Math.random() < 0.45) spawnBurst(hit.x, hit.y, "#ffd0c8", 1, 40, 0.1);
  if (hit.bullet) {
    const idx = bullets.indexOf(hit.bullet);
    if (idx >= 0) bullets.splice(idx, 1);
    spawnBurst(hit.x, hit.y, "#ff8a7a", 4, 70, 0.18);
  }
  if (hit.ent && hit.ent.kind === "boss") hitBoss(hit.ent, hit.x, hit.y, dx, dy, dt);
  else if (hit.ent && hit.ent.locked) {
    if (Math.random() < 0.4) spawnBurst(hit.x, hit.y, "#9ee7ff", 2, 40, 0.1);
  } else if (hit.ent && hit.ent.hp != null) {
    hit.ent.hp -= dt;
    player.burning = 0.1;
    const col = hit.ent.kind === "burn" ? "#ff9a3c" : hit.ent.kind === "destroy" ? "#d7c4ff" : "#ff5a4a";
    if (Math.random() < 0.4) spawnBurst(hit.x, hit.y, col, 1, 60, 0.16);
    if (hit.ent.hp <= 0) destroyEnt(hit.ent);
  }
  if (time - laserSnd > 0.11) {
    laserSnd = time;
    tone(hit.ent ? 720 : 880, 0.03, "square", 0.012, 640);
  }
}

function hitBoss(e, x, y, dx, dy, dt) {
  if (e.dead) return;
  let best = null;
  let bestD = 18;
  for (const core of bossCores(e)) {
    if (e.cores[core.i] <= 0) continue;
    const along = (core.x - x) * dx + (core.y - y) * dy;
    if (along < -8) continue;
    const d = Math.hypot(core.x - (x + dx * along), core.y - (y + dy * along));
    if (d < bestD) {
      best = core;
      bestD = d;
    }
  }
  if (e.shield || !best) {
    spawnBurst(x, y, "#d7c08a", 3, 40, 0.12);
    tone(180, 0.04, "square", 0.02, 90);
    return;
  }
  e.cores[best.i] -= dt * 0.9;
  player.burning = 0.1;
  if (Math.random() < 0.5) spawnBurst(best.x, best.y, "#ff5a3a", 2, 50, 0.14);
  if (e.cores.every((v) => v <= 0)) {
    e.dead = true;
    e.solid = false;
    cam.shake = 10;
    spawnBurst(e.x + e.w / 2, e.y + 20, "#e2b84a", 22, 170, 0.5);
    tone(80, 0.22, "sawtooth", 0.06, 36);
    const sw = ents.find((d) => d.role === "switch");
    if (sw && !sw.dead) destroyEnt(sw);
    else openDoor();
  }
}

function openDoor() {
  const door = ents.find((d) => d.role === "door");
  if (!door || door.dead) return;
  door.dead = true;
  door.solid = false;
  cam.shake = 5;
  spawnBurst(door.x + door.w / 2, door.y + 20, "#9ee7ff", 10, 90, 0.3);
  tone(220, 0.1, "square", 0.04, 440);
}

function destroyEnt(e) {
  e.dead = true;
  e.solid = false;
  cam.shake = 6;
  if (e.role === "switch") {
    did.burn = true;
    spawnBurst(e.x + e.w / 2, e.y + e.h / 2, "#9ee7ff", 12, 120, 0.35);
    tone(160, 0.12, "square", 0.04, 80);
    openDoor();
  } else if (e.kind === "burn") {
    did.burn = true;
    spawnBurst(e.x + e.w / 2, e.y + e.h / 2, "#ff7a32", 14, 140, 0.4);
    tone(140, 0.16, "sawtooth", 0.045, 50);
  } else if (e.kind === "destroy") {
    spawnBurst(e.x + e.w / 2, e.y + e.h / 2, "#d9c6ff", 14, 140, 0.4);
    tone(110, 0.18, "square", 0.045, 40);
  } else if (e.kind === "attack") {
    did.attack = true;
    spawnBurst(e.x + 12, e.y + 8, "#ff5a4a", 10, 120, 0.35);
    tone(100, 0.12, "square", 0.04, 45);
  }
}

function finishPhase() {
  player.vx = 0;
  player.vy = 0;
  player.sling = null;
  player.ceiling = false;
  if (runKind === "proc" || phase >= 3) {
    mode = "win";
    tone(523, 0.16, "square", 0.05, 784);
    setTimeout(() => tone(659, 0.2, "square", 0.05, 880), 140);
    return;
  }
  phase += 1;
  build();
  mode = "play";
  frameCamera();
  flash = 0.3;
  tone(523, 0.1, "square", 0.04, 660);
}

function updateWin() {
  const door = ents.find((e) => e.role === "door");
  if (!door || !door.dead) return;
  if (aabb(player, door)) finishPhase();
}

function nearPad() {
  return pads.some((pad) => {
    const face = padFace(pad);
    return Math.hypot(face - (player.x + player.w / 2), pad.y + pad.h * 0.5 - player.y) < 120;
  });
}

function updateHint() {
  if (player.onBelt) {
    hint = player.onBelt > 0
      ? "Esteira para a direita. Pula antes do fim, ou anda contra."
      : "Esteira para a esquerda. Pula antes do fim, ou anda contra.";
    return;
  }
  if (player.sling) {
    hint = "Mira com o mouse ou com as setas. Clique de novo, ou E, estilinga.";
    return;
  }
  if (player.ceiling) {
    hint = "Grudado no teto. A D anda. Espaço solta.";
    return;
  }
  if (player.over > 0) {
    hint = "O olho esquentou. Espera um segundo.";
    return;
  }
  if (player.onSlick) {
    hint = "Óleo. O gancho não entra nessa superfície.";
    return;
  }
  if (player.wall) {
    hint = "Segura o lado da parede para subir. Espaço empurra para fora.";
    return;
  }
  const panel = ents.find((e) => e.role === "switch" && !e.dead && Math.hypot(e.x - player.x, e.y - player.y) < 180);
  if (panel) {
    hint = panel.locked
      ? "A caixa elétrica ainda está ligada no chefão."
      : "Clique direito queima a caixa elétrica. A porta abre.";
    return;
  }
  const burnable = ents.some((e) => !e.dead && e.kind === "burn" && Math.hypot(e.x - player.x, e.y - player.y) < 200);
  if (burnable) {
    hint = "Clique direito queima. Segura até abrir.";
    return;
  }
  hint = "Clique esquerdo gancho  ·  de novo estilinga  ·  direito queima";
}

function updateGoal() {
  const door = ents.find((e) => e.role === "door");
  const crate = ents.find((e) => e.name === "caixa");
  const panel = ents.find((e) => e.role === "switch");
  if (runKind === "proc") {
    if (player.x < 16 * TILE) goal = phaseName + ". Este mapa não se repete.";
    else if (panel && !panel.dead && player.x > (COLS - 24) * TILE) goal = "Queima a caixa elétrica. A porta abre.";
    else if (player.x > (COLS - 18) * TILE) goal = "Entra na porta.";
    else goal = procDiff === "hard" ? "Vãos largos e esteira contra. Corre antes de pular." : "Vãos curtos. A esteira empurra, o laser abre a caixa.";
    return;
  }
  if (phase >= 3) {
    const boss = ents.find((e) => e.kind === "boss");
    if (boss && !boss.dead) goal = "Ele corre na esteira do chão e na do teto. Laser nos núcleos quando o escudo cair.";
    else goal = "Entra na porta.";
    return;
  }
  if (phase === 1) {
    if (player.x < 22 * TILE) goal = "Corre e pula. O vão é curto.";
    else if (player.x < 48 * TILE) goal = "Sobe os degraus. A esteira empurra o próximo pulo.";
    else if (crate && !crate.dead) goal = "Laser na caixa. O corredor abre.";
    else if (panel && !panel.dead) goal = "Queima a caixa elétrica. A porta abre.";
    else goal = "Entra na porta. A linha vem depois.";
    return;
  }
  if (phase === 2) {
    if (player.x < 16 * TILE) goal = "O teto é óleo. A esteira puxa para trás. Anda contra e pula o vão.";
    else if (player.x < 34 * TILE) goal = "Essa esteira te leva. Pula no fim e gancho no muro.";
    else if (player.x < 58 * TILE) goal = "A esteira devolve para o mar. Não solta o passo.";
    else if (crate && !crate.dead) goal = "Clique direito queima a caixa.";
    else if (panel && !panel.dead) goal = "Queima a caixa elétrica. A porta abre.";
    else goal = "Entra na porta.";
    return;
  }
  if (player.x < 21 * TILE && player.y > 15 * TILE) goal = "O vão pede corrida. Parado, esse pulo fica curto.";
  else if (player.x < 34 * TILE) goal = "Óleo escorrega. Rebite segura. O teto também gruda.";
  else if (player.x < 57 * TILE) goal = "Clique esquerdo numa parede ou no teto. Clique de novo voa.";
  else if (crate && !crate.dead) goal = "Clique direito queima a madeira.";
  else if (panel && !panel.dead) goal = "Queima a caixa elétrica. A porta abre.";
  else goal = "Entra na porta. A galeria vem depois.";
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  cam.shake = Math.max(0, cam.shake - dt * 18);
}

function frameCamera() {
  const vw = viewW;
  const vh = viewH;
  const look = worldMouse();
  const body = player.y + player.h * 0.5;
  let destX = player.x + player.w / 2 - vw * 0.38 + Math.max(-24, Math.min(24, (look.x - player.x) * 0.04));
  let destY = body - vh * 0.55;
  const lowest = body - vh + player.h;
  const highest = body - player.h;
  if (destY < lowest) destY = lowest;
  if (destY > highest) destY = highest;
  const maxX = Math.max(0, COLS * TILE - vw);
  const maxY = Math.max(0, ROWS * TILE - vh);
  cam.x = Math.max(0, Math.min(maxX, destX));
  cam.y = Math.max(0, Math.min(maxY, destY));
  cam.x = Math.round(cam.x);
  cam.y = Math.round(cam.y);
}

function updatePlay(dt) {
  if (paused) return;
  updatePlayer(dt);
  if (mode !== "play") return;
  updateEnts(dt);
  updateLaser(dt);
  updateParticles(dt);
  updateHint();
  updateGoal();
  updateWin();
  const vw = viewW;
  const vh = viewH;
  const look = worldMouse();
  const body = player.y + player.h * 0.5;
  const destX = player.x + player.w / 2 - vw * 0.38 + Math.max(-24, Math.min(24, (look.x - player.x) * 0.04));
  let destY = body - vh * 0.55;
  const lowest = body - vh + player.h;
  const highest = body - player.h;
  if (destY < lowest) destY = lowest;
  if (destY > highest) destY = highest;
  const k = 1 - Math.exp(-dt * 8);
  cam.x += (destX - cam.x) * k;
  cam.y += (destY - cam.y) * k;
  const maxX = Math.max(0, COLS * TILE - vw);
  const maxY = Math.max(0, ROWS * TILE - vh);
  cam.x = Math.max(0, Math.min(maxX, cam.x));
  cam.y = Math.max(0, Math.min(maxY, cam.y));
  cam.x = Math.round(cam.x);
  cam.y = Math.round(cam.y);
}

function pixLine(x0, y0, x1, y1, col, size) {
  ctx.fillStyle = col;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  const s = size || 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), s, s);
  }
}

function drawBackdrop() {
  ctx.fillStyle = "#10161e";
  ctx.fillRect(0, 0, viewW, viewH);
  const sox = Math.floor(cam.x * 0.08);
  const soy = Math.floor(cam.y * 0.05);
  for (let i = 0; i < 80; i++) {
    const span = viewW + 60;
    const sx = ((i * 97) % span) - (sox % span);
    const sy = ((i * 53) % Math.floor(viewH * 0.72)) - (soy % 36);
    const twinkle = ((Math.floor(time * 2) + i) % 8) === 0;
    ctx.fillStyle = twinkle ? "#f6f1e4" : (i % 3 === 0 ? "#d7c08a" : "#8ea0b4");
    const s = i % 11 === 0 ? 2 : 1;
    ctx.fillRect(sx, sy, s, s);
    if (i % 6 === 0) {
      ctx.fillRect(sx - 2, sy, 1, 1);
      ctx.fillRect(sx + s + 1, sy, 1, 1);
      ctx.fillRect(sx, sy - 2, 1, 1);
      ctx.fillRect(sx, sy + s + 1, 1, 1);
    }
  }
  ctx.fillStyle = "#1a2430";
  ctx.fillRect(0, Math.floor(viewH * 0.62), viewW, viewH);

  const ox = Math.floor(cam.x * 0.4);
  const oy = Math.floor(cam.y * 0.25);
  ctx.fillStyle = "#243140";
  for (let i = -1; i < viewW / 36 + 2; i++) {
    const x = i * 36 - (ox % 36);
    ctx.fillRect(x, 0, 8, viewH);
    ctx.fillStyle = "#314052";
    ctx.fillRect(x, 0, 8, 4);
    ctx.fillStyle = "#243140";
  }

  ctx.fillStyle = "#3e6a58";
  for (let i = -1; i < viewW / 52 + 2; i++) {
    const x = 10 + i * 52 - (ox % 52);
    const y = 18 + ((i * 17) % 24) - (oy % 48);
    ctx.fillRect(x, y, 10, 16);
    ctx.fillStyle = "#d8e2c8";
    ctx.fillRect(x + 2, y + 3, 2, 2);
    ctx.fillRect(x + 6, y + 8, 2, 2);
    ctx.fillStyle = "#3e6a58";
  }

  drawBackdropBelts(ox, oy);
  ctx.fillStyle = "#2a3848";
  const pipeY = 28 - (oy % 40);
  ctx.fillRect(0, pipeY, viewW, 4);
  ctx.fillStyle = "#415468";
  for (let i = -1; i < viewW / 24 + 2; i++) ctx.fillRect(i * 24 - (ox % 24), pipeY - 2, 4, 8);

  const gx = 120 - (ox % 220);
  const gy = 70 - Math.floor(oy * 0.3);
  ctx.fillStyle = "#1c2834";
  for (let i = 0; i < 8; i++) {
    const a = time * 0.35 + (i / 8) * Math.PI * 2;
    ctx.fillRect(Math.round(gx + Math.cos(a) * 22), Math.round(gy + Math.sin(a) * 22), 8, 8);
  }
  ctx.fillStyle = "#314050";
  ctx.fillRect(gx - 6, gy - 6, 14, 14);
  ctx.fillStyle = "#8fb9a4";
  ctx.fillRect(gx - 2, gy - 2, 4, 4);
}

function drawTiles() {
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const x1 = Math.min(COLS, Math.ceil((cam.x + viewW) / TILE) + 2);
  const y1 = Math.min(ROWS, Math.ceil((cam.y + viewH) / TILE) + 2);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const t = tile(x, y);
      if (!t) continue;
      const px = x * TILE;
      const py = y * TILE;
      if (t === GEAR) {
        drawGearTile(px, py, x, y);
        continue;
      }
      if (t === BELT_R || t === BELT_L) {
        drawBeltTile(px, py, t === BELT_R ? 1 : -1);
        continue;
      }
      if (t === SLICK) {
        ctx.fillStyle = "#14343a";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#1f4c52";
        ctx.fillRect(px, py + 8, TILE, 8);
        ctx.fillStyle = "#9eefe4";
        ctx.fillRect(px, py, TILE, 4);
        ctx.fillRect(px + 4, py + 16, 14, 2);
        ctx.fillRect(px + 22, py + 26, 12, 2);
        continue;
      }
      const openUp = y > 0 && !isSolidTile(tile(x, y - 1));
      const openDown = y + 1 < ROWS && !isSolidTile(tile(x, y + 1));
      ctx.fillStyle = (x + y) % 2 === 0 ? "#3c4a58" : "#34424e";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#24303a";
      ctx.fillRect(px, py + 18, TILE, 2);
      ctx.fillRect(px + 18, py, 2, TILE);
      if (openUp) {
        ctx.fillStyle = "#7d8c9c";
        ctx.fillRect(px, py, TILE, 4);
        ctx.fillStyle = "#8ea0b0";
        ctx.fillRect(px + 6, py + 8, 4, 4);
        ctx.fillRect(px + 28, py + 22, 4, 4);
      } else ctx.fillRect(px + 8, py + 8, 4, 4);
      if (openDown) {
        ctx.fillStyle = "#6d7e90";
        ctx.fillRect(px, py + TILE - 12, TILE, 12);
        ctx.fillStyle = "#d7dee6";
        ctx.fillRect(px, py + TILE - 3, TILE, 3);
      }
    }
  }
}

function drawBackdropBelts(ox, oy) {
  const bands = [
    { y: 46 - (oy % 30), speed: 28, dir: 1 },
    { y: 78 - (oy % 24), speed: 18, dir: -1 },
  ];
  for (const band of bands) {
    ctx.fillStyle = "#241c14";
    ctx.fillRect(0, band.y, viewW, 12);
    ctx.fillStyle = "#5c5348";
    ctx.fillRect(0, band.y, viewW, 2);
    ctx.fillRect(0, band.y + 10, viewW, 2);
    const scroll = Math.floor(time * band.speed) * band.dir;
    const step = 52;
    const shift = ((Math.floor(ox * 0.15) + scroll) % step + step) % step;
    for (let i = -2; i < viewW / step + 3; i++) {
      const x = Math.round(i * step - shift);
      if ((i & 1) === 0) drawBgCargo(x + 6, band.y - 10);
      else drawBgBot(x + 10, band.y - 12, band.dir);
    }
  }
}

function drawBgCargo(x, y) {
  ctx.fillStyle = "#6a3a1c";
  ctx.fillRect(x, y, 18, 12);
  ctx.fillStyle = "#c4844a";
  ctx.fillRect(x + 2, y + 2, 14, 3);
  ctx.fillStyle = "#3a2414";
  ctx.fillRect(x + 8, y + 2, 2, 8);
  ctx.fillRect(x + 2, y + 6, 14, 2);
}

function drawBgBot(x, y, dir) {
  ctx.fillStyle = "#9aa6b4";
  ctx.fillRect(x - 2, y + 6, 3, 2);
  ctx.fillRect(x + 11, y + 8, 3, 2);
  ctx.fillStyle = "#121820";
  ctx.fillRect(x + 1, y + 3, 10, 9);
  ctx.fillStyle = "#2c3846";
  ctx.fillRect(x + 2, y + 4, 8, 7);
  ctx.fillStyle = "#3aa0ff";
  ctx.fillRect(x + (dir > 0 ? 6 : 3), y + 6, 3, 3);
}

function drawBeltTile(px, py, dir) {
  ctx.fillStyle = "#3a3228";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#1a1612";
  ctx.fillRect(px + 2, py + 8, TILE - 4, 22);
  ctx.fillStyle = "#6a5430";
  ctx.fillRect(px, py, TILE, 2);
  ctx.fillRect(px, py + 8, TILE, 2);
  ctx.fillStyle = dir > 0 ? "#e2b84a" : "#8ec8c4";
  const scroll = Math.floor(time * 40) * dir;
  for (let i = 0; i < 4; i++) {
    const sx = px + ((i * 10 + scroll) % TILE + TILE) % TILE;
    if (sx + 5 <= px + TILE) ctx.fillRect(sx, py + 3, 5, 4);
  }
  ctx.fillStyle = "#c9a15a";
  ctx.fillRect(px + 3, py + 14, 6, 6);
  ctx.fillRect(px + TILE - 9, py + 14, 6, 6);
  ctx.fillStyle = "#2a2418";
  ctx.fillRect(px + 5, py + 16, 2, 2);
  ctx.fillRect(px + TILE - 7, py + 16, 2, 2);
}

function drawGearTile(px, py, x, y) {
  const surface = y === 0 || tile(x, y - 1) !== GEAR;
  ctx.fillStyle = surface ? "#2a2118" : "#1a140e";
  ctx.fillRect(px, py, TILE, TILE);
  if (surface) {
    ctx.fillStyle = "#6a5434";
    ctx.fillRect(px, py, TILE, 3);
    ctx.fillStyle = "#c4a15a";
    ctx.fillRect(px + 4, py, 6, 2);
    ctx.fillRect(px + 22, py + 1, 8, 2);
  }
  const spin = time * 1.6 + x * 0.8 + y * 0.3;
  const cx = px + 20 + Math.round(Math.sin(x * 1.7) * 4);
  const cy = py + (surface ? 24 : 20);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.fillStyle = surface ? "#e2c27a" : "#8a6840";
  ctx.fillRect(-12, -3, 24, 6);
  ctx.fillRect(-3, -12, 6, 24);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-11, -3, 22, 6);
  ctx.fillRect(-3, -11, 6, 22);
  ctx.fillStyle = "#3a2a18";
  ctx.fillRect(-4, -4, 8, 8);
  ctx.fillStyle = "#1a140e";
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
}

function drawSwitch(e) {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  ctx.fillStyle = e.dead ? "#1a1e24" : "#2c3844";
  ctx.fillRect(x, y, e.w, e.h);
  ctx.fillStyle = "#12181e";
  ctx.fillRect(x + 3, y + 4, e.w - 6, e.h - 8);
  ctx.fillStyle = e.dead ? "#3a342c" : (Math.floor(time * 8) % 2 ? "#3aa0ff" : "#9ee7ff");
  ctx.fillRect(x + 6, y + 8, 6, 6);
  ctx.fillStyle = e.dead || e.locked ? "#3a342c" : "#e2b84a";
  ctx.fillRect(x + e.w - 12, y + 8, 6, 6);
  ctx.fillStyle = "#8ea0b0";
  ctx.fillRect(x + 4, y + e.h - 8, e.w - 8, 3);
  if (!e.dead && !e.locked && Math.floor(time * 10) % 3 === 0) {
    ctx.fillStyle = "#d8f4ff";
    ctx.fillRect(x + e.w / 2 - 1, y - 3, 2, 2);
  }
}

function drawDoor(e) {
  const open = e.dead ? (e.open == null ? 1 : e.open) : 0;
  const slide = Math.floor(open * 26);
  ctx.fillStyle = "#1a161c";
  ctx.fillRect(e.x + 8, e.y + 6, e.w - 16, e.h - 10);
  ctx.fillStyle = "#3a3344";
  ctx.fillRect(e.x, e.y, 8, e.h);
  ctx.fillRect(e.x + e.w - 8, e.y, 8, e.h);
  ctx.fillRect(e.x, e.y, e.w, 6);
  const leaf = Math.max(4, 28 - slide);
  ctx.fillStyle = e.role === "entry" ? "#3d4a58" : "#5c4e68";
  ctx.fillRect(e.x + 8, e.y + 8, leaf, e.h - 14);
  ctx.fillRect(e.x + e.w - 8 - leaf, e.y + 8, leaf, e.h - 14);
  ctx.fillStyle = "#d9c6ff";
  ctx.fillRect(e.x + 8, e.y + 10, leaf, 3);
  ctx.fillRect(e.x + e.w - 8 - leaf, e.y + 10, leaf, 3);
  if (!e.dead && e.hp != null && e.max) {
    const crack = Math.floor((1 - e.hp / e.max) * 5);
    ctx.fillStyle = "#1a1218";
    for (let i = 0; i < crack; i++) ctx.fillRect(e.x + 18 + i * 8, e.y + 16 + (i % 3) * 14, 8, 2);
  }
}

function drawBossRails() {
  const boss = ents.find((e) => e.kind === "boss");
  if (!boss) return;
  const x0 = boss.minX;
  const x1 = boss.maxX + boss.w;
  const bands = [
    { y: boss.ceilY, dir: 1 },
    { y: 16 * TILE - 8, dir: -1 },
  ];
  for (const band of bands) {
    ctx.fillStyle = "#241c14";
    ctx.fillRect(x0, band.y, x1 - x0, 10);
    ctx.fillStyle = "#6a5430";
    ctx.fillRect(x0, band.y, x1 - x0, 2);
    ctx.fillRect(x0, band.y + 8, x1 - x0, 2);
    ctx.fillStyle = band.dir > 0 ? "#e2b84a" : "#8ec8c4";
    const scroll = Math.floor(time * 50) * band.dir;
    const step = 14;
    const shift = ((scroll % step) + step) % step;
    for (let i = -1; i < (x1 - x0) / step + 2; i++) {
      const x = x0 + i * step - shift;
      if (x + 6 <= x0 || x >= x1) continue;
      ctx.fillRect(x, band.y + 3, 6, 4);
    }
  }
}

function drawChains() {
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const x1 = Math.min(COLS, Math.ceil((cam.x + viewW) / TILE) + 1);
  const y1 = Math.min(ROWS, Math.ceil((cam.y + viewH) / TILE) + 1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!isSolidTile(tile(x, y)) || isSolidTile(tile(x, y + 1))) continue;
      if (x % 8 !== 2) continue;
      const drop = 36 + (x % 5) * 8;
      const px = x * TILE + 16;
      const py = (y + 1) * TILE;
      ctx.fillStyle = "#4e5d6c";
      ctx.fillRect(px, py, 10, drop);
      ctx.fillStyle = "#d5dbe3";
      ctx.fillRect(px + 4, py, 2, drop - 8);
      ctx.fillStyle = "#8ea0b0";
      ctx.fillRect(px - 2, py + drop - 4, 14, 4);
    }
  }
}

function drawPads() {
  for (const pad of pads) {
    const x = pad.x;
    const y = pad.y;
    ctx.fillStyle = "#2a3138";
    ctx.fillRect(x + 4, y, 8, pad.h);
    ctx.fillStyle = "#6a5530";
    ctx.fillRect(x, y + 6, pad.w, 6);
    ctx.fillRect(x, y + pad.h - 16, pad.w, 6);
    ctx.fillStyle = "#e2b84a";
    ctx.fillRect(x + pad.w - 8, y + 12, 8, pad.h - 28);
    ctx.fillStyle = "#1a140c";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + pad.w - 6, y + 18 + i * 16, 4, 6);
    ctx.fillStyle = "#f2dfb0";
    ctx.fillRect(x + pad.w - 10, y + pad.h * 0.5 - 4, 12, 8);
    ctx.fillStyle = "#1a140c";
    ctx.fillRect(x + pad.w - 4, y + pad.h * 0.5 - 8, 4, 4);
    ctx.fillRect(x + pad.w - 4, y + pad.h * 0.5 + 4, 4, 4);
  }
}

function drawBoss(e) {
  if (e.dead) return;
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(e.x + 8, e.y + 18, e.w - 16, e.h - 22);
  const spin = time * (e.shield ? 1.2 : 3);
  const hubs = [[18, 30], [e.w * 0.5, 22], [e.w - 18, 30]];
  hubs.forEach((hub, i) => {
    ctx.save();
    ctx.translate(e.x + hub[0], e.y + hub[1]);
    ctx.rotate(spin + i);
    ctx.fillStyle = e.cores[i] > 0 ? "#8a6840" : "#3a342c";
    ctx.fillRect(-12, -3, 24, 6);
    ctx.fillRect(-3, -12, 6, 24);
    ctx.restore();
  });
  bossCores(e).forEach((core) => {
    const alive = e.cores[core.i] > 0;
    ctx.fillStyle = !alive ? "#3a342c" : e.shield ? "#6a5530" : "#ff3a32";
    ctx.fillRect(core.x - 3, core.y - 3, 6, 6);
  });
  if (e.shield) {
    ctx.fillStyle = "#e2b84a";
    for (let i = 0; i < 10; i++) {
      const a = time * 2 + (i / 10) * Math.PI * 2;
      ctx.fillRect(
        Math.round(e.x + e.w * 0.5 + Math.cos(a) * 30),
        Math.round(e.y + 24 + Math.sin(a) * 16),
        3, 3
      );
    }
  }
}

function drawEnts() {
  for (const e of ents) {
    if (e.kind === "boss") {
      drawBoss(e);
      continue;
    }
    if (e.role === "door" || e.role === "entry") {
      drawDoor(e);
      continue;
    }
    if (e.role === "switch") {
      drawSwitch(e);
      continue;
    }
    if (e.dead) continue;
    if (e.kind === "star") {
      const bob = Math.sin(time * 3 + e.x) * 2;
      const sx = Math.round(e.x + 8);
      const sy = Math.round(e.y + 8 + bob);
      ctx.fillStyle = "#f2c14b";
      ctx.fillRect(sx - 1, sy - 6, 2, 12);
      ctx.fillRect(sx - 6, sy - 1, 12, 2);
      ctx.fillRect(sx - 4, sy - 4, 2, 2);
      ctx.fillRect(sx + 2, sy - 4, 2, 2);
      ctx.fillRect(sx - 4, sy + 2, 2, 2);
      ctx.fillRect(sx + 2, sy + 2, 2, 2);
      ctx.fillStyle = "#fff4d2";
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
      continue;
    }
    if (e.name === "caixa") {
      ctx.fillStyle = "#8a4e22";
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = "#c4844a";
      ctx.fillRect(e.x + 4, e.y + 4, e.w - 8, 6);
      ctx.fillRect(e.x + 4, e.y + e.h - 10, e.w - 8, 6);
      ctx.fillStyle = "#3a2414";
      ctx.fillRect(e.x + e.w / 2 - 2, e.y + 4, 4, e.h - 8);
      ctx.fillRect(e.x + 4, e.y + e.h / 2 - 2, e.w - 8, 4);
    } else if (e.kind === "attack") {
      const blink = e.aim > 0.4 && e.aim < 0.75;
      ctx.fillStyle = "#2a333c";
      ctx.fillRect(e.x, e.y + 6, e.w, e.h - 6);
      ctx.fillStyle = "#46515e";
      ctx.fillRect(e.x + 4, e.y, e.w - 8, 8);
      ctx.fillStyle = blink ? "#f4f7fb" : "#ff3a32";
      ctx.fillRect(e.x + e.w / 2 - 3, e.y + 2, 6, 4);
      ctx.fillStyle = "#8d97a3";
      const spin = Math.floor(time * 10 + e.bob) % 3;
      ctx.fillRect(e.x - 4, e.y + 4 + spin, 4, 2);
      ctx.fillRect(e.x + e.w, e.y + 6 - spin, 4, 2);
    }
    if (e.hp < e.max) {
      ctx.fillStyle = "#121418";
      ctx.fillRect(e.x, e.y - 6, e.w, 3);
      ctx.fillStyle = e.kind === "burn" ? "#ff8a3a" : e.kind === "destroy" ? "#c9b2ff" : "#ff5a4a";
      ctx.fillRect(e.x, e.y - 6, Math.max(0, e.w * (e.hp / e.max)), 3);
    }
  }
}

function fillDisc(cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let row = -r; row <= r; row++) {
    const span = Math.round(Math.sqrt(Math.max(0, r * r - row * row)));
    ctx.fillRect(cx - span, cy + row, span * 2 + 1, 1);
  }
}

function drawClaw(x, y, side) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(ix, iy - 3, 2, 2);
  ctx.fillRect(ix + side * 3, iy, 2, 2);
  ctx.fillRect(ix, iy + 2, 2, 2);
  ctx.fillStyle = "#9aa6b4";
  ctx.fillRect(ix - side, iy - 1, 2, 2);
}

function drawPipe(x0, y0, x1, y1) {
  pixLine(x0, y0, x1, y1, "#7e8b99", 2);
  ctx.fillStyle = "#d5dde6";
  ctx.fillRect(Math.round((x0 + x1) / 2) - 1, Math.round((y0 + y1) / 2) - 1, 3, 3);
  ctx.fillStyle = "#2a333c";
  ctx.fillRect(Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), 1, 1);
}

function drawRobot(x, y, face, opts) {
  const o = opts || {};
  const bob = o.hang || !player.grounded ? 0 : (Math.sin(player.walk * 2) > 0 ? 0 : 1);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + bob));
  if (player.inv > 0 && o.live && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.4;

  const cx = 10;
  const cy = 13;
  const swing = player.grounded ? Math.round(Math.sin(player.walk * 2) * 2) : 0;
  const lean = Math.max(-2, Math.min(2, Math.round(player.vx / 140)));
  const arms = [
    { id: 0, side: -1, x: 1 - lean, y: 4, upper: true },
    { id: 1, side: 1, x: 19 - lean, y: 4, upper: true },
    { id: 2, side: -1, x: -1 - lean, y: 22 + swing, upper: false },
    { id: 3, side: 1, x: 21 - lean, y: 22 - swing, upper: false },
  ];
  for (const arm of arms) {
    let ex = arm.x;
    let ey = arm.y;
    if (o.grab && o.grab.side === arm.side && arm.upper) {
      ex = o.grab.x;
      ey = o.grab.y;
    } else if (o.wall && o.wall === arm.side) {
      ex = arm.side < 0 ? -4 : 22;
      ey = arm.upper ? 8 : 16;
    }
    const ox = cx + (ex - cx) * 0.28;
    const oy = cy + (ey - cy) * 0.28;
    drawPipe(ox, oy, ex, ey);
    drawClaw(ex, ey, arm.side);
  }

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(4, 26, 12, 2);
  fillDisc(cx, cy, 7, "#121820");
  fillDisc(cx, cy, 6, "#2c3846");
  ctx.fillStyle = "#465466";
  ctx.fillRect(cx - 4, cy - 5, 4, 2);

  const hot = player.heat / 100;
  const ex = cx + face * 2;
  ctx.fillStyle = o.eye || (player.over > 0 ? "#ffd27a" : hot > 0.5 ? "#ff5a32" : "#e10600");
  ctx.fillRect(ex - 2, cy - 2, 4, 4);
  ctx.fillStyle = "#ffd0cc";
  ctx.fillRect(ex + face, cy - 2, 1, 1);

  ctx.restore();
}

function drawFlightPreview() {
  if (!player.sling) return;
  const fly = launchVelocity();
  let x = player.x + player.w / 2;
  let y = player.y + 12;
  let vx = fly.vx;
  let vy = fly.vy;
  for (let i = 0; i < 22; i++) {
    vy += GRAV * 0.04;
    x += vx * 0.04;
    y += vy * 0.04;
    if (i % 2) continue;
    ctx.fillStyle = i > 14 ? "#8a6a28" : "#f2c14b";
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
}

function drawLaser() {
  if (!beam) return;
  pixLine(beam.x0, beam.y0, beam.x1, beam.y1, "#ffb0a4", 2);
  ctx.fillStyle = "#fff2ea";
  ctx.fillRect(Math.round(beam.x1) - 2, Math.round(beam.y1) - 2, 4, 4);
}

function drawLabels() {
  ctx.textAlign = "left";
  ctx.font = "8px Consolas, monospace";
  for (const lb of labels) {
    const w = Math.max(ctx.measureText(lb.text).width, ctx.measureText(lb.sub).width);
    ctx.fillStyle = "rgba(8,10,14,0.8)";
    ctx.fillRect(lb.x - 3, lb.y - 10, w + 8, 20);
    ctx.fillStyle = "#f4efe4";
    ctx.fillText(lb.text, lb.x, lb.y);
    ctx.fillStyle = "#d7c08a";
    ctx.fillText(lb.sub, lb.x, lb.y + 8);
  }
}

function drawLamps() {
  for (const l of lamps) {
    const flick = 0.7 + Math.sin(time * 9 + l.x) * 0.1;
    ctx.fillStyle = `rgba(255, 186, 110, ${0.16 * flick})`;
    ctx.fillRect(l.x - 18, l.y, 36, 28);
    ctx.fillStyle = "#f2c14b";
    ctx.fillRect(l.x - 3, l.y, 6, 4);
    let hang = 0;
    const tx = Math.floor(l.x / TILE);
    while (hang < ROWS && isSolidTile(tile(tx, hang))) hang++;
    const cord = hang * TILE;
    ctx.fillStyle = "#6a5530";
    ctx.fillRect(l.x - 1, cord, 2, Math.max(0, l.y - cord));
  }
}

function drawShells() {
  for (const s of shells) {
    ctx.fillStyle = "#232a32";
    ctx.fillRect(s.x, s.y, 18, 16);
    ctx.fillStyle = "#12181e";
    ctx.fillRect(s.x + 3, s.y + 3, 12, 6);
    ctx.fillStyle = "#5c4030";
    ctx.fillRect(s.x + 6, s.y + 5, 4, 2);
    ctx.fillStyle = "#8d97a3";
    ctx.fillRect(s.x - 4, s.y + 8, 4, 2);
    ctx.fillRect(s.x + 18, s.y + 8, 4, 2);
    ctx.fillStyle = "#c8d0da";
    ctx.font = "7px Consolas, monospace";
    ctx.fillText("PARADA", s.x - 6, s.y - 3);
  }
}

function drawWorld() {
  const sx = Math.round((Math.random() - 0.5) * cam.shake);
  const sy = Math.round((Math.random() - 0.5) * cam.shake);
  ctx.save();
  ctx.translate(-cam.x + sx, -cam.y + sy);

  drawTiles();
  drawBossRails();
  drawChains();
  drawLamps();
  drawShells();
  drawPads();
  drawEnts();

  for (const b of bullets) {
    ctx.fillStyle = "#ffd0a4";
    ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
  }

  drawFlightPreview();
  if (player.deadT <= 0 || Math.floor(time * 12) % 2 === 0) {
    let grab = null;
    if (player.sling) {
      grab = {
        side: player.arm,
        x: player.sling.anchorX - player.x,
        y: player.sling.anchorY - player.y,
      };
    }
    drawRobot(player.x, player.y, player.face, {
      live: true,
      wall: player.wall,
      hang: !!player.sling,
      grab,
    });
  }
  drawLaser();

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "rgba(232, 226, 214, 0.55)";
  ctx.font = "bold 14px Consolas, monospace";
  ctx.fillText(runKind === "proc" ? phaseName : "FASE " + (phase + 1), sign.x, sign.y);
  ctx.font = "8px Consolas, monospace";
  ctx.fillText(phaseName, sign.x, sign.y + 12);

  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = "#12161c";
  ctx.fillRect(8, 8, 214, 16);
  ctx.fillStyle = "#f2efe6";
  ctx.font = "7px Consolas, monospace";
  ctx.fillText(runKind === "proc" ? phaseName : "FASE " + (phase + 1), 12, 19);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i < player.hp ? "#ff4a3a" : "#2a3038";
    ctx.fillRect(52 + i * 12, 13, 10, 6);
  }
  ctx.fillStyle = "#f2efe6";
  ctx.fillText("OLHO", 108, 19);
  ctx.fillStyle = "#1a1e26";
  ctx.fillRect(136, 13, 78, 6);
  ctx.fillStyle = player.over > 0 ? "#ffd27a" : "#ff5a3a";
  ctx.fillRect(136, 13, 78 * (player.heat / 100), 6);
  const stars = ents.filter((e) => e.kind === "star");
  if (stars.length) {
    const got = stars.filter((e) => e.dead).length;
    ctx.fillStyle = "#12161c";
    ctx.fillRect(8, 28, 78, 12);
    ctx.fillStyle = "#f2c14b";
    ctx.fillText("ESTRELAS " + got + "/" + stars.length, 12, 37);
  }

  const boss = ents.find((e) => e.kind === "boss" && !e.dead);
  if (boss) {
    const open = boss.cores.filter((v) => v <= 0).length;
    ctx.fillStyle = "#12161c";
    ctx.fillRect(8, stars.length ? 44 : 28, 108, 12);
    ctx.fillStyle = boss.shield ? "#e2b84a" : "#ff5a3a";
    ctx.fillText((boss.shield ? "ESCUDO " : "ABERTO ") + (3 - open), 12, stars.length ? 53 : 37);
  }

  if (player.deadT > 0) {
    ctx.fillStyle = "rgba(8,6,8,0.4)";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = "#f2efe6";
    ctx.font = "10px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(player.cause === "gear" ? "O mar de engrenagens engoliu a unidade..." : "Recalibrando a unidade...", viewW / 2, viewH / 2);
    ctx.textAlign = "left";
  }

  if (paused) {
    ctx.fillStyle = "rgba(6,8,12,0.6)";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = "#f2efe6";
    ctx.font = "14px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText("PAUSA", viewW / 2, viewH / 2);
    ctx.font = "8px Consolas, monospace";
    ctx.fillText("Esc continua", viewW / 2, viewH / 2 + 14);
    ctx.textAlign = "left";
  }
}

function menuButtons() {
  const items = [
    { id: "play", label: "JOGAR" },
    { id: "proc", label: "PROCEDURAL" },
    { id: "controls", label: "CONTROLES" },
    { id: "tips", label: "DICAS" },
  ];
  const w = 86;
  const h = 12;
  const x = 8;
  const y0 = 18;
  return items.map((item, i) => ({ ...item, x, y: y0 + i * 16, w, h }));
}

function buttonAt(mx, my) {
  return menuButtons().find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
}

function drawMenuBackdrop() {
  cam.x = 80;
  cam.y = 430;
  drawBackdrop();
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawTiles();
  drawChains();
  drawShells();
  ctx.restore();
  ctx.fillStyle = "rgba(8,10,14,0.9)";
  ctx.fillRect(0, 0, viewW, viewH);
}

function drawMenuButton(b, hot) {
  ctx.fillStyle = hot ? "#f2c14b" : "#8a6a32";
  ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  ctx.fillStyle = "#1a140c";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = hot ? "#f6efe4" : "#e2c27a";
  ctx.font = "8px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText(b.label, b.x + b.w / 2, b.y + 9);
}

function drawTextPage(title, lines) {
  const cx = Math.floor(viewW / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = "#d7c08a";
  ctx.font = "8px Consolas, monospace";
  ctx.fillText("GEARSEA", cx, 28);
  ctx.fillStyle = "#f4efe4";
  ctx.font = "bold 16px Consolas, monospace";
  ctx.fillText(title, cx, 52);
  ctx.font = "8px Consolas, monospace";
  ctx.fillStyle = "#d5dbe3";
  lines.forEach((ln, i) => ctx.fillText(ln, cx, 78 + i * 16));
  ctx.fillStyle = "#e2c27a";
  ctx.fillText("Esc ou clique volta", cx, viewH - 18);
  ctx.textAlign = "left";
}

function drawTitle() {
  drawMenuBackdrop();
  if (menu === "controls") {
    drawTextPage("CONTROLES", [
      "A D corre. Espaço pula. O pulo usa a velocidade do instante.",
      "Clique esquerdo lança o gancho. Clique de novo, ou E, estilinga.",
      "No teto, A D anda. Espaço ou S solta.",
      "Clique direito, F ou J, é o laser do olho.",
      "Esc pausa. R volta ao último ponto.",
    ]);
    return;
  }
  if (menu === "tips") {
    drawTextPage("DICAS", [
      "Óleo recusa o gancho e o teto. Rebite e parede seguram.",
      "O mar de engrenagens afoga. A esteira arrasta quem fica nela.",
      "Esteira contra você: anda no sentido oposto ou pula no fim.",
      "A caixa elétrica abre a porta. Encostar na porta troca a fase.",
      "Chefão: o escudo cai em ciclos. Laser só nos três núcleos.",
      "O chefão corre numa esteira no chão e noutra no teto, e troca de uma para a outra.",
    ]);
    return;
  }
  const hover = buttonAt(mouse.x, mouse.y);
  if (hover && menu !== "leaving") menuIndex = menuButtons().indexOf(hover);
  ctx.textAlign = "left";
  ctx.fillStyle = "#d7c08a";
  ctx.font = "8px Consolas, monospace";
  ctx.fillText("GEARSEA", 10, 12);
  menuButtons().forEach((b, i) => drawMenuButton(b, menu !== "leaving" && i === menuIndex));
  drawAssembly();
  ctx.textAlign = "left";
}

function drawMiniBot(eye) {
  ctx.fillStyle = "#2c3846";
  ctx.fillRect(-5, -5, 10, 10);
  ctx.fillStyle = "#465466";
  ctx.fillRect(-4, -6, 4, 2);
  ctx.fillStyle = eye;
  ctx.fillRect(-2, -2, 4, 3);
  ctx.fillStyle = "#c5ced8";
  ctx.fillRect(-8, 0, 3, 2);
  ctx.fillRect(5, 0, 3, 2);
}

function drawAssembly() {
  const leaving = menu === "leaving";
  const cx = Math.floor(viewW * 0.48);
  const cy = Math.floor(viewH * 0.52);
  ctx.fillStyle = "#2a3038";
  ctx.fillRect(cx - 30, cy + 36, 210, 8);
  ctx.fillStyle = "#1a1e24";
  ctx.fillRect(cx - 30, cy + 36, 210, 2);
  const cycle = time % 3.2;
  for (let i = 0; i < 3; i++) {
    const grow = leaving ? (i < 2 ? 1 : 0.4) : Math.max(0, Math.min(1, (cycle - i * 0.7) / 0.8));
    if (grow <= 0.05) continue;
    ctx.save();
    ctx.translate(cx + 54 + i * 34, cy + 16 + (1 - grow) * 10);
    ctx.scale(1.6, 1.6 * grow);
    ctx.globalAlpha = leaving ? 0.45 : 0.3 + grow * 0.7;
    drawMiniBot(leaving ? "#6a3030" : "#3aa0ff");
    ctx.restore();
  }
  if (!leaving && Math.floor(time * 8) % 2 === 0) {
    ctx.fillStyle = "#9ad0ff";
    ctx.fillRect(cx + 28, cy + 8, 3, 3);
    ctx.fillRect(cx + 40, cy + 18, 2, 2);
  }
  player.walk = leaving ? 0 : time * 5;
  player.grounded = true;
  player.vx = 0;
  player.heat = 0;
  player.over = 0;
  player.inv = 0;
  player.face = 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(3, 3);
  drawRobot(-PW / 2, -PH / 2, 1, { eye: leaving ? "#e10600" : "#3aa0ff" });
  ctx.restore();
}

function drawWin() {
  ctx.fillStyle = "rgba(8,6,4,0.55)";
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(viewW / 2 - 130, viewH / 2 - 36, 260, 72);
  ctx.fillStyle = "#f6efe4";
  ctx.font = "14px Consolas, monospace";
  ctx.fillText(runKind === "proc" ? "A linha gerada fechou." : "A campanha fechou.", viewW / 2, viewH / 2 - 12);
  ctx.font = "8px Consolas, monospace";
  ctx.fillStyle = "#e6d3b0";
  ctx.fillText(runKind === "proc" ? "Outra semente espera no menu." : "Doca, galeria, linha e o chefão.", viewW / 2, viewH / 2 + 4);
  ctx.fillText("Enter volta ao menu.", viewW / 2, viewH / 2 + 18);
  ctx.textAlign = "left";
}

function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);
  if (mode === "title") drawTitle();
  else if (mode === "forge") drawForge();
  else {
    drawBackdrop();
    drawWorld();
    if (mode === "win") drawWin();
    else drawHUD();
  }
  if (flash > 0 && mode === "play") {
    ctx.fillStyle = `rgba(255,40,30,${flash})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
  screen.imageSmoothingEnabled = false;
  screen.setTransform(PIX, 0, 0, PIX, 0, 0);
  screen.clearRect(0, 0, viewW, viewH);
  screen.drawImage(buf, 0, 0);
}

function clearEdges() {
  for (const k in pressed) delete pressed[k];
  mouse.pressed = false;
  mouse.released = false;
  mouse.moved = false;
}

function frame(t) {
  const now = t / 1000;
  const dt = Math.min(0.033, now - time || 0.016);
  time = now;
  musicTick();
  if (mode === "play") {
    updatePlay(dt);
    flash = Math.max(0, flash - dt);
  } else if (mode === "forge") {
    forge += dt;
    if (forge > 1.45) beginPlay();
  } else if (mode === "title") {
    player.heat = 12;
    if (menu === "leaving") {
      menuLeave += dt;
      if (menuLeave > 0.9) startRun();
    }
  }
  render();
  clearEdges();
  requestAnimationFrame(frame);
}

function resize() {
  viewW = Math.max(160, Math.floor(window.innerWidth / PIX));
  viewH = Math.max(120, Math.floor(window.innerHeight / PIX));
  buf.width = viewW;
  buf.height = viewH;
  canvas.width = viewW * PIX;
  canvas.height = viewH * PIX;
  canvas.style.width = `${viewW * PIX}px`;
  canvas.style.height = `${viewH * PIX}px`;
  screen.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
}

function beginPlay() {
  menu = "main";
  build();
  mode = "play";
  fireLock = 0.4;
  hookLock = 0.35;
  frameCamera();
  tone(440, 0.08, "square", 0.04, 660);
}

function startRun() {
  runKind = "campaign";
  phase = 0;
  beginPlay();
}

function startProcedural() {
  runKind = "proc";
  phase = 0;
  procSeed = freshSeed();
  rollProc(procSeed);
  forge = 0;
  mode = "forge";
  tone(180, 0.08, "square", 0.04, 90);
}

function drawForge() {
  drawMenuBackdrop();
  const label = procDiff === "hard" ? "DIFÍCIL" : procDiff === "easy" ? "FÁCIL" : "MÉDIO";
  const cx = Math.floor(viewW / 2);
  const barW = 200;
  const barX = cx - barW / 2;
  const barY = Math.floor(viewH * 0.48);
  const fill = Math.max(0, Math.min(1, forge / 1.15));
  ctx.textAlign = "center";
  ctx.fillStyle = "#d7c08a";
  ctx.font = "8px Consolas, monospace";
  ctx.fillText("MAPA ALEATÓRIO", cx, barY - 28);
  ctx.fillStyle = "#f4efe4";
  ctx.font = "bold 16px Consolas, monospace";
  ctx.fillText("CRIANDO MAPA", cx, barY - 10);
  ctx.fillStyle = "#1a140c";
  ctx.fillRect(barX - 2, barY - 2, barW + 4, 14);
  ctx.fillStyle = "#3a3228";
  ctx.fillRect(barX, barY, barW, 10);
  ctx.fillStyle = label === "DIFÍCIL" ? "#ff5a3a" : label === "FÁCIL" ? "#8ec8c4" : "#e2b84a";
  ctx.fillRect(barX, barY, Math.floor(barW * fill), 10);
  ctx.font = "8px Consolas, monospace";
  ctx.fillStyle = "#f6efe4";
  ctx.fillText(label + "  ·  CUSTOMIZADO  ·  " + String(procSeed).slice(-4), cx, barY + 24);
  ctx.textAlign = "left";
}

function activateMenu(id) {
  if (id === "play") {
    if (menu === "leaving") return;
    menu = "leaving";
    menuLeave = 0;
    tone(180, 0.08, "square", 0.04, 90);
  } else if (id === "proc") startProcedural();
  else if (id === "controls") menu = "controls";
  else if (id === "tips") menu = "tips";
}

function boot() {
  build();
  if (overlapsSolid(player)) console.error("spawn dentro de sólido");
  resize();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (!down[e.code]) pressed[e.code] = true;
  down[e.code] = true;
  startMusic();
  if (mode === "title" && (menu === "controls" || menu === "tips") && (e.code === "Escape" || e.code === "Enter")) menu = "main";
  else if (mode === "title" && menu === "main" && (e.code === "ArrowUp" || e.code === "KeyW")) menuIndex = (menuIndex + 3) % 4;
  else if (mode === "title" && menu === "main" && (e.code === "ArrowDown" || e.code === "KeyS")) menuIndex = (menuIndex + 1) % 4;
  else if (e.code === "Enter" && mode === "title") activateMenu(menuButtons()[menuIndex].id);
  else if (e.code === "Enter" && mode === "win") {
    runKind = "campaign";
    phase = 0;
    menu = "main";
    build();
    mode = "title";
  } else if (e.code === "Escape" && mode === "play") paused = !paused;
  else if (e.code === "KeyR" && mode === "play") respawn();
});

window.addEventListener("keyup", (e) => {
  down[e.code] = false;
});

window.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (viewW / r.width);
  mouse.y = (e.clientY - r.top) * (viewH / r.height);
  if (Math.hypot(e.movementX, e.movementY) > 2) mouse.moved = true;
});

window.addEventListener("mousedown", (e) => {
  startMusic();
  if (e.button === 2) {
    mouse.right = true;
    mouse.rightPressed = true;
    return;
  }
  if (e.button !== 0) return;
  mouse.down = true;
  mouse.pressed = true;
  if (mode === "title") {
    if (menu === "controls" || menu === "tips") menu = "main";
    else if (menu === "main") {
      const b = buttonAt(mouse.x, mouse.y);
      if (b) activateMenu(b.id);
    }
    mouse.pressed = false;
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 2) {
    mouse.right = false;
    return;
  }
  if (e.button !== 0) return;
  mouse.down = false;
  mouse.released = true;
});

window.addEventListener("resize", resize);
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("blur", () => {
  for (const k in down) down[k] = false;
  mouse.down = false;
  mouse.right = false;
});

boot();
