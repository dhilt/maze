// Knight sprite module: vector sprite generation only.
//
// Walk and attack frames share the same hand-drawn top-down / lightly
// isometric poses. Every direction is drawn independently; the finished
// character is never rotated as a flat icon.

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

// Each attack returns along its own safe path. Opposite facings use opposite
// screen-space arcs: down/left-to-right pass on one side of the body, while
// up/right-to-left pass on the 180-degree mirrored side.
const ATTACK_IDLE = { ...WALK[0], attackFrame: 0, lunge: 0 };
const ATTACK_LIFT = {
  stride: -1, bob: -0.2, sway: -0.22, swordRock: -1.7,
  plume: -0.45, attackFrame: 1, lunge: 0,
};
const ATTACK_RAISED = {
  stride: -1, bob: -0.75, sway: 0.05, swordRock: -1.7,
  plume: 0.1, attackFrame: 2, lunge: 0.35,
};
const ATTACK_STRIKE = {
  stride: -1, bob: 0.15, sway: 0.18, swordRock: -1.7,
  plume: 0.65, attackFrame: 3, lunge: 2.8,
};
const ATTACK = [
  ATTACK_IDLE,
  ATTACK_LIFT,
  ATTACK_RAISED,
  ATTACK_STRIKE,
  { ...ATTACK_RAISED, attackFrame: 4 },
  { ...ATTACK_LIFT, attackFrame: 5 },
  { ...ATTACK_IDLE, attackFrame: 6 },
];

const ATTACK_SWORDS = Object.freeze({
  down: [
    { x: 21.6, y: 31.5, angle: -1.7 },
    { x: 23, y: 29.5, angle: -22 },
    { x: 26, y: 27, angle: -58 },
    { x: 28, y: 30, angle: 180 },
    { x: 26, y: 27, angle: -58 },
    { x: 23, y: 29.5, angle: -22 },
    { x: 21.6, y: 31.5, angle: -1.7 },
  ],
  up: [
    { x: 42.4, y: 31, angle: 181.7 },
    { x: 41, y: 34.5, angle: 158 },
    { x: 38, y: 37, angle: 122 },
    { x: 36, y: 34, angle: 0 },
    { x: 38, y: 37, angle: 122 },
    { x: 41, y: 34.5, angle: 158 },
    { x: 42.4, y: 31, angle: 181.7 },
  ],
  right: [
    { x: 34.1, y: 38.8, angle: -91.7 },
    { x: 36, y: 41, angle: -105 },
    { x: 38, y: 43, angle: -125 },
    { x: 35, y: 42, angle: 90 },
    { x: 38, y: 43, angle: -125 },
    { x: 36, y: 41, angle: -105 },
    { x: 34.1, y: 38.8, angle: -91.7 },
  ],
  left: [
    { x: 29.9, y: 23.2, angle: 91.7 },
    { x: 28, y: 19, angle: 80 },
    { x: 26, y: 18, angle: 65 },
    { x: 29, y: 19, angle: -90 },
    { x: 26, y: 18, angle: 65 },
    { x: 28, y: 19, angle: 80 },
    { x: 29.9, y: 23.2, angle: 91.7 },
  ],
});

const SWORD_SHOULDERS = Object.freeze({
  down: { x: 22, y: 30.3 },
  up: { x: 42.5, y: 31 },
  right: { x: 34.5, y: 40.3 },
  left: { x: 34.8, y: 25.9 },
});

const ATTACK_SHIELDS = Object.freeze({
  down: [
    { x: 46.3, y: 36, angle: -2.7, width: 0.78 },
    { x: 44.5, y: 37.5, angle: -6, width: 0.88 },
    { x: 42, y: 39.5, angle: -2, width: 1 },
    { x: 40, y: 41.5, angle: 0, width: 1.08 },
  ],
  up: [
    { x: 17.7, y: 35.3, angle: 182.7, width: 0.78 },
    { x: 19.5, y: 33, angle: 0, width: 0.88 },
    { x: 22, y: 29, angle: 0, width: 1 },
    { x: 24, y: 25.5, angle: 0, width: 1.08 },
  ],
  right: [
    { x: 33.5, y: 21.6, angle: -88.2, width: 0.72 },
    { x: 37, y: 24, angle: 0, width: 0.86 },
    { x: 41, y: 28, angle: 0, width: 1 },
    { x: 44, y: 32, angle: 0, width: 1.08 },
  ],
  left: [
    { x: 30.5, y: 44.2, angle: 88.2, width: 0.72 },
    { x: 27, y: 41, angle: 0, width: 0.86 },
    { x: 23, y: 36, angle: 0, width: 1 },
    { x: 20, y: 32, angle: 0, width: 1.08 },
  ],
});

const SHIELD_SHOULDERS = Object.freeze({
  down: { x: 42, y: 30.3 },
  up: { x: 21.5, y: 31 },
  right: { x: 29.2, y: 25.9 },
  left: { x: 29.5, y: 40.3 },
});

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

function attackPhase(pose) {
  if (!Number.isInteger(pose.attackFrame)) return null;
  return Math.min(pose.attackFrame, ATTACK.length - 1 - pose.attackFrame);
}

function swordPose(dir, pose) {
  if (Number.isInteger(pose.attackFrame)) return ATTACK_SWORDS[dir][pose.attackFrame];
  if (dir === "down") return { x: 21.6, y: 31.5, angle: pose.swordRock };
  if (dir === "up") return { x: 42.4, y: 31, angle: 180 - pose.swordRock };
  if (dir === "right") return { x: 34.1, y: 38.8, angle: -90 + pose.swordRock };
  return { x: 29.9, y: 23.2, angle: 90 - pose.swordRock };
}

function swordArm(dir, pose, weapon) {
  if (!Number.isInteger(pose.attackFrame) || pose.attackFrame === 0 || pose.attackFrame === 6) {
    return "";
  }

  const shoulder = SWORD_SHOULDERS[dir];
  const radians = weapon.angle * Math.PI / 180;
  const handX = weapon.x - Math.sin(radians) * 6.3;
  const handY = weapon.y + Math.cos(radians) * 6.3;
  const middleX = (shoulder.x + handX) / 2;
  const middleY = (shoulder.y + handY) / 2 - 0.8;

  return (
    `<path d='M${r2(shoulder.x)} ${r2(shoulder.y)} Q${r2(middleX)} ${r2(middleY)} ` +
      `${r2(handX)} ${r2(handY)}' fill='none' stroke='#222a35' stroke-width='6' stroke-linecap='round'/>` +
    `<path d='M${r2(shoulder.x)} ${r2(shoulder.y)} Q${r2(middleX)} ${r2(middleY)} ` +
      `${r2(handX)} ${r2(handY)}' fill='none' stroke='url(#steel)' stroke-width='3.8' stroke-linecap='round'/>`
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

function shieldPose(dir, pose) {
  const phase = attackPhase(pose);
  if (phase !== null) return ATTACK_SHIELDS[dir][phase];
  if (dir === "down") {
    return { x: 46.3, y: 36, angle: -2.5 + pose.sway * 0.45, width: 0.78 };
  }
  if (dir === "up") {
    return { x: 17.7, y: 35.3, angle: 182.5 - pose.sway * 0.45, width: 0.78 };
  }
  if (dir === "right") {
    return { x: 33.5, y: 21.6, angle: -88 + pose.sway * 0.45, width: 0.72 };
  }
  return { x: 30.5, y: 44.2, angle: 88 - pose.sway * 0.45, width: 0.72 };
}

function shieldArm(dir, guard) {
  const shoulder = SHIELD_SHOULDERS[dir];
  const middleX = (shoulder.x + guard.x) / 2;
  const middleY = (shoulder.y + guard.y) / 2 + (dir === "up" ? -0.8 : 0.8);

  return (
    `<path d='M${r2(shoulder.x)} ${r2(shoulder.y)} Q${r2(middleX)} ${r2(middleY)} ` +
      `${r2(guard.x)} ${r2(guard.y)}' fill='none' stroke='#222a35' stroke-width='6' stroke-linecap='round'/>` +
    `<path d='M${r2(shoulder.x)} ${r2(shoulder.y)} Q${r2(middleX)} ${r2(middleY)} ` +
      `${r2(guard.x)} ${r2(guard.y)}' fill='none' stroke='url(#steel)' stroke-width='3.8' stroke-linecap='round'/>`
  );
}

function raisedShield(dir, pose, guard) {
  if (attackPhase(pose) === 0 || attackPhase(pose) === null) return "";
  return shieldArm(dir, guard) + shield(guard.x, guard.y, guard.angle, guard.width);
}

function restingShield(pose, guard) {
  if (attackPhase(pose) !== 0 && attackPhase(pose) !== null) return "";
  return shield(guard.x, guard.y, guard.angle, guard.width);
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
  const weapon = swordPose("down", pose);
  const guard = shieldPose("down", pose);
  return (
    groundShadow() +
    legs("down", pose) +
    `<g transform='translate(${r2(xShift)} ${r2(pose.bob + (pose.lunge || 0))})'>` +
      restingShield(pose, guard) +
      torsoDown() +
      raisedShield("down", pose, guard) +
      swordArm("down", pose, weapon) +
      sword(weapon.x, weapon.y, weapon.angle) +
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
  const weapon = swordPose("up", pose);
  const guard = shieldPose("up", pose);
  return (
    groundShadow() +
    legs("up", pose) +
    `<g transform='translate(${r2(-pose.sway)} ${r2(pose.bob - (pose.lunge || 0))})'>` +
      restingShield(pose, guard) +
      torsoUp() +
      raisedShield("up", pose, guard) +
      swordArm("up", pose, weapon) +
      sword(weapon.x, weapon.y, weapon.angle) +
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
  const weapon = swordPose("right", pose);
  const guard = shieldPose("right", pose);
  return (
    groundShadow() +
    legs("right", pose) +
    `<g transform='translate(${r2(pose.lunge || 0)} ${r2(yShift)})'>` +
      restingShield(pose, guard) +
      torsoRight() +
      raisedShield("right", pose, guard) +
      swordArm("right", pose, weapon) +
      sword(weapon.x, weapon.y, weapon.angle) +
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
  const weapon = swordPose("left", pose);
  const guard = shieldPose("left", pose);
  return (
    groundShadow() +
    legs("left", pose) +
    `<g transform='translate(${r2(-(pose.lunge || 0))} ${r2(yShift)})'>` +
      restingShield(pose, guard) +
      torsoLeft() +
      raisedShield("left", pose, guard) +
      swordArm("left", pose, weapon) +
      sword(weapon.x, weapon.y, weapon.angle) +
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

function spriteSVG(dir, pose, frame) {
  const draw = DRAW_POSE[dir];
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
    sprites[dir] = WALK.map((pose, frame) => makeImage(spriteSVG(dir, pose, frame)));
  }
  return sprites;
}

export function buildAttackSprites() {
  const sprites = {};
  for (const dir of DIRECTIONS) {
    sprites[dir] = ATTACK.map((pose, frame) => makeImage(spriteSVG(dir, pose, frame)));
  }
  return sprites;
}
