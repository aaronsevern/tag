import Phaser from 'phaser';
import {
  COLORS,
  COUNTDOWN_SECONDS,
  HEIGHT,
  PLAYER_NAMES,
  ROUND_MS,
  TAG_COOLDOWN_MS,
  WIDTH,
  formatTime,
  hex,
} from '../config';
import { createControls } from '../controls';
import { charLook } from '../cosmetics';
import {
  ARENA,
  LADDER_WIDTH,
  TRAMPOLINE_HEIGHT,
  TRAMPOLINE_WIDTH,
  WALL_TRAMPOLINE_HEIGHT,
  type LevelDef,
} from '../level';
import { Bomb } from '../objects/Bomb';
import { Player } from '../objects/Player';
import { Portals } from '../objects/Portals';
import { GUEST_ID, profileStore, type Profile } from '../profiles';
import type { ResultsData } from './ResultsScene';

type RoundState = 'countdown' | 'playing' | 'ended';

export class GameScene extends Phaser.Scene {
  private level: LevelDef = ARENA;
  private playerCount = 3;
  private profiles: Profile[] = [];
  private players: Player[] = [];
  private itIndex = 0;
  private bomb!: Bomb;
  private portals!: Portals;
  private state: RoundState = 'countdown';
  private remainingMs = ROUND_MS;
  private tagCooldownUntil = 0;
  private timerText!: Phaser.GameObjects.Text;
  private scoreTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Game');
  }

  init(data: { playerCount?: number; profileIds?: string[] }): void {
    this.playerCount = Phaser.Math.Clamp(data.playerCount ?? 3, 2, 3);
    this.profiles = Array.from({ length: this.playerCount }, (_, i) => profileStore.get(data.profileIds?.[i] ?? GUEST_ID));
    this.players = [];
    this.scoreTexts = [];
    this.state = 'countdown';
    this.remainingMs = ROUND_MS;
    this.tagCooldownUntil = 0;
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
    this.drawBackground();
    const platforms = this.buildPlatforms();
    this.drawLadders();
    const trampolines = this.buildTrampolines();
    const wallTrampolines = this.buildWallTrampolines();
    this.portals = new Portals(this, this.level);

    for (let i = 0; i < this.playerCount; i++) {
      const spawn = this.level.spawns[i];
      const profile = this.profiles[i];
      const look = {
        name: profile.guest ? PLAYER_NAMES[i] : profile.name,
        skin: profile.skin,
        accessory: profile.accessory,
        trail: profile.trail,
      };
      this.players.push(new Player(this, i, spawn.x, spawn.y, createControls(this, i), look));
    }

    // Climbers pass through platforms so they can move along ladders.
    this.physics.add.collider(this.players, platforms, undefined, (p) => !(p as Player).climbing);
    this.physics.add.collider(this.players, trampolines, (p, t) => {
      const player = p as Player;
      const tramp = t as Phaser.Physics.Arcade.Image;
      if (player.body.touching.down && tramp.body!.touching.up) this.bounce(player, tramp);
    });
    this.physics.add.collider(this.players, wallTrampolines, (p, t) => {
      const player = p as Player;
      const tramp = t as Phaser.Physics.Arcade.Image;
      const dir = tramp.getData('side') === 'left' ? 1 : -1;
      const hit = dir === 1 ? player.body.touching.left : player.body.touching.right;
      if (hit) this.bounceSideways(player, tramp, dir);
    });

    this.itIndex = Phaser.Math.Between(0, this.playerCount - 1);
    this.bomb = new Bomb(this, this.players[this.itIndex]);

    this.buildHud();
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.afterPhysics, this);
    });

    this.runCountdown();
  }

  update(time: number, delta: number): void {
    if (this.state === 'playing') {
      this.remainingMs -= delta;
      this.players[this.itIndex].itMs += delta;
      if (this.remainingMs <= 0) {
        this.remainingMs = 0;
        this.endRound();
      }
    }

    if (this.state !== 'ended') {
      for (const p of this.players) p.update(delta, this.level.ladders);
      if (this.state === 'playing') this.portals.update(this.time.now, this.players);
      this.checkTag(time);
    }

    this.updateHud(time);
  }

  private afterPhysics(): void {
    for (const p of this.players) p.syncVisual();
    if (this.state !== 'ended') this.bomb.update(this.game.loop.delta);
  }

  // ---------- level ----------

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillGradientStyle(0x2b3150, 0x2b3150, COLORS.background, COLORS.background, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0xffffff, 0.04);
    for (let x = 0; x < WIDTH; x += 80) g.fillRect(x, 0, 2, HEIGHT);
  }

  private buildPlatforms(): Phaser.Physics.Arcade.StaticGroup {
    const group = this.physics.add.staticGroup();
    for (const def of this.level.platforms) {
      const color = def.solid ? COLORS.floor : COLORS.platform;
      const rect = this.add.rectangle(def.x + def.w / 2, def.y + def.h / 2, def.w, def.h, color);
      this.add.rectangle(def.x + def.w / 2, def.y + 2, def.w, 4, COLORS.platformTop);
      group.add(rect);
      const body = rect.body as Phaser.Physics.Arcade.StaticBody;
      if (!def.solid) {
        body.checkCollision.down = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;
      }
    }
    return group;
  }

  private drawLadders(): void {
    const g = this.add.graphics().setDepth(-1);
    for (const l of this.level.ladders) {
      const left = l.cx - LADDER_WIDTH / 2;
      const right = l.cx + LADDER_WIDTH / 2;
      g.fillStyle(COLORS.ladder, 1);
      g.fillRect(left, l.top, 4, l.bottom - l.top);
      g.fillRect(right - 4, l.top, 4, l.bottom - l.top);
      for (let y = l.top + 12; y < l.bottom; y += 18) g.fillRect(left, y, LADDER_WIDTH, 3);
    }
  }

  private buildTrampolines(): Phaser.Physics.Arcade.StaticGroup {
    const group = this.physics.add.staticGroup();
    for (const t of this.level.trampolines) {
      // Bottom-centre origin so the squash tween compresses toward the floor.
      const img = group.create(t.x + TRAMPOLINE_WIDTH / 2, t.y + TRAMPOLINE_HEIGHT, 'trampoline') as Phaser.Physics.Arcade.Image;
      img.setOrigin(0.5, 1).refreshBody();
      const body = img.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
    }
    return group;
  }

  private buildWallTrampolines(): Phaser.Physics.Arcade.StaticGroup {
    const group = this.physics.add.staticGroup();
    for (const def of this.level.wallTrampolines) {
      const left = def.side === 'left';
      const x = left ? 0 : WIDTH;
      const y = def.y + WALL_TRAMPOLINE_HEIGHT / 2;
      // Origin on the wall edge so the squash tween compresses toward the wall.
      const img = group.create(x, y, 'wallTrampoline') as Phaser.Physics.Arcade.Image;
      img.setOrigin(left ? 0 : 1, 0.5).setFlipX(!left).setData('side', def.side).refreshBody();
      const body = img.body as Phaser.Physics.Arcade.StaticBody;
      // Only the pad face (toward the arena) is solid.
      body.checkCollision.up = false;
      body.checkCollision.down = false;
      body.checkCollision.left = !left;
      body.checkCollision.right = left;
    }
    return group;
  }

  private bounceSideways(player: Player, tramp: Phaser.Physics.Arcade.Image, dir: number): void {
    player.bounceSideways(dir);
    this.tweens.killTweensOf(tramp);
    tramp.setScale(0.4, 1.1);
    this.tweens.add({ targets: tramp, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
  }

  private bounce(player: Player, tramp: Phaser.Physics.Arcade.Image): void {
    player.bounce();
    this.tweens.killTweensOf(tramp);
    tramp.setScale(1.1, 0.5);
    this.tweens.add({ targets: tramp, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
  }

  // ---------- rules ----------

  private runCountdown(): void {
    const label = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 40, '', { fontFamily: 'Arial Black, Arial', fontSize: '120px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 10)
      .setDepth(100);
    const it = this.players[this.itIndex];
    const sub = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 60, `${it.label} is IT!`, {
        fontFamily: 'Arial Black, Arial',
        fontSize: '40px',
        color: hex(it.color),
      })
      .setOrigin(0.5)
      .setStroke('#000000', 6)
      .setDepth(100);

    let n = COUNTDOWN_SECONDS;
    const show = (text: string) => {
      label.setText(text).setScale(1.5).setAlpha(1);
      this.tweens.add({ targets: label, scale: 1, duration: 400, ease: 'Back.easeOut' });
    };
    show(String(n));
    this.time.addEvent({
      delay: 1000,
      repeat: COUNTDOWN_SECONDS - 1,
      callback: () => {
        n--;
        if (n > 0) {
          show(String(n));
          return;
        }
        show('GO!');
        this.state = 'playing';
        for (const p of this.players) p.inputEnabled = true;
        this.portals.start(this.time.now);
        this.tweens.add({ targets: [label, sub], alpha: 0, delay: 500, duration: 400 });
      },
    });
  }

  private checkTag(time: number): void {
    if (this.state !== 'playing' || time < this.tagCooldownUntil) return;
    const it = this.players[this.itIndex];
    const victim = this.players.find((p) => p !== it && this.physics.overlap(it, p));
    if (victim) this.tag(it, victim, time);
  }

  private tag(from: Player, to: Player, time: number): void {
    this.itIndex = to.index;
    this.tagCooldownUntil = time + TAG_COOLDOWN_MS;
    this.bomb.setTarget(to);

    const push = Math.sign(to.x - from.x) || 1;
    from.setVelocityX(-push * 250);
    to.setVelocityX(push * 250);

    this.cameras.main.shake(120, 0.006);
    // The new "it" flashes while it cannot tag anyone back.
    this.tweens.add({
      targets: to.visual,
      alpha: 0.3,
      duration: 125,
      yoyo: true,
      repeat: Math.floor(TAG_COOLDOWN_MS / 250) - 1,
      onComplete: () => to.visual.setAlpha(1),
    });
  }

  private endRound(): void {
    this.state = 'ended';
    for (const p of this.players) p.freeze();
    this.physics.pause();
    this.portals.stop();

    const loser = this.players[this.itIndex];
    const x = this.bomb.x;
    const y = this.bomb.y;
    this.bomb.destroy();

    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 150, max: 520 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 400, max: 900 },
      scale: { start: 2.2, end: 0 },
      color: [0xfff3a0, 0xffa62b, 0xff4d1f, 0x444444],
      quantity: 90,
      emitting: false,
    });
    emitter.setDepth(50);
    emitter.explode(90);

    const flash = this.add.circle(x, y, 20, 0xfff6c0).setDepth(49);
    this.tweens.add({ targets: flash, scale: 9, alpha: 0, duration: 450, ease: 'Cubic.easeOut' });
    this.cameras.main.shake(500, 0.02);
    this.cameras.main.flash(200, 255, 240, 200);

    this.tweens.killTweensOf(loser.visual);
    charLook(loser.visual);
    loser.visual.setAlpha(1);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 40, 'BOOM!', { fontFamily: 'Arial Black, Arial', fontSize: '130px', color: '#ffcf4a' })
      .setOrigin(0.5)
      .setStroke('#3a1a00', 12)
      .setDepth(100);

    const data: ResultsData = {
      playerCount: this.playerCount,
      loserIndex: loser.index,
      players: this.players.map((p, i) => ({
        label: p.label,
        color: p.color,
        itMs: p.itMs,
        profileId: this.profiles[i].id,
        skin: this.profiles[i].skin,
        accessory: this.profiles[i].accessory,
      })),
    };
    this.time.delayedCall(2200, () => this.scene.start('Results', data));
  }

  // ---------- HUD ----------

  private buildHud(): void {
    this.timerText = this.add
      .text(WIDTH / 2, 12, formatTime(this.remainingMs), {
        fontFamily: 'Arial Black, Arial',
        fontSize: '40px',
        color: COLORS.text,
      })
      .setOrigin(0.5, 0)
      .setStroke('#000000', 6)
      .setDepth(90);

    this.players.forEach((p, i) => {
      const t = this.add
        .text(16, 14 + i * 26, '', { fontFamily: 'Arial', fontSize: '20px', color: hex(p.color) })
        .setStroke('#000000', 4)
        .setDepth(90);
      this.scoreTexts.push(t);
    });
  }

  private updateHud(time: number): void {
    this.timerText.setText(formatTime(this.remainingMs));
    const urgent = this.state === 'playing' && this.remainingMs <= 10_000;
    this.timerText.setColor(urgent ? '#ff5050' : COLORS.text);
    this.timerText.setScale(urgent ? 1 + 0.12 * Math.abs(Math.sin(time / 160)) : 1);

    this.players.forEach((p, i) => {
      const marker = i === this.itIndex ? '  💣 IT' : '';
      this.scoreTexts[i].setText(`${p.label}: ${(p.itMs / 1000).toFixed(1)}s${marker}`);
    });
  }
}
