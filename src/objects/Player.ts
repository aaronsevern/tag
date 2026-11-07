import Phaser from 'phaser';
import {
  AIR_ACCEL,
  AIR_DRAG,
  CHARGE_PER_FLIP,
  CLIMB_SPEED,
  FLIP_WINDOW_MS,
  GROUND_ACCEL,
  GROUND_DRAG,
  GROW_POTION_SCALE,
  ICE_DRAG,
  JUMP_CUT_VELOCITY,
  JUMP_POTION_SCALE,
  JUMP_VELOCITY,
  LADDER_TOP_POP,
  MAX_CHARGE,
  MAX_FALL_SPEED,
  MIN_SLIDE_CHARGE,
  PLAYER_COLORS,
  PLAYER_SIZE,
  POTION_DURATION_MS,
  RUN_SPEED,
  SLIDE_BRAKE,
  SLOW_FALL_SPEED,
  SLOW_POTION_SCALE,
  SPEED_POTION_SCALE,
  TRAMPOLINE_VELOCITY,
  WALL_BOUNCE_VX,
  WALL_BOUNCE_VY,
} from '../config';
import type { PlayerControls } from '../controls';
import { accessoryHeadroom, createLook, createTrail, skinTextureKey, type Look } from '../cosmetics';
import { LADDER_WIDTH, type LadderDef } from '../level';
import type { PotionEffect } from './Potions';

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
  private readonly invincibleRing: Phaser.GameObjects.Image;
  /** Active potion effects and their remaining ms. */
  private readonly effects = new Map<PotionEffect, number>();
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
    this.invincibleRing = scene.add.image(x, y, 'invincibleRing').setDepth(9).setVisible(false);

    const onLeft = (_k: unknown, e: KeyboardEvent) => this.queuePress(-1, e.timeStamp);
    const onRight = (_k: unknown, e: KeyboardEvent) => this.queuePress(1, e.timeStamp);
    const onUp = () => this.queueJump(false);
    const onDown = () => this.queueJump(true);
    controls.left.on('down', onLeft);
    controls.right.on('down', onRight);
    controls.up.on('down', onUp);
    controls.down.on('down', onDown);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      controls.left.off('down', onLeft);
      controls.right.off('down', onRight);
      controls.up.off('down', onUp);
      controls.down.off('down', onDown);
    });
  }

  private queuePress(dir: number, at: number): void {
    if (this.inputEnabled) this.pressQueue.push({ dir: this.hasEffect('reversed') ? -dir : dir, at });
  }

  /** The down key jumps instead of the up key while controls are reversed. */
  private queueJump(fromDownKey: boolean): void {
    if (this.inputEnabled && fromDownKey === this.hasEffect('reversed')) this.jumpQueued = true;
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  hasEffect(effect: PotionEffect): boolean {
    return this.effects.has(effect);
  }

  /** Starts an effect, or restarts its timer if already active. */
  applyEffect(effect: PotionEffect): void {
    if (effect === 'grow' && !this.hasEffect('grow')) {
      this.setScale(GROW_POTION_SCALE);
      // The body grows around its centre; lift it so the feet stay above the platform.
      this.y -= ((GROW_POTION_SCALE - 1) * PLAYER_SIZE) / 2;
    }
    this.effects.set(effect, POTION_DURATION_MS);
  }

  activeEffects(): [PotionEffect, number][] {
    return [...this.effects];
  }

  private tickEffects(deltaMs: number): void {
    for (const [effect, ms] of this.effects) {
      if (ms > deltaMs) {
        this.effects.set(effect, ms - deltaMs);
        continue;
      }
      this.effects.delete(effect);
      if (effect === 'grow') this.setScale(1);
    }
  }

  get sizeScale(): number {
    return this.hasEffect('grow') ? GROW_POTION_SCALE : 1;
  }

  private get speedScale(): number {
    return (this.hasEffect('speed') ? SPEED_POTION_SCALE : 1) * (this.hasEffect('slow') ? SLOW_POTION_SCALE : 1);
  }

  private get runSpeed(): number {
    return RUN_SPEED * this.speedScale;
  }

  update(deltaMs: number, ladders: LadderDef[]): void {
    this.tickEffects(deltaMs);

    const dt = deltaMs / 1000;
    const c = this.controls;
    const en = this.inputEnabled;
    const reversed = this.hasEffect('reversed');
    const left = en && (reversed ? c.right : c.left).isDown;
    const right = en && (reversed ? c.left : c.right).isDown;
    const up = en && (reversed ? c.down : c.up).isDown;
    const down = en && (reversed ? c.up : c.down).isDown;
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
      if (Math.abs(vx) <= this.runSpeed) this.sliding = false;
    } else {
      const ground = this.onGround;
      const rate = dir !== 0 ? (ground ? GROUND_ACCEL : AIR_ACCEL) : ground ? GROUND_DRAG : AIR_DRAG;
      vx = approach(vx, dir * this.runSpeed, rate * dt);
    }
    this.setVelocityX(vx);

    if (upJust && this.onGround) {
      this.setVelocityY(-JUMP_VELOCITY * (this.hasEffect('jump') ? JUMP_POTION_SCALE : 1));
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
    // Clamped here because setMaxVelocityY would also limit jumps and trampolines.
    if (this.hasEffect('slowFall') && this.body.velocity.y > SLOW_FALL_SPEED) {
      this.setVelocityY(SLOW_FALL_SPEED);
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
    this.setVelocityX(dir * this.runSpeed * (1 + charge));
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
      this.setVelocityX(dir * this.runSpeed);
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
    const climbSpeed = CLIMB_SPEED * this.speedScale;
    this.setVelocity(0, up ? -climbSpeed : down ? climbSpeed : 0);
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
    // Portal spots assume normal size; lift a grown player clear of the platform.
    this.body.reset(x, y - ((this.sizeScale - 1) * PLAYER_SIZE) / 2);
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
    const size = this.sizeScale;
    const yOffset = ((1 - this.scaleY_) * PLAYER_SIZE * size) / 2;
    this.visual.setPosition(this.x, this.y + yOffset);
    // Containers can't flipX; a negative scale mirrors skin and accessory together.
    this.visual.setScale((this.lastPressDir < 0 ? -this.scaleX_ : this.scaleX_) * size, this.scaleY_ * size);
    this.nameTag.setPosition(this.x, this.y - this.tagOffset * size);

    const invincible = this.hasEffect('invincible');
    this.invincibleRing.setVisible(invincible);
    if (invincible) {
      this.invincibleRing
        .setPosition(this.x, this.y)
        .setScale(size)
        .setAlpha(0.65 + 0.35 * Math.sin(this.scene.time.now / 120));
    }

    if (this.trail) {
      const moving = Math.abs(this.body.velocity.x) > TRAIL_MIN_SPEED || Math.abs(vy) > TRAIL_MIN_SPEED;
      this.trail.emitting = this.inputEnabled && moving;
    }
  }
}
