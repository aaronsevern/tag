import Phaser from 'phaser';
import { COLORS, HEIGHT, PLAYER_COLORS, PLAYER_NAMES, WIDTH, hex } from '../config';
import { CONTROL_SCHEMES } from '../controls';
import { skinTextureKey } from '../cosmetics';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const cx = WIDTH / 2;
    this.add
      .text(cx, 110, 'TAG!', { fontFamily: 'Arial Black, Arial', fontSize: '110px', color: '#ffcf4a' })
      .setOrigin(0.5)
      .setStroke('#3a2a10', 10);
    this.add
      .text(cx, 200, "Don't be holding the bomb when time runs out", {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    PLAYER_COLORS.forEach((color, i) => {
      const x = cx + (i - 1) * 300;
      this.add.image(x, 300, skinTextureKey('classic', i)).setScale(1.6);
      this.add
        .text(x, 350, `${PLAYER_NAMES[i]}\n${CONTROL_SCHEMES[i].label}`, {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: hex(color),
          align: 'center',
        })
        .setOrigin(0.5, 0);
    });

    this.add
      .text(
        cx,
        460,
        'Up: jump / climb ladders     Down: climb down\nTap left-right-left quickly to build a slide',
        { fontFamily: 'Arial', fontSize: '20px', color: '#b8b3cc', align: 'center' },
      )
      .setOrigin(0.5);

    this.makeButton(cx - 260, 580, '2 Players', () => this.start(2));
    this.makeButton(cx, 580, '3 Players', () => this.start(3));
    this.makeButton(cx + 260, 580, 'Shop', () => this.scene.start('Shop'));
    this.add
      .text(cx, HEIGHT - 50, 'Press 2 or 3 to play,  S for the shop', { fontFamily: 'Arial', fontSize: '20px', color: '#8f89a8' })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-TWO', () => this.start(2));
    kb.on('keydown-THREE', () => this.start(3));
    kb.on('keydown-NUMPAD_TWO', () => this.start(2));
    kb.on('keydown-NUMPAD_THREE', () => this.start(3));
    kb.on('keydown-S', () => this.scene.start('Shop'));
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 220, 64, 0x4b3f68).setStrokeStyle(3, 0x9f8bc4);
    this.add.text(x, y, label, { fontFamily: 'Arial Black, Arial', fontSize: '26px', color: COLORS.text }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x6b5a96))
      .on('pointerout', () => bg.setFillStyle(0x4b3f68))
      .on('pointerdown', onClick);
  }

  private start(playerCount: number): void {
    this.scene.start('Join', { playerCount });
  }
}
