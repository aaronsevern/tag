import Phaser from 'phaser';
import {
  PORTAL_COLORS,
  PORTAL_RADIUS,
  PORTAL_SPAWN_MAX_MS,
  PORTAL_SPAWN_MIN_MS,
} from '../config';
import type { LevelDef } from '../level';
import type { Player } from './Player';
import { pickSpot } from './spawnSpot';

const MIN_PORTAL_GAP = 300;

/**
 * Spawns one pair of linked portals at a time at random spots on platforms.
 * Touching either end sends the player to the other; then both vanish and the
 * next pair is scheduled.
 */
export class Portals {
  private readonly scene: Phaser.Scene;
  private readonly level: LevelDef;
  private pair: Phaser.GameObjects.Image[] = [];
  private nextSpawnAt = Infinity;

  constructor(scene: Phaser.Scene, level: LevelDef) {
    this.scene = scene;
    this.level = level;
  }

  start(now: number): void {
    this.scheduleNext(now);
  }

  update(now: number, players: Player[]): void {
    if (this.pair.length === 0) {
      if (now >= this.nextSpawnAt) this.spawn(players);
      return;
    }

    for (const p of players) {
      const from = this.pair.findIndex(
        (portal) => Phaser.Math.Distance.Between(p.x, p.y, portal.x, portal.y) < PORTAL_RADIUS,
      );
      if (from === -1) continue;
      const to = this.pair[1 - from];
      p.teleport(to.x, to.y);
      this.close(now);
      return;
    }
  }

  stop(): void {
    this.nextSpawnAt = Infinity;
    for (const portal of this.pair) this.vanish(portal);
    this.pair = [];
  }

  private scheduleNext(now: number): void {
    this.nextSpawnAt = now + Phaser.Math.Between(PORTAL_SPAWN_MIN_MS, PORTAL_SPAWN_MAX_MS);
  }

  private spawn(players: Player[]): void {
    const a = pickSpot(this.level, players, PORTAL_RADIUS);
    const b = a && pickSpot(this.level, players, PORTAL_RADIUS, [a], MIN_PORTAL_GAP);
    if (!a || !b) {
      // Crowded arena; try again shortly.
      this.nextSpawnAt = this.scene.time.now + 1000;
      return;
    }

    this.pair = [a, b].map((spot, i) => {
      const portal = this.scene.add.image(spot.x, spot.y, `portal${i}`).setDepth(5).setScale(0);
      this.scene.tweens.add({ targets: portal, scale: 1, duration: 350, ease: 'Back.easeOut' });
      this.scene.tweens.add({
        targets: portal,
        scaleX: { from: 1, to: 0.85 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        delay: 350,
        ease: 'Sine.easeInOut',
      });
      this.burst(spot.x, spot.y, PORTAL_COLORS[i]);
      return portal;
    });
  }

  private close(now: number): void {
    this.pair.forEach((portal, i) => {
      this.burst(portal.x, portal.y, PORTAL_COLORS[i]);
      this.vanish(portal);
    });
    this.pair = [];
    this.scene.cameras.main.flash(120, 180, 140, 255);
    this.scheduleNext(now);
  }

  private vanish(portal: Phaser.GameObjects.Image): void {
    this.scene.tweens.killTweensOf(portal);
    this.scene.tweens.add({
      targets: portal,
      scale: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => portal.destroy(),
    });
  }

  private burst(x: number, y: number, color: number): void {
    const emitter = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 60, max: 220 },
      lifespan: 450,
      scale: { start: 1.2, end: 0 },
      color: [0xffffff, color],
      emitting: false,
    });
    emitter.setDepth(6);
    emitter.explode(24);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }
}
