// Normal Combat — character data.
// Edit numbers here to tune fighters. Stats are 1–5 (see docs/STORY.md).
// Move timings are in frames (60 frames = 1 second) before the speed stat is applied.

const CHARACTERS = {
  alan: {
    name: 'ALAN',
    color: '#3fae49',   // lawn green
    dark: '#1d5e26',
    accent: '#d9c48a',  // straw hat
    w: 68, h: 132,
    stats: { speed: 2, power: 4, range: 5, defense: 2, health: 3 },
    homeStage: 'lawn',
    specials: {
      sp1: { name: 'Hose Lasso', type: 'lasso', startup: 14, reachMax: 400, extendSpeed: 24,
             recovery: 26, dmg: 4, hitstun: 42, yb: 70, h: 18, shout: 'GET OFF MY LAWN!' },
      sp2: { name: 'Weed and Feed', type: 'spray', startup: 12, recovery: 26, particles: 10,
             dmg: 2, hitstun: 12, poison: { frames: 150, rate: 0.06 }, patchLife: 420 },
      sp3: { name: 'Rake Swing', type: 'melee', startup: 16, active: 8, recovery: 30,
             reach: 118, yb: 30, h: 75, dmg: 13, kd: true },
    },
    intro: { home: '*pats his grass... points at your feet*', away: '*pats the ground... throws hands up*' },
    winPose: '*plants the rake, leans on it, points*',
    winQuote: "Now THAT'S curb appeal.",
    taunt: 'Shoo! Shoo!',
    violation: { name: 'SOD OFF', steps: [
      { text: '*unrolls a strip of sod*' },
      { text: '*rolls them up like a burrito*', fx: 'roll' },
      { text: '*slaps on a BULK PICKUP sticker*', fx: 'sticker' },
      { text: 'beep... beep... beep...' },
    ] },
    neighborly: { name: 'THE GIFT', steps: [
      { text: '*hands over a bag of premium grass seed*' },
      { text: '"For your yard."' },
      { text: '*wipes away a single tear*' },
    ] },
  },

  tasha: {
    name: 'TASHA',
    color: '#8e44c9',   // purple scrubs
    dark: '#4a1f6e',
    accent: '#1b1b1b',  // hair puff
    gloves: '#111111',
    w: 58, h: 126,
    stats: { speed: 5, power: 2, range: 2, defense: 3, health: 3 },
    homeStage: 'driveway',
    specials: {
      sp1: { name: 'Night Shift Flurry', type: 'melee', startup: 4, active: 30, recovery: 14,
             reach: 72, yb: 60, h: 40, dmg: 3, hitstun: 14, multi: 6 },
      sp2: { name: 'Scrub Rush', type: 'dash', startup: 6, dashFrames: 18, dashSpeed: 13,
             recovery: 16, dmg: 10, hitstun: 24 },
      sp3: { name: 'Clipboard Toss', type: 'projectile', startup: 7, recovery: 14,
             speed: 11, range: 280, dmg: 5, hitstun: 18 },
    },
    intro: { home: '*big stretch... YAWN... fighting stance*', away: '*big stretch... YAWN... fighting stance*' },
    winPose: '*checks her watch, walks off waving*',
    winQuote: "My shift's over.",
    taunt: '*taps wrist* Still slow.',
    violation: { name: 'DISCHARGED', steps: [
      { text: '*slaps on a hospital wristband*' },
      { text: '*drops them into a wheelchair*', fx: 'chair' },
      { text: '*ROUNDHOUSE KICK!*', fx: 'launch' },
      { text: 'CRASH!' },
    ] },
    neighborly: { name: 'CHECK-UP', steps: [
      { text: '*checks their pulse*' },
      { text: '*thumbs up*' },
      { text: '*hands them a lollipop*' },
    ] },
  },
};

// Basic moves shared by every fighter. yb = height of hitbox bottom above the feet.
const BASIC_MOVES = {
  punch:    { name: 'Punch',    type: 'melee', startup: 5, active: 4, recovery: 9,  reach: 55, yb: 85, h: 26, dmg: 5, hitstun: 16 },
  kick:     { name: 'Kick',     type: 'melee', startup: 8, active: 5, recovery: 14, reach: 76, yb: 50, h: 30, dmg: 7, hitstun: 18 },
  uppercut: { name: 'Uppercut', type: 'melee', startup: 8, active: 5, recovery: 22, reach: 50, yb: 40, h: 90, dmg: 10, kd: true },
  sweep:    { name: 'Sweep',    type: 'melee', startup: 8, active: 6, recovery: 18, reach: 86, yb: 0,  h: 22, dmg: 6, kd: true },
  airKick:  { name: 'Air Kick', type: 'air',   startup: 4, active: 99, recovery: 0, reach: 62, yb: 30, h: 32, dmg: 7, hitstun: 18 },
};

const STAGES = {
  lawn: { name: "Alan's Front Lawn" },
  driveway: { name: "Tasha's Driveway at Dawn" },
};
