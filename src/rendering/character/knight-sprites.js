// Knight sprite module: vector sprite generation only.
//
// The public contract intentionally stays small: buildSprites() returns four
// directions with four walk frames each. Every direction is drawn as its own
// top-down / lightly isometric view; the finished character is never rotated as
// a flat icon.

const DIRECTIONS = ["down", "up", "left", "right"];

// Four distinct phases. Frame 0 also doubles as a believable relaxed idle.
// The sword rock is intentionally subtle: its weight rests on the shoulder and
// the right hand only balances the hilt.
const WALK = [
  { stride: -1, bob: 0, sway: -0.45, swordRock: -1.7, plume: -0.7 },
  { stride: -0.28, bob: -0.8, sway: 0.5, swordRock: -0.35, plume: 0.35 },
  { stride: 1, bob: 0, sway: 0.45, swordRock: 1.7, plume: 0.7 },
  { stride: 0.28, bob: -0.8, sway: -0.5, swordRock: 0.35, plume: -0.35 },
];

const r2 = (n) => Math.round(n * 100) / 100;

const DEFS =
  `<defs>` +
    `<linearGradient id='steel' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='#f2f5f8'/>` +
      `<stop offset='0.38' stop-color='#aeb8c5'/>` +
      `<stop offset='1' stop-color='#596473'/>` +
    `</linearGradient>` +
    `<linearGradient id='steelDark' x1='0' y1='0' x2='0' y2='1'>` +
      `<stop offset='0' stop-color='#788493'/>` +
      `<stop offset='1' stop-color='#303946'/>` +
    `</linearGradient>` +
    `<radialGradient id='dome' cx='0.32' cy='0.24' r='0.86'>` +
      `<stop offset='0' stop-color='#ffffff'/>` +
      `<stop offset='0.42' stop-color='#c6cfda'/>` +
      `<stop offset='1' stop-color='#626e7d'/>` +
    `</radialGradient>` +
    `<linearGradient id='shieldBlue' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='#56a1ff'/>` +
      `<stop offset='0.48' stop-color='#2563d8'/>` +
      `<stop offset='1' stop-color='#123a91'/>` +
    `</linearGradient>` +
    `<linearGradient id='blade' x1='0' y1='0' x2='1' y2='0'>` +
      `<stop offset='0' stop-color='#778393'/>` +
      `<stop offset='0.47' stop-color='#f7fafc'/>` +
      `<stop offset='0.7' stop-color='#b8c2ce'/>` +
      `<stop offset='1' stop-color='#667282'/>` +
    `</linearGradient>` +
  `</defs>`;

function groundShadow() {
  return `<ellipse cx='32' cy='51' rx='15.5' ry='4.2' fill='#05070a' opacity='0.42'/>`;
}

// A single boot is oriented independently so the body itself never has to be
// rotated. Local +y is the direction of the toe.
function boot(x, y, angle) {
  return (
    `<g transform='translate(${r2(x)} ${r2(y)}) rotate(${r2(angle)})'>` +
      `<path d='M-3.8-5.5 Q0-7 3.8-5.5 L4.2 3.2 Q3.3 6.3 0 6.8 Q-3.3 6.3-4.2 3.2Z' ` +
        `fill='url(#steelDark)' stroke='#1b222c' stroke-width='1.25'/>` +
      `<path d='M-2.2-4.5 Q0-5.3 2.2-4.5' fill='none' stroke='#b9c2cc' stroke-width='1' opacity='0.5'/>` +
      `<path d='M-3.2 2.6 Q0 4.2 3.2 2.6' fill='none' stroke='#171d25' stroke-width='1' opacity='0.75'/>` +
    `</g>`
  );
}

function legs(dir, pose) {
  const step = pose.stride * 2.6;

  if (dir === "down") {
    return boot(27, 45 + step, 0) + boot(37, 45 - step, 0);
  }
  if (dir === "up") {
    return boot(27, 44 - step, 180) + boot(37, 44 + step, 180);
  }
  if (dir === "right") {
    return boot(39 + step, 37.5, -90) + boot(39 - step, 45, -90);
  }
  return boot(25 - step, 37.5, 90) + boot(25 + step, 45, 90);
}

// Local +y points forward. The blade extends backward over the shoulder while
// the grip and relaxed gauntlet sit just in front of the crossguard.
function sword(x, y, angle) {
  return (
    `<g transform='translate(${r2(x)} ${r2(y)}) rotate(${r2(angle)})'>` +
      `<path d='M-2.05-1 L-1.35-23.5 L0-28.5 L1.35-23.5 L2.05-1Z' ` +
        `fill='url(#blade)' stroke='#303946' stroke-width='0.9' stroke-linejoin='round'/>` +
      `<path d='M0-23.5 L0-3' fill='none' stroke='#ffffff' stroke-width='0.75' opacity='0.72'/>` +
      `<path d='M-6.2-1.2 Q0-2.4 6.2-1.2 L5.5 1.2 Q0 0.2-5.5 1.2Z' ` +
        `fill='#d8a82e' stroke='#674d0c' stroke-width='0.85'/>` +
      `<rect x='-1.65' y='0.6' width='3.3' height='9.5' rx='1.45' fill='#613b28' stroke='#2d1d17' stroke-width='0.75'/>` +
      `<path d='M-1.4 3.1 L1.4 4.2 M-1.4 5.6 L1.4 6.7 M-1.4 8.1 L1.4 9.2' ` +
        `stroke='#c4915f' stroke-width='0.7'/>` +
      `<circle cx='0' cy='10.4' r='1.8' fill='#d8a82e' stroke='#674d0c' stroke-width='0.8'/>` +
      `<ellipse cx='0' cy='6.3' rx='3.15' ry='2.8' fill='url(#steel)' stroke='#252c36' stroke-width='1'/>` +
    `</g>`
  );
}

// A deliberately narrow shield: it is held parallel to the body rather than
// presented flat toward the camera. Local +y points forward.
function shield(x, y, angle, widthScale = 0.82) {
  return (
    `<g transform='translate(${r2(x)} ${r2(y)}) rotate(${r2(angle)}) scale(${r2(widthScale)} 1)'>` +
      `<path d='M-5.7-9.4 Q0-11.5 5.7-9.4 L5.1 3.7 Q4.1 8.8 0 11.4 Q-4.1 8.8-5.1 3.7Z' ` +
        `fill='url(#shieldBlue)' stroke='#d2dae4' stroke-width='1.8' stroke-linejoin='round'/>` +
      `<path d='M-3.8-7.8 Q0-9.1 3.8-7.8' fill='none' stroke='#9ed0ff' stroke-width='1.2' opacity='0.8'/>` +
      `<path d='M0-8.3 L0 7.2' stroke='#e6ba3c' stroke-width='1.65' stroke-linecap='round'/>` +
      `<circle cx='0' cy='0' r='2.1' fill='#f0c957' stroke='#725514' stroke-width='0.8'/>` +
    `</g>`
  );
}

function torsoDown() {
  return (
    `<ellipse cx='32' cy='28.5' rx='7.8' ry='4.2' fill='#313946' stroke='#1b222c' stroke-width='1.1'/>` +
    `<path d='M23.5 27 Q32 22.6 40.5 27 L43 40.5 Q40.3 47.5 32 49 Q23.7 47.5 21 40.5Z' ` +
      `fill='url(#steel)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M32 27 L32 45 M25.7 37.5 Q32 40.3 38.3 37.5' ` +
      `fill='none' stroke='#596675' stroke-width='1.1' opacity='0.85'/>` +
    `<path d='M25.7 43 Q32 45.4 38.3 43' fill='none' stroke='#d4a72f' stroke-width='1.5'/>` +
    `<ellipse cx='22' cy='30.3' rx='5.2' ry='4.7' fill='url(#steel)' stroke='#1b222c' stroke-width='1.25'/>` +
    `<ellipse cx='42' cy='30.3' rx='5.2' ry='4.7' fill='url(#steel)' stroke='#1b222c' stroke-width='1.25'/>` +
    `<path d='M25 28 Q30 25 34 25' fill='none' stroke='#ffffff' stroke-width='1.15' opacity='0.45'/>`
  );
}

function helmetDown(plume) {
  return (
    `<path d='M31 19 C27.2 16.2 ${r2(24.8 + plume)} 11.5 29.1 6.2 ` +
      `C34 9.7 ${r2(35.6 + plume)} 14.8 34.2 19.7Z' fill='#c9363e' stroke='#6f1720' stroke-width='1.05'/>` +
    `<path d='M30.7 17.8 C29 14.5 28.8 11.2 30 8.9 C32.4 11.6 33.2 15 33 18.3Z' fill='#f06367'/>` +
    `<path d='M23.1 23.9 Q24.1 15.2 32 13.8 Q39.9 15.2 40.9 23.9 L39.2 28.8 ` +
      `Q32 33.3 24.8 28.8Z' fill='url(#dome)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M25 24.1 Q32 27.2 39 24.1 L38.2 28 Q32 31.2 25.8 28Z' fill='#252d38'/>` +
    `<path d='M31.1 24.7 L32 22.1 L32.9 24.7 L32.3 29.5 L31.7 29.5Z' fill='#8d99a8'/>` +
    `<path d='M26.4 20.2 Q29 16.7 32.2 16.5' fill='none' stroke='#ffffff' stroke-width='1.3' opacity='0.6'/>`
  );
}

function poseDown(pose) {
  const xShift = pose.sway;
  return (
    groundShadow() +
    legs("down", pose) +
    `<g transform='translate(${r2(xShift)} ${r2(pose.bob)})'>` +
      shield(46.3, 36, -2.5 + pose.sway * 0.45, 0.78) +
      torsoDown() +
      sword(21.6, 31.5, pose.swordRock) +
      helmetDown(pose.plume) +
    `</g>`
  );
}

function torsoUp() {
  return (
    `<ellipse cx='32' cy='28.5' rx='7.8' ry='4.2' fill='#303946' stroke='#1b222c' stroke-width='1.1'/>` +
    `<path d='M22.8 29 Q32 23.5 41.2 29 L43 41.5 Q39.4 48 32 49 ` +
      `Q24.6 48 21 41.5Z' fill='url(#steel)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M26 29 Q32 32.5 38 29 L38.6 42 Q32 45.5 25.4 42Z' ` +
      `fill='#707c8b' opacity='0.52' stroke='#495462' stroke-width='0.85'/>` +
    `<path d='M26 43 Q32 45.4 38 43' fill='none' stroke='#d4a72f' stroke-width='1.5'/>` +
    `<ellipse cx='21.5' cy='31' rx='5.2' ry='4.7' fill='url(#steel)' stroke='#1b222c' stroke-width='1.25'/>` +
    `<ellipse cx='42.5' cy='31' rx='5.2' ry='4.7' fill='url(#steel)' stroke='#1b222c' stroke-width='1.25'/>` +
    `<path d='M26.5 28.5 Q31 25.9 35 26.1' fill='none' stroke='#ffffff' stroke-width='1.1' opacity='0.38'/>`
  );
}

function helmetUp(plume) {
  return (
    `<path d='M30.2 18.2 C29.2 22 ${r2(29 + plume)} 29.8 32 36.2 ` +
      `C35 29.8 ${r2(34.8 + plume)} 22 33.8 18.2Z' fill='#c9363e' stroke='#6f1720' stroke-width='1.05'/>` +
    `<path d='M31.1 19.4 C30.6 24 31 29 32 32.5 C33 29 33.4 24 32.9 19.4Z' fill='#f06367'/>` +
    `<path d='M23.2 24 Q24 15.1 32 13.8 Q40 15.1 40.8 24 L39.1 29.2 ` +
      `Q32 32.7 24.9 29.2Z' fill='url(#dome)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M25.3 25.6 Q32 29 38.7 25.6' fill='none' stroke='#4d5968' stroke-width='1.35'/>` +
    `<path d='M32 15.2 L32 29.1' stroke='#717e8d' stroke-width='1.15' opacity='0.85'/>` +
    `<path d='M26.6 20 Q29 16.6 32 16.4' fill='none' stroke='#ffffff' stroke-width='1.3' opacity='0.58'/>`
  );
}

function poseUp(pose) {
  return (
    groundShadow() +
    legs("up", pose) +
    `<g transform='translate(${r2(-pose.sway)} ${r2(pose.bob)})'>` +
      shield(17.7, 35.3, 182.5 - pose.sway * 0.45, 0.78) +
      torsoUp() +
      sword(42.4, 31, 180 - pose.swordRock) +
      helmetUp(-pose.plume) +
    `</g>`
  );
}

function torsoRight() {
  return (
    `<ellipse cx='37.5' cy='30.2' rx='4.1' ry='7.3' fill='#303946' stroke='#1b222c' stroke-width='1.1'/>` +
    `<path d='M21.5 28.2 Q29 23.2 38 25.1 L46 31.2 L43 40.8 ` +
      `Q32.5 47.4 22.4 41.2Z' fill='url(#steel)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M25 29.2 Q33 31.5 41.8 29.5 M27 42 Q35 43.7 42 39.5' ` +
      `fill='none' stroke='#596675' stroke-width='1.05' opacity='0.82'/>` +
    `<path d='M27.5 43 Q34 44.2 39.5 41.3' fill='none' stroke='#d4a72f' stroke-width='1.5'/>` +
    `<ellipse cx='29.2' cy='25.9' rx='5.4' ry='4.5' fill='url(#steel)' stroke='#1b222c' stroke-width='1.2'/>` +
    `<ellipse cx='34.5' cy='40.3' rx='5.4' ry='4.5' fill='url(#steel)' stroke='#1b222c' stroke-width='1.2'/>` +
    `<path d='M24.2 28 Q30 24.9 35.2 26' fill='none' stroke='#ffffff' stroke-width='1.1' opacity='0.42'/>`
  );
}

function helmetRight(plume) {
  return (
    `<path d='M33 25 C28.7 22 ${r2(22.4 - plume)} 19.6 16.3 22.9 ` +
      `C20.2 27.5 ${r2(25.4 - plume)} 31 32.9 29.1Z' fill='#c9363e' stroke='#6f1720' stroke-width='1.05'/>` +
    `<path d='M31.2 26 C26.5 24.1 22.6 23.7 19.5 24.5 C23.3 26.8 27.6 28 31.7 28Z' fill='#f06367'/>` +
    `<path d='M31.2 21.1 Q40 20.2 44.9 26.7 Q47.3 30.5 44.1 35.2 ` +
      `Q37.1 38.4 31.6 33.8 Q29.2 27.8 31.2 21.1Z' fill='url(#dome)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M42.1 25.6 Q46.9 28.7 44.1 33.7 L41.4 35 L40.8 27.1Z' fill='#252d38'/>` +
    `<path d='M42 29.6 L46.1 30.2' stroke='#8f9ba9' stroke-width='1.05'/>` +
    `<path d='M33.2 23.1 Q36.9 21.3 40.1 23' fill='none' stroke='#ffffff' stroke-width='1.25' opacity='0.58'/>`
  );
}

function poseRight(pose) {
  const yShift = pose.bob + pose.sway * 0.42;
  return (
    groundShadow() +
    legs("right", pose) +
    `<g transform='translate(0 ${r2(yShift)})'>` +
      shield(33.5, 21.6, -88 + pose.sway * 0.45, 0.72) +
      torsoRight() +
      sword(34.1, 38.8, -90 + pose.swordRock) +
      helmetRight(pose.plume) +
    `</g>`
  );
}

function torsoLeft() {
  return (
    `<ellipse cx='26.5' cy='30.2' rx='4.1' ry='7.3' fill='#303946' stroke='#1b222c' stroke-width='1.1'/>` +
    `<path d='M42.5 28.2 Q35 23.2 26 25.1 L18 31.2 L21 40.8 ` +
      `Q31.5 47.4 41.6 41.2Z' fill='url(#steel)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M39 29.2 Q31 31.5 22.2 29.5 M37 42 Q29 43.7 22 39.5' ` +
      `fill='none' stroke='#596675' stroke-width='1.05' opacity='0.82'/>` +
    `<path d='M36.5 43 Q30 44.2 24.5 41.3' fill='none' stroke='#d4a72f' stroke-width='1.5'/>` +
    `<ellipse cx='34.8' cy='25.9' rx='5.4' ry='4.5' fill='url(#steel)' stroke='#1b222c' stroke-width='1.2'/>` +
    `<ellipse cx='29.5' cy='40.3' rx='5.4' ry='4.5' fill='url(#steel)' stroke='#1b222c' stroke-width='1.2'/>` +
    `<path d='M28.8 25.9 Q34 24.9 39.8 28' fill='none' stroke='#ffffff' stroke-width='1.1' opacity='0.42'/>`
  );
}

function helmetLeft(plume) {
  return (
    `<path d='M31 25 C35.3 22 ${r2(41.6 + plume)} 19.6 47.7 22.9 ` +
      `C43.8 27.5 ${r2(38.6 + plume)} 31 31.1 29.1Z' fill='#c9363e' stroke='#6f1720' stroke-width='1.05'/>` +
    `<path d='M32.8 26 C37.5 24.1 41.4 23.7 44.5 24.5 C40.7 26.8 36.4 28 32.3 28Z' fill='#f06367'/>` +
    `<path d='M32.8 21.1 Q24 20.2 19.1 26.7 Q16.7 30.5 19.9 35.2 ` +
      `Q26.9 38.4 32.4 33.8 Q34.8 27.8 32.8 21.1Z' fill='url(#dome)' stroke='#1b222c' stroke-width='1.45'/>` +
    `<path d='M21.9 25.6 Q17.1 28.7 19.9 33.7 L22.6 35 L23.2 27.1Z' fill='#252d38'/>` +
    `<path d='M22 29.6 L17.9 30.2' stroke='#8f9ba9' stroke-width='1.05'/>` +
    `<path d='M30.8 23.1 Q27.1 21.3 23.9 23' fill='none' stroke='#ffffff' stroke-width='1.25' opacity='0.58'/>`
  );
}

function poseLeft(pose) {
  const yShift = pose.bob - pose.sway * 0.42;
  return (
    groundShadow() +
    legs("left", pose) +
    `<g transform='translate(0 ${r2(yShift)})'>` +
      shield(30.5, 44.2, 88 - pose.sway * 0.45, 0.72) +
      torsoLeft() +
      sword(29.9, 23.2, 90 - pose.swordRock) +
      helmetLeft(pose.plume) +
    `</g>`
  );
}

const DRAW_POSE = {
  down: poseDown,
  up: poseUp,
  left: poseLeft,
  right: poseRight,
};

function spriteSVG(dir, frame) {
  const draw = DRAW_POSE[dir];
  const pose = WALK[frame];
  if (!draw || !pose) throw new Error(`Unknown sprite pose: ${dir}/${frame}`);

  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64' ` +
      `shape-rendering='geometricPrecision'>` +
      DEFS +
      draw(pose) +
    `</svg>`
  );
}

function makeImage(svg) {
  const img = new Image();
  img.decoding = "async";
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return img;
}

export function buildSprites() {
  const sprites = {};
  for (const dir of DIRECTIONS) {
    sprites[dir] = WALK.map((_, frame) => makeImage(spriteSVG(dir, frame)));
  }
  return sprites;
}
