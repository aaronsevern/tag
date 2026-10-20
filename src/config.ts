export const WIDTH = 1280;
export const HEIGHT = 720;
export const GRAVITY = 1200;

export const PLAYER_SIZE = 36;

// Movement (px/s, px/s^2)
export const RUN_SPEED = 260;
export const GROUND_ACCEL = 2200;
export const GROUND_DRAG = 2000;
export const AIR_ACCEL = 1400;
export const AIR_DRAG = 500;
export const JUMP_VELOCITY = 620;
export const JUMP_CUT_VELOCITY = 250;
export const TRAMPOLINE_VELOCITY = 1050;
export const WALL_BOUNCE_VX = 750;
export const WALL_BOUNCE_VY = 380;
export const CLIMB_SPEED = 220;
export const LADDER_TOP_POP = 260;
export const MAX_FALL_SPEED = 1100;

// Slide: alternate left/right quickly to build charge, then glide on "ice"
export const FLIP_WINDOW_MS = 280;
export const CHARGE_PER_FLIP = 0.25;
export const MAX_CHARGE = 1.5;
export const MIN_SLIDE_CHARGE = 0.5;
export const ICE_DRAG = 300;
export const SLIDE_BRAKE = 1600;

// Rules
export const ROUND_MS = 3 * 60 * 1000;
export const TAG_COOLDOWN_MS = 1500;
export const COUNTDOWN_SECONDS = 3;

// Economy
export const SKIN_PRICE = 10;
export const TRAIL_PRICE = 10;
export const ACCESSORY_PRICE = 10;
export const WIN_COINS = 5;
export const SURVIVOR_COINS = 2;

// Portals: one pair at a time, removed once someone travels through
export const PORTAL_SPAWN_MIN_MS = 8000;
export const PORTAL_SPAWN_MAX_MS = 15000;
export const PORTAL_RADIUS = 26;
export const PORTAL_COLORS = [0x38d9ff, 0xff9a2e];

export const PLAYER_COLORS = [0x3d8bff, 0xff4d5e, 0x3fd46b];
export const PLAYER_NAMES = ['Blue', 'Red', 'Green'];

export const COLORS = {
  background: 0x1d2333,
  platform: 0x6b5a86,
  platformTop: 0x9f8bc4,
  floor: 0x3e3552,
  ladder: 0xc89b5b,
  text: '#f4f1ff',
};

export function hex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
