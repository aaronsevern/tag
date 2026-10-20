import Phaser from 'phaser';
import { PLAYER_COLORS, PLAYER_SIZE } from './config';
import { DEFAULT_ACCESSORY, DEFAULT_SKIN, DEFAULT_TRAIL } from './profiles';

type G = Phaser.GameObjects.Graphics;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

export interface SkinDef {
  id: string;
  name: string;
  draw(g: G, color: number, s: number, top: number): void;
}

/** Drawn on a transparent layer above any skin. `top` is where the body starts. */
export interface AccessoryDef {
  id: string;
  name: string;
  /** Rises above the body, so the name tag sits higher. */
  tall?: boolean;
  draw?(g: G, s: number, top: number): void;
}

export interface TrailDef {
  id: string;
  name: string;
  texture?: string;
  config?(color: number): EmitterConfig;
}

const { IntegerToColor } = Phaser.Display.Color;
const lighter = (c: number, amt: number) => IntegerToColor(c).lighten(amt).color;
const darker = (c: number, amt: number) => IntegerToColor(c).darken(amt).color;

/** Headroom above the body in accessory textures. */
const ACCESSORY_TOP = 12;
const RAINBOW = [0xff4d4d, 0xff9f2e, 0xffe14d, 0x4dd96b, 0x4da6ff, 0xa45cff];

function body(g: G, fill: number, s: number, top: number, alpha = 1): void {
  g.fillStyle(0x000000, 0.35 * alpha).fillRoundedRect(0, top + 2, s, s - 2, 6);
  g.fillStyle(fill, alpha).fillRoundedRect(0, top, s, s - 2, 6);
}

function shine(g: G, s: number, top: number): void {
  g.fillStyle(0xffffff, 0.25).fillRoundedRect(3, top + 3, s - 6, 8, 4);
}

function eyes(g: G, s: number, top: number): void {
  g.fillStyle(0xffffff, 1).fillCircle(s * 0.38, top + s * 0.42, 5).fillCircle(s * 0.68, top + s * 0.42, 5);
  g.fillStyle(0x111111, 1).fillCircle(s * 0.42, top + s * 0.44, 2.5).fillCircle(s * 0.72, top + s * 0.44, 2.5);
}

/** Body in `fill` framed by a border in the slot colour, so players stay recognisable. */
function framed(g: G, color: number, fill: number, s: number, top: number): void {
  body(g, color, s, top);
  g.fillStyle(fill, 1).fillRoundedRect(3, top + 3, s - 6, s - 8, 4);
}

function classic(g: G, color: number, s: number, top: number): void {
  body(g, color, s, top);
  shine(g, s, top);
  eyes(g, s, top);
}

export const SKINS: SkinDef[] = [
  { id: DEFAULT_SKIN, name: 'Classic', draw: classic },
  // Patterns
  {
    id: 'stripes',
    name: 'Stripes',
    draw(g, c, s, top) {
      body(g, c, s, top);
      g.fillStyle(darker(c, 18), 1);
      for (let y = top + 6; y < top + s - 6; y += 8) g.fillRect(2, y, s - 4, 4);
      eyes(g, s, top);
    },
  },
  {
    id: 'polka',
    name: 'Polka Dots',
    draw(g, c, s, top) {
      body(g, c, s, top);
      g.fillStyle(lighter(c, 22), 1);
      for (const [x, y] of [[7, 7], [27, 6], [17, 28], [6, 27], [29, 26], [18, 4]]) g.fillCircle(x, top + y, 3);
      eyes(g, s, top);
    },
  },
  {
    id: 'checker',
    name: 'Checker',
    draw(g, c, s, top) {
      body(g, c, s, top);
      g.fillStyle(darker(c, 15), 1);
      for (let y = 0; y < s - 6; y += 6)
        for (let x = 2; x < s - 4; x += 6) if (((x - 2) / 6 + y / 6) % 2 === 0) g.fillRect(x, top + 2 + y, 6, 6);
      eyes(g, s, top);
    },
  },
  {
    id: 'zigzag',
    name: 'Zigzag',
    draw(g, c, s, top) {
      body(g, c, s, top);
      g.lineStyle(3, lighter(c, 25), 1);
      for (const y of [top + 26, top + 31]) {
        g.beginPath();
        g.moveTo(2, y);
        for (let x = 2, up = true; x < s - 2; x += 5, up = !up) g.lineTo(x + 5, y + (up ? -4 : 0));
        g.strokePath();
      }
      eyes(g, s, top);
    },
  },
  // Shades
  { id: 'dark', name: 'Midnight', draw: (g, c, s, top) => classic(g, darker(c, 22), s, top) },
  { id: 'light', name: 'Pastel', draw: (g, c, s, top) => classic(g, lighter(c, 20), s, top) },
  {
    id: 'neon',
    name: 'Neon',
    draw(g, c, s, top) {
      body(g, 0x111118, s, top);
      g.lineStyle(3, lighter(c, 15), 1).strokeRoundedRect(2, top + 1, s - 4, s - 5, 5);
      g.lineStyle(1, 0xffffff, 0.9).strokeRoundedRect(4, top + 3, s - 8, s - 9, 4);
      eyes(g, s, top);
    },
  },
  // Specials
  {
    id: 'gold',
    name: 'Gold',
    draw(g, c, s, top) {
      framed(g, c, 0xffcf3a, s, top);
      g.fillStyle(0xfff3a8, 0.8).fillRect(6, top + 5, s - 12, 4);
      g.fillStyle(0xd99a16, 1).fillRect(6, top + s - 10, s - 12, 3);
      eyes(g, s, top);
    },
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    draw(g, c, s, top) {
      framed(g, c, 0x1a1240, s, top);
      g.fillStyle(0x6a3fd1, 0.6).fillCircle(s * 0.3, top + s * 0.7, 8);
      g.fillStyle(0xd14fa8, 0.4).fillCircle(s * 0.7, top + s * 0.25, 7);
      let seed = 7;
      const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 14; i++) g.fillRect(4 + rand() * (s - 9), top + 4 + rand() * (s - 11), 1.5, 1.5);
      eyes(g, s, top);
    },
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    draw(g, c, s, top) {
      body(g, c, s, top);
      const h = (s - 8) / RAINBOW.length;
      RAINBOW.forEach((col, i) => g.fillStyle(col, 1).fillRect(3, top + 3 + i * h, s - 6, h + 0.5));
      eyes(g, s, top);
    },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    draw(g, c, s, top) {
      body(g, c, s, top, 0.45);
      g.lineStyle(2, c, 1).strokeRoundedRect(1, top + 1, s - 2, s - 4, 6);
      eyes(g, s, top);
    },
  },
];

export const ACCESSORIES: AccessoryDef[] = [
  { id: DEFAULT_ACCESSORY, name: 'None' },
  {
    id: 'shades',
    name: 'Shades',
    draw(g, s, top) {
      g.fillStyle(0x111111, 1)
        .fillRoundedRect(s * 0.22, top + s * 0.32, 11, 8, 3)
        .fillRoundedRect(s * 0.54, top + s * 0.32, 11, 8, 3)
        .fillRect(s * 0.22, top + s * 0.34, s * 0.6, 2);
      g.fillStyle(0xffffff, 0.5).fillRect(s * 0.26, top + s * 0.35, 3, 2).fillRect(s * 0.58, top + s * 0.35, 3, 2);
    },
  },
  {
    id: 'tophat',
    name: 'Top Hat',
    tall: true,
    draw(g, s, top) {
      g.fillStyle(0x15151a, 1).fillRect(5, top - 3, s - 10, 4).fillRect(10, 0, s - 20, top - 2);
      g.fillStyle(0xd23b3b, 1).fillRect(10, top - 6, s - 20, 3);
    },
  },
  {
    id: 'crown',
    name: 'Crown',
    tall: true,
    draw(g, s, top) {
      g.fillStyle(0xffcf3a, 1).fillRect(8, top - 5, s - 16, 6);
      for (const x of [8, 15, 22]) g.fillTriangle(x, top - 4, x + 6, top - 4, x + 3, 1);
      g.fillStyle(0xe8364d, 1).fillCircle(s / 2, top - 2, 2);
    },
  },
  {
    id: 'bow',
    name: 'Bow',
    tall: true,
    draw(g, s, top) {
      const cx = s * 0.72;
      const cy = top - 2;
      g.fillStyle(0xff6fb5, 1)
        .fillTriangle(cx, cy, cx - 9, cy - 7, cx - 9, cy + 6)
        .fillTriangle(cx, cy, cx + 9, cy - 7, cx + 9, cy + 6);
      g.fillStyle(0xd94a92, 1).fillCircle(cx, cy, 3);
    },
  },
  {
    id: 'party',
    name: 'Party Hat',
    tall: true,
    draw(g, s, top) {
      const cx = s / 2;
      g.fillStyle(0x9b5cff, 1).fillTriangle(cx - 9, top + 1, cx + 9, top + 1, cx, 0);
      g.fillStyle(0xffe14d, 1).fillTriangle(cx - 5, top - 5, cx + 5, top - 5, cx, top - 9);
      g.fillStyle(0xff6fb5, 1).fillCircle(cx, 1.5, 2.5);
    },
  },
  {
    id: 'halo',
    name: 'Halo',
    tall: true,
    draw(g, s, top) {
      g.lineStyle(3, 0xfff2a8, 1).strokeEllipse(s / 2, top - 5, s * 0.6, 7);
      g.lineStyle(1, 0xffffff, 0.8).strokeEllipse(s / 2, top - 5, s * 0.6, 7);
    },
  },
  {
    id: 'headphones',
    name: 'Headphones',
    tall: true,
    draw(g, s, top) {
      g.lineStyle(3, 0x2b2b33, 1).beginPath();
      g.arc(s / 2, top + 8, s / 2 - 1, Math.PI, 0);
      g.strokePath();
      g.fillStyle(0x2b2b33, 1).fillRoundedRect(0, top + 6, 7, 13, 3).fillRoundedRect(s - 7, top + 6, 7, 13, 3);
      g.fillStyle(0xff4d5e, 1).fillRect(0, top + 9, 2, 7).fillRect(s - 2, top + 9, 2, 7);
    },
  },
  {
    id: 'mustache',
    name: 'Mustache',
    draw(g, s, top) {
      const y = top + s * 0.68;
      g.fillStyle(0x3a2412, 1)
        .fillEllipse(s * 0.42, y, 11, 5)
        .fillEllipse(s * 0.62, y, 11, 5)
        .fillCircle(s * 0.3, y - 1, 2.5)
        .fillCircle(s * 0.74, y - 1, 2.5);
    },
  },
];

export const TRAILS: TrailDef[] = [
  { id: DEFAULT_TRAIL, name: 'No Trail' },
  {
    id: 'sparkles',
    name: 'Sparkles',
    texture: 'particle',
    config: (c) => ({
      speed: { min: 10, max: 50 },
      lifespan: 500,
      scale: { start: 1.1, end: 0 },
      color: [0xffffff, lighter(c, 20)],
      frequency: 22,
      blendMode: 'ADD',
    }),
  },
  {
    id: 'fire',
    name: 'Fire',
    texture: 'particle',
    config: () => ({
      speedX: { min: -20, max: 20 },
      speedY: { min: -60, max: -20 },
      lifespan: 380,
      scale: { start: 1.4, end: 0 },
      color: [0xfff3a0, 0xffa62b, 0xff4d1f, 0x802010],
      frequency: 18,
      blendMode: 'ADD',
    }),
  },
  {
    id: 'bubbles',
    name: 'Bubbles',
    texture: 'bubble',
    config: () => ({
      speedX: { min: -15, max: 15 },
      speedY: { min: -50, max: -20 },
      lifespan: 900,
      scale: { start: 0.4, end: 1 },
      alpha: { start: 0.9, end: 0 },
      frequency: 70,
    }),
  },
  {
    id: 'stars',
    name: 'Stars',
    texture: 'star',
    config: () => ({
      speed: { min: 20, max: 70 },
      lifespan: 600,
      rotate: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0.2 },
      frequency: 35,
    }),
  },
  {
    id: 'hearts',
    name: 'Hearts',
    texture: 'heart',
    config: () => ({
      speedX: { min: -20, max: 20 },
      speedY: { min: -40, max: -10 },
      lifespan: 800,
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 1, end: 0 },
      frequency: 80,
    }),
  },
  {
    id: 'smoke',
    name: 'Smoke',
    texture: 'particle',
    config: () => ({
      speed: { min: 5, max: 25 },
      lifespan: 700,
      scale: { start: 1, end: 3 },
      alpha: { start: 0.45, end: 0 },
      color: [0xaaaaaa, 0x555555],
      frequency: 40,
    }),
  },
  {
    id: 'confetti',
    name: 'Confetti',
    texture: 'confetti',
    config: () => ({
      speed: { min: 50, max: 120 },
      angle: { min: 200, max: 340 },
      gravityY: 300,
      lifespan: 900,
      rotate: { min: 0, max: 360 },
      color: RAINBOW,
      frequency: 35,
    }),
  },
];

export function skinDef(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function trailDef(id: string): TrailDef {
  return TRAILS.find((t) => t.id === id) ?? TRAILS[0];
}

export function skinTextureKey(skinId: string, slot: number): string {
  return `skin_${skinDef(skinId).id}_${slot}`;
}

export function accessoryDef(id: string): AccessoryDef {
  return ACCESSORIES.find((a) => a.id === id) ?? ACCESSORIES[0];
}

const accessoryTextureKey = (id: string) => `acc_${accessoryDef(id).id}`;
/** Anchors accessory textures on the body centre, below the headroom. */
const ACCESSORY_ORIGIN_Y = (ACCESSORY_TOP + PLAYER_SIZE / 2) / (PLAYER_SIZE + ACCESSORY_TOP);

/** Height the accessory rises above the body top (for placing name tags). */
export function accessoryHeadroom(id: string): number {
  return accessoryDef(id).tall ? ACCESSORY_TOP : 0;
}

/**
 * A character's appearance: skin image with the accessory layered on top,
 * both centred on (0, 0). Flip by giving the container a negative scaleX.
 */
export type Look = Phaser.GameObjects.Container;

export function createLook(scene: Phaser.Scene, x: number, y: number, slot: number, skin: string, accessory: string): Look {
  const bodyImg = scene.add.image(0, 0, skinTextureKey(skin, slot));
  const accImg = scene.add.image(0, 0, accessoryTextureKey(DEFAULT_ACCESSORY)).setOrigin(0.5, ACCESSORY_ORIGIN_Y);
  const look = scene.add.container(x, y, [bodyImg, accImg]);
  setLook(look, slot, skin, accessory);
  return look;
}

export function setLook(look: Look, slot: number, skin: string, accessory: string): void {
  const [bodyImg, accImg] = look.list as Phaser.GameObjects.Image[];
  bodyImg.setTexture(skinTextureKey(skin, slot));
  const acc = accessoryDef(accessory);
  accImg.setVisible(!!acc.draw);
  if (acc.draw) accImg.setTexture(accessoryTextureKey(acc.id));
}

/** Burnt look after the bomb goes off. */
export function charLook(look: Look): void {
  const [bodyImg, accImg] = look.list as Phaser.GameObjects.Image[];
  bodyImg.setTexture('charred');
  accImg.setVisible(false);
}

/** Particle emitter for a trail, or null for "No Trail". Caller positions/follows it. */
export function createTrail(
  scene: Phaser.Scene,
  trailId: string,
  color: number,
): Phaser.GameObjects.Particles.ParticleEmitter | null {
  const def = trailDef(trailId);
  if (!def.config || !def.texture) return null;
  return scene.add.particles(0, 0, def.texture, def.config(color));
}

/** Generates every skin for every slot colour, accessory overlays and trail particle textures. */
export function generateCosmeticTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const S = PLAYER_SIZE;

  for (const skin of SKINS) {
    PLAYER_COLORS.forEach((color, slot) => {
      g.clear();
      skin.draw(g, color, S, 0);
      g.generateTexture(skinTextureKey(skin.id, slot), S, S);
    });
  }

  for (const acc of ACCESSORIES) {
    g.clear();
    acc.draw?.(g, S, ACCESSORY_TOP);
    g.generateTexture(accessoryTextureKey(acc.id), S, S + ACCESSORY_TOP);
  }

  g.clear();
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 7 : 3;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(8 + Math.cos(a) * r, 8 + Math.sin(a) * r));
  }
  g.fillStyle(0xffe066, 1).fillPoints(pts, true);
  g.generateTexture('star', 16, 16);

  g.clear();
  g.fillStyle(0xff4f8b, 1).fillCircle(5, 5, 4.5).fillCircle(11, 5, 4.5).fillTriangle(0.8, 7, 15.2, 7, 8, 15);
  g.generateTexture('heart', 16, 16);

  g.clear();
  g.lineStyle(1.5, 0xbfefff, 1).strokeCircle(7, 7, 6);
  g.fillStyle(0xffffff, 0.8).fillCircle(5, 5, 1.5);
  g.generateTexture('bubble', 14, 14);

  g.clear();
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 7, 3);
  g.generateTexture('confetti', 7, 3);

  g.destroy();
}
