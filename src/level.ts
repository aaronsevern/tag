// Arena layout. Rectangles use top-left coordinates.

export interface RectDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlatformDef extends RectDef {
  /** Solid on all sides; otherwise a one-way (jump-through) platform. */
  solid?: boolean;
}

export interface LadderDef {
  cx: number;
  top: number;
  bottom: number;
}

export interface WallTrampolineDef {
  side: 'left' | 'right';
  /** Top edge of the pad. */
  y: number;
}

export interface LevelDef {
  platforms: PlatformDef[];
  ladders: LadderDef[];
  trampolines: { x: number; y: number }[];
  wallTrampolines: WallTrampolineDef[];
  spawns: { x: number; y: number }[];
}

const T = 16; // platform thickness

export const LADDER_WIDTH = 30;
export const TRAMPOLINE_WIDTH = 64;
export const TRAMPOLINE_HEIGHT = 16;
export const WALL_TRAMPOLINE_WIDTH = 16;
export const WALL_TRAMPOLINE_HEIGHT = 96;

export const ARENA: LevelDef = {
  platforms: [
    { x: 0, y: 700, w: 1280, h: 20, solid: true },
    // lower tier
    { x: 40, y: 560, w: 240, h: T },
    { x: 510, y: 560, w: 260, h: T },
    { x: 1000, y: 560, w: 240, h: T },
    // middle tier
    { x: 220, y: 420, w: 280, h: T },
    { x: 780, y: 420, w: 280, h: T },
    // upper tier
    { x: 30, y: 280, w: 220, h: T },
    { x: 490, y: 280, w: 300, h: T },
    { x: 1030, y: 280, w: 220, h: T },
    // top tier
    { x: 300, y: 150, w: 200, h: T },
    { x: 780, y: 150, w: 200, h: T },
  ],
  ladders: [
    { cx: 100, top: 280, bottom: 560 },
    { cx: 640, top: 280, bottom: 560 },
    { cx: 1180, top: 280, bottom: 560 },
    { cx: 360, top: 420, bottom: 700 },
    { cx: 920, top: 420, bottom: 700 },
  ],
  trampolines: [
    { x: 16, y: 700 - TRAMPOLINE_HEIGHT },
    { x: 608, y: 700 - TRAMPOLINE_HEIGHT },
    { x: 1200, y: 700 - TRAMPOLINE_HEIGHT },
  ],
  // Pads centred at 1/4 and ~1/2 of the screen height.
  wallTrampolines: [
    { side: 'left', y: 132 },
    { side: 'left', y: 400 },
    { side: 'right', y: 132 },
    { side: 'right', y: 400 },
  ],
  spawns: [
    { x: 200, y: 640 },
    { x: 540, y: 640 },
    { x: 1080, y: 640 },
  ],
};
