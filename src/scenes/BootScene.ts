import Phaser from 'phaser';
import { PLAYER_SIZE, PORTAL_COLORS, PORTAL_RADIUS } from '../config';
import { generateCosmeticTextures } from '../cosmetics';
import { TRAMPOLINE_HEIGHT, TRAMPOLINE_WIDTH, WALL_TRAMPOLINE_HEIGHT, WALL_TRAMPOLINE_WIDTH } from '../level';

/** Generates every texture procedurally; the game has no image assets. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const g = this.add.graphics();
    const S = PLAYER_SIZE;

    generateCosmeticTextures(this);

    // Charred player shown after the bomb goes off.
    g.clear();
    g.fillStyle(0x2a2a2a, 1).fillRoundedRect(0, 0, S, S, 6);
    g.lineStyle(3, 0xdddddd, 1);
    for (const ex of [12, 24]) {
      g.lineBetween(ex - 4, 10, ex + 4, 18);
      g.lineBetween(ex + 4, 10, ex - 4, 18);
    }
    g.generateTexture('charred', S, S);

    // Bomb: body centred at (15, 24), fuse tip at (24, 3).
    g.clear();
    g.fillStyle(0x1b1b22, 1).fillCircle(15, 24, 14);
    g.fillStyle(0xffffff, 0.35).fillCircle(10, 19, 4);
    g.fillStyle(0x55555f, 1).fillRect(10, 7, 10, 5);
    g.lineStyle(3, 0xc8a46a, 1);
    g.beginPath();
    g.moveTo(15, 8);
    g.lineTo(19, 3);
    g.lineTo(24, 3);
    g.strokePath();
    g.generateTexture('bomb', 30, 40);

    g.clear();
    g.fillStyle(0xffa62b, 1).fillCircle(5, 5, 5);
    g.fillStyle(0xfff3a0, 1).fillCircle(5, 5, 2.5);
    g.generateTexture('spark', 10, 10);

    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('particle', 8, 8);

    // Trampoline: springy pad on two legs.
    const TW = TRAMPOLINE_WIDTH;
    const TH = TRAMPOLINE_HEIGHT;
    g.clear();
    g.fillStyle(0x8a8a9a, 1).fillRect(6, 6, 5, TH - 6).fillRect(TW - 11, 6, 5, TH - 6);
    g.lineStyle(2, 0xcfcfdf, 1);
    for (let x = 14; x < TW - 14; x += 8) g.lineBetween(x, 6, x + 4, TH);
    g.fillStyle(0xff7a2f, 1).fillRoundedRect(0, 0, TW, 7, 3);
    g.generateTexture('trampoline', TW, TH);

    // Wall trampoline: mount on the left, pad facing right (flipped for the right wall).
    const WW = WALL_TRAMPOLINE_WIDTH;
    const WH = WALL_TRAMPOLINE_HEIGHT;
    g.clear();
    g.fillStyle(0x8a8a9a, 1).fillRect(0, 6, 5, 6).fillRect(0, WH - 12, 5, 6);
    g.lineStyle(2, 0xcfcfdf, 1);
    for (let y = 14; y < WH - 14; y += 8) g.lineBetween(0, y, WW - 6, y + 4);
    g.fillStyle(0xff7a2f, 1).fillRoundedRect(WW - 7, 0, 7, WH, 3);
    g.generateTexture('wallTrampoline', WW, WH);

    // Portals: glowing rings, one colour per end of the pair.
    const PR = PORTAL_RADIUS;
    PORTAL_COLORS.forEach((color, i) => {
      g.clear();
      g.fillStyle(color, 0.25).fillEllipse(PR, PR + 4, PR * 1.5, PR * 2);
      g.lineStyle(6, color, 1).strokeEllipse(PR, PR + 4, PR * 1.5, PR * 2);
      g.lineStyle(2, 0xffffff, 0.8).strokeEllipse(PR, PR + 4, PR * 1.1, PR * 1.6);
      g.generateTexture(`portal${i}`, PR * 2, PR * 2 + 8);
    });

    g.destroy();
    this.scene.start('Menu');
  }
}
