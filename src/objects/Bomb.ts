import Phaser from 'phaser';
import type { Player } from './Player';

const OFFSET_Y = 68; // clears the name tag and any hat

/** Bomb indicator that floats above whichever player is "it". */
export class Bomb {
  readonly body: Phaser.GameObjects.Image;
  private readonly spark: Phaser.GameObjects.Image;
  private target: Player;
  private t = 0;

  constructor(scene: Phaser.Scene, target: Player) {
    this.target = target;
    this.body = scene.add.image(target.x, target.y - OFFSET_Y, 'bomb').setDepth(20);
    this.spark = scene.add.image(0, 0, 'spark').setDepth(21);
  }

  setTarget(target: Player): void {
    this.target = target;
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  update(deltaMs: number): void {
    this.t += deltaMs;
    const bob = Math.sin(this.t / 180) * 3;
    const tx = this.target.x;
    const ty = this.target.y - OFFSET_Y + bob;
    // Ease toward the target so the bomb visibly flies to a newly tagged player.
    this.body.x += (tx - this.body.x) * 0.3;
    this.body.y += (ty - this.body.y) * 0.3;
    this.body.setAngle(Math.sin(this.t / 260) * 8);

    // Fuse tip is at the top-right of the texture.
    const tip = new Phaser.Math.Vector2(9, -17).rotate(this.body.rotation);
    this.spark.setPosition(this.body.x + tip.x, this.body.y + tip.y);
    this.spark.setScale(0.7 + Math.random() * 0.6);
    this.spark.setAlpha(0.7 + Math.random() * 0.3);
  }

  destroy(): void {
    this.body.destroy();
    this.spark.destroy();
  }
}
