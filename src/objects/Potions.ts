import Phaser from 'phaser';
import { POTION_COLOR, POTION_RADIUS, POTION_SPAWN_MAX_MS, POTION_SPAWN_MIN_MS } from '../config';
import type { LevelDef } from '../level';
import type { Player } from './Player';
import { pickSpot } from './spawnSpot';

export type PotionEffect = 'speed' | 'slow' | 'jump' | 'slowFall' | 'invincible' | 'grow' | 'reversed';

export const POTION_NAMES: Record<PotionEffect, string> = {
  speed: 'Speed',
  slow: 'Slowness',
  jump: 'Jump Boost',
  slowFall: 'Slow Falling',
  invincible: 'Invincible',
  grow: 'Grow',
  reversed: 'Reversed Keys',
};

const EFFECTS = Object.keys(POTION_NAMES) as PotionEffect[];

/**
 * Spawns one mystery potion at a time at a random spot on a platform. Every
 * potion looks the same; touching it applies a random effect, then it vanishes
 * and the next one is scheduled.
 */
export class Potions {
  private readonly scene: Phaser.Scene;
  private readonly level: LevelDef;
  private potion: Phaser.GameObjects.Image | null = null;
  private nextSpawnAt = Infinity;

  constructor(scene: Phaser.Scene, level: LevelDef) {
    this.scene = scene;
    this.level = level;
  }

  start(now: number): void {
    this.scheduleNext(now);
  }

  update(now: number, players: Player[]): void {
    const potion = this.potion;
    if (!potion) {
      if (now >= this.nextSpawnAt) this.spawn(players);
      return;
    }

    const player = players.find(
      (p) => Phaser.Math.Distance.Between(p.x, p.y, potion.x, potion.y) < POTION_RADIUS,
    );
    if (!player) return;

    const effect = Phaser.Utils.Array.GetRandom(EFFECTS);
    player.applyEffect(effect);
    this.announce(player, POTION_NAMES[effect]);
    this.burst(potion.x, potion.y);
    this.vanish(potion);
    this.potion = null;
    this.scheduleNext(now);
  }

  stop(): void {
    this.nextSpawnAt = Infinity;
    if (this.potion) this.vanish(this.potion);
    this.potion = null;
  }

  private scheduleNext(now: number): void {
    this.nextSpawnAt = now + Phaser.Math.Between(POTION_SPAWN_MIN_MS, POTION_SPAWN_MAX_MS);
  }

  private spawn(players: Player[]): void {
    const spot = pickSpot(this.level, players, POTION_RADIUS);
    if (!spot) {
      // Crowded arena; try again shortly.
      this.nextSpawnAt = this.scene.time.now + 1000;
      return;
    }

    const potion = this.scene.add.image(spot.x, spot.y, 'potion').setDepth(5).setScale(0);
    this.scene.tweens.add({ targets: potion, scale: 1, duration: 350, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: potion,
      y: spot.y - 5,
      duration: 700,
      yoyo: true,
      repeat: -1,
      delay: 350,
      ease: 'Sine.easeInOut',
    });
    this.burst(spot.x, spot.y);
    this.potion = potion;
  }

  private announce(player: Player, name: string): void {
    const text = this.scene.add
      .text(player.x, player.y - 40, `${name}!`, {
        fontFamily: 'Arial Black, Arial',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#000000', 5)
      .setDepth(30);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 50,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeIn',
      onComplete: () => text.destroy(),
    });
  }

  private vanish(potion: Phaser.GameObjects.Image): void {
    this.scene.tweens.killTweensOf(potion);
    this.scene.tweens.add({
      targets: potion,
      scale: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => potion.destroy(),
    });
  }

  private burst(x: number, y: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 60, max: 220 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      color: [0xffffff, POTION_COLOR],
      emitting: false,
    });
    emitter.setDepth(6);
    emitter.explode(24);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }
}
