import Phaser from 'phaser';
import {
  AIR_ACCEL,
  AIR_DRAG,
  CHARGE_PER_FLIP,
  CLIMB_SPEED,
  FLIP_WINDOW_MS,
  GROUND_ACCEL,
  GROUND_DRAG,
  ICE_DRAG,
  JUMP_CUT_VELOCITY,
  JUMP_VELOCITY,
  LADDER_TOP_POP,
  MAX_CHARGE,
  MAX_FALL_SPEED,
  MIN_SLIDE_CHARGE,
  PLAYER_COLORS,
  PLAYER_SIZE,
  RUN_SPEED,
  SLIDE_BRAKE,
  TRAMPOLINE_VELOCITY,
  WALL_BOUNCE_VX,
  WALL_BOUNCE_VY,
} from '../config';
import type { PlayerControls } from '../controls';
import { accessoryHeadroom, createLook, createTrail, skinTextureKey, type Look } from '../cosmetics';
import { LADDER_WIDTH, type LadderDef } from '../level';

export interface PlayerLook {
  name: string;
  skin: string;
  accessory: string;
  trail: string;
}

const TRAIL_MIN_SPEED = 120;

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

/**
 * The physics sprite is invisible; `visual` is drawn in its place so it can
 * squash and stretch without changing the physics body.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly index: number;
  readonly label: string;
  readonly color: number;
  readonly visual: Look;
  readonly nameTag: Phaser.GameObjects.Text;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter | null;
  private readonly tagOffset: number;
  readonly controls: PlayerControls;

  inputEnabled = false;
  climbing = false;
  sliding = false;
  itMs = 0;

  private slideDir = 0;
  private charge = 0;
  private lastPressDir = 0;
  private lastPressAt = -Infinity;
  private jumping = false;
  /** Set by trampolines: flies through ladders instead of grabbing them while rising. */
  private launched = false;
  // Key presses are queued from 'down' events: Phaser's JustDown misses taps
  // that start and end within one frame, which rapid slide tapping produces.
  private pressQueue: { dir: number; at: number }[] = [];
  private jumpQueued = false;
  private scaleX_ = 1;
  private scaleY_ = 1;

  constructor(scene: Phaser.Scene, index: number, x: number, y: number, controls: PlayerControls, look: PlayerLook) {
    // The physics sprite always uses the plain square so body size is identical for every skin.
    super(scene, x, y, skinTextureKey('classic', index));
    this.index = index;
    this.label = look.name;
    this.color = PLAYER_COLORS[index];
    this.controls = controls;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    this.setCollideWorldBounds(true);
    this.body.setMaxVelocityY(MAX_FALL_SPEED);

    this.visual = createLook(scene, x, y, index, look.skin, look.accessory).setDepth(10);
    this.nameTag = scene.add
      .text(x, y, look.name, { fontFamily: 'Arial', fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5, 1)
      .setStroke('#000000', 3)
      .setAlpha(0.85)
      .setDepth(11);
    this.tagOffset = PLAYER_SIZE / 2 + 4 + accessoryHeadroom(look.accessory);
    this.trail = createTrail(scene, look.trail, this.color);
    if (this.trail) {
      this.trail.setDepth(9).startFollow(this.visual);
      this.trail.emitting = false;
    }

    const onLeft = (_k: unknown, e: KeyboardEvent) => this.queuePress(-1, e.timeStamp);
    const onRight = (_k: unknown, e: KeyboardEvent) => this.queuePress(1, e.timeStamp);
    const onUp = () => {
      if (this.inputEnabled) this.jumpQueued = true;
    };
    controls.left.on('down', onLeft);
    controls.right.on('down', onRight);
    controls.up.on('down', onUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      controls.left.off('down', onLeft);
      controls.right.off('down', onRight);
      controls.up.off('down', onUp);
    });
  }

  private queuePress(dir: number, at: number): void {
    if (this.inputEnabled) this.pressQueue.push({ dir, at });
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  update(deltaMs: number, ladders: LadderDef[]): void {
    const dt = deltaMs / 1000;
    const c = this.controls;
    const en = this.inputEnabled;
    const left = en && c.left.isDown;
    const right = en && c.right.isDown;
    const up = en && c.up.isDown;
    const down = en && c.down.isDown;
    const upJust = this.jumpQueued;
    const presses = this.pressQueue;
    this.jumpQueued = false;
    this.pressQueue = [];
    const dir = (right ? 1 : 0) - (left ? 1 : 0);

    const ladder = this.findLadder(ladders);

    if (this.climbing) {
      this.updateClimb(ladder, up, down, dir);
      return;
    }

    if (this.launched && this.body.velocity.y >= 0) this.launched = false;

    if (ladder && !this.launched) {
      const b = this.body;
      if ((up && ladder.top < b.center.y - 4) || (down && ladder.bottom > b.bottom + 4)) {
        this.startClimb(ladder);
        return;
      }
    }

    this.trackFlips(presses);

    let vx = this.body.velocity.x;
    if (this.sliding) {
      vx = approach(vx, 0, (dir === -this.slideDir ? SLIDE_BRAKE : ICE_DRAG) * dt);
      if (Math.abs(vx) <= RUN_SPEED) this.sliding = false;
    } else {
      const ground = this.onGround;
      const rate = dir !== 0 ? (ground ? GROUND_ACCEL : AIR_ACCEL) : ground ? GROUND_DRAG : AIR_DRAG;
      vx = approach(vx, dir * RUN_SPEED, rate * dt);
    }
    this.setVelocityX(vx);

    if (upJust && this.onGround) {
      this.setVelocityY(-JUMP_VELOCITY);
      this.jumping = true;
    }
    if (this.jumping) {
      if (this.body.velocity.y >= 0) {
        this.jumping = false;
      } else if (!up && this.body.velocity.y < -JUMP_CUT_VELOCITY) {
        // Releasing jump early gives a shorter hop.
        this.setVelocityY(-JUMP_CUT_VELOCITY);
        this.jumping = false;
      }
    }
  }

  /** Rapid left/right alternation builds charge; when it stops, launch a slide. */
  private trackFlips(presses: { dir: number; at: number }[]): void {
    for (const { dir, at } of presses) {
      if (dir !== this.lastPressDir) {
        this.charge = at - this.lastPressAt < FLIP_WINDOW_MS
          ? Math.min(MAX_CHARGE, this.charge + CHARGE_PER_FLIP)
          : 0;
      }
      this.lastPressDir = dir;
      this.lastPressAt = at;
    }

    // Press times come from KeyboardEvent.timeStamp, so compare on the same clock.
    if (this.charge > 0 && performance.now() - this.lastPressAt > FLIP_WINDOW_MS) {
      if (this.charge >= MIN_SLIDE_CHARGE) this.startSlide(this.lastPressDir, this.charge);
      this.charge = 0;
    }
  }

  private startSlide(dir: number, charge: number): void {
    this.sliding = true;
    this.slideDir = dir;
    this.setVelocityX(dir * RUN_SPEED * (1 + charge));
  }

  private findLadder(ladders: LadderDef[]): LadderDef | undefined {
    const b = this.body;
    const halfReach = LADDER_WIDTH / 2 + 6;
    return ladders.find(
      (l) =>
        Math.abs(b.center.x - l.cx) < halfReach &&
        b.top < l.bottom &&
        b.bottom + 4 > l.top,
    );
  }

  private startClimb(ladder: LadderDef): void {
    this.climbing = true;
    this.sliding = false;
    this.jumping = false;
    this.charge = 0;
    this.body.setAllowGravity(false);
    this.setVelocity(0, 0);
    this.x = ladder.cx;
  }

  stopClimb(): void {
    if (!this.climbing) return;
    this.climbing = false;
    this.body.setAllowGravity(true);
  }

  private updateClimb(ladder: LadderDef | undefined, up: boolean, down: boolean, dir: number): void {
    if (!ladder) {
      this.stopClimb();
      return;
    }
    if (dir !== 0) {
      // Step off the side.
      this.stopClimb();
      this.setVelocityX(dir * RUN_SPEED);
      return;
    }
    if (up && this.body.center.y < ladder.top) {
      // Reached the top: hop up onto the platform.
      this.stopClimb();
      this.setVelocityY(-LADDER_TOP_POP);
      return;
    }
    if (down && this.body.blocked.down) {
      this.stopClimb();
      return;
    }
    this.setVelocity(0, up ? -CLIMB_SPEED : down ? CLIMB_SPEED : 0);
  }

  bounce(): void {
    this.stopClimb();
    this.jumping = false;
    this.launched = true;
    this.setVelocityY(-TRAMPOLINE_VELOCITY);
    this.scaleX_ = 0.7;
    this.scaleY_ = 1.35;
  }

  /** Launched off a wall trampoline; reuses the slide glide so the push carries. */
  bounceSideways(dir: number): void {
    this.stopClimb();
    this.jumping = false;
    this.launched = true;
    this.charge = 0;
    this.sliding = true;
    this.slideDir = dir;
    this.lastPressDir = dir;
    this.setVelocity(dir * WALL_BOUNCE_VX, -WALL_BOUNCE_VY);
    this.scaleX_ = 0.65;
    this.scaleY_ = 1.3;
  }

  /** Move instantly, keeping current momentum. */
  teleport(x: number, y: number): void {
    this.stopClimb();
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    this.body.reset(x, y);
    this.body.setVelocity(vx, vy);
    this.scaleX_ = 0.3;
    this.scaleY_ = 0.3;
  }

  freeze(): void {
    this.inputEnabled = false;
    if (this.trail) this.trail.emitting = false;
    this.sliding = false;
    this.charge = 0;
  }

  /** Called after physics so the visual matches the body this frame. */
  syncVisual(): void {
    let tx = 1;
    let ty = 1;
    const vy = this.body.velocity.y;
    if (this.sliding && this.onGround) {
      tx = 1.3;
      ty = 0.7;
    } else if (this.charge > 0) {
      const k = this.charge / MAX_CHARGE;
      tx = 1 + 0.2 * k;
      ty = 1 - 0.2 * k;
    } else if (!this.onGround && !this.climbing) {
      const k = Phaser.Math.Clamp(Math.abs(vy) / 900, 0, 1) * 0.2;
      tx = 1 - k;
      ty = 1 + k;
    }
    this.scaleX_ += (tx - this.scaleX_) * 0.3;
    this.scaleY_ += (ty - this.scaleY_) * 0.3;

    // Keep the bottom edge planted while squashing.
    const yOffset = ((1 - this.scaleY_) * PLAYER_SIZE) / 2;
    this.visual.setPosition(this.x, this.y + yOffset);
    // Containers can't flipX; a negative scale mirrors skin and accessory together.
    this.visual.setScale(this.lastPressDir < 0 ? -this.scaleX_ : this.scaleX_, this.scaleY_);
    this.nameTag.setPosition(this.x, this.y - this.tagOffset);

    if (this.trail) {
      const moving = Math.abs(this.body.velocity.x) > TRAIL_MIN_SPEED || Math.abs(vy) > TRAIL_MIN_SPEED;
      this.trail.emitting = this.inputEnabled && moving;
    }
  }
}
