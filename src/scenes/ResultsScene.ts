import Phaser from 'phaser';
import { COLORS, HEIGHT, SURVIVOR_COINS, WIDTH, WIN_COINS, hex } from '../config';
import { charLook, createLook } from '../cosmetics';
import { GUEST_ID, profileStore } from '../profiles';

export interface ResultsData {
  playerCount: number;
  loserIndex: number;
  players: { label: string; color: number; itMs: number; profileId: string; skin: string; accessory: string }[];
}

export class ResultsScene extends Phaser.Scene {
  private results!: ResultsData;

  constructor() {
    super('Results');
  }

  init(data: ResultsData): void {
    this.results = data;
  }

  create(): void {
    const { players, loserIndex, playerCount } = this.results;
    const cx = WIDTH / 2;
    const loser = players[loserIndex];

    // Winner = survivor with the least time as "it" (ties all win); other survivors get a smaller payout.
    const survivors = players.map((_, i) => i).filter((i) => i !== loserIndex);
    const bestIt = Math.min(...survivors.map((i) => players[i].itMs));
    const payout = players.map((p, i) =>
      i === loserIndex ? 0 : Math.abs(p.itMs - bestIt) < 1 ? WIN_COINS : SURVIVOR_COINS,
    );
    players.forEach((p, i) => profileStore.award(p.profileId, payout[i]));

    this.add
      .text(cx, 80, `${loser.label} blew up!`, {
        fontFamily: 'Arial Black, Arial',
        fontSize: '60px',
        color: hex(loser.color),
      })
      .setOrigin(0.5)
      .setStroke('#000000', 8);

    // Survivors first, ordered by least time as "it"; the loser always last.
    const ranked = players
      .map((p, index) => ({ ...p, index }))
      .sort((a, b) => Number(a.index === loserIndex) - Number(b.index === loserIndex) || a.itMs - b.itMs);

    const header = { fontFamily: 'Arial', fontSize: '20px', color: '#b8b3cc' };
    this.add.text(cx + 150, 170, 'Time as "it"', header).setOrigin(0.5);
    this.add.text(cx + 330, 170, 'Coins', header).setOrigin(0.5);

    ranked.forEach((p, rank) => {
      const y = 240 + rank * 90;
      const isLoser = p.index === loserIndex;
      const won = payout[p.index] === WIN_COINS;
      const look = createLook(this, cx - 380, y, p.index, p.skin, p.accessory).setScale(1.4);
      if (isLoser) charLook(look);

      const place = isLoser ? 'BOOM' : won ? 'WINNER' : 'SAFE';
      this.add
        .text(cx - 330, y, `${place}   ${p.label}`, {
          fontFamily: 'Arial Black, Arial',
          fontSize: '30px',
          color: hex(p.color),
        })
        .setOrigin(0, 0.5)
        .setStroke('#000000', 5);
      this.add
        .text(cx + 150, y, `${(p.itMs / 1000).toFixed(1)}s`, {
          fontFamily: 'Arial Black, Arial',
          fontSize: '30px',
          color: COLORS.text,
        })
        .setOrigin(0.5);

      const guest = p.profileId === GUEST_ID;
      const total = guest ? '' : `\n(${profileStore.get(p.profileId).coins} total)`;
      const coins = this.add
        .text(cx + 330, y, `+${payout[p.index]}${total}`, {
          fontFamily: 'Arial Black, Arial',
          fontSize: '26px',
          color: payout[p.index] > 0 ? '#ffcf4a' : '#8f89a8',
          align: 'center',
        })
        .setOrigin(0.5);
      if (guest && payout[p.index] > 0) coins.setText(`+${payout[p.index]}\n(guest)`).setColor('#8f89a8');
      if (payout[p.index] > 0) {
        this.tweens.add({ targets: coins, scale: { from: 1.6, to: 1 }, duration: 400, delay: 300 + rank * 150, ease: 'Back.easeOut' });
      }
    });

    this.add
      .text(cx, HEIGHT - 80, 'SPACE: play again     M: menu', {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.once('keydown-SPACE', () =>
      this.scene.start('Game', { playerCount, profileIds: players.map((p) => p.profileId) }),
    );
    kb.once('keydown-M', () => this.scene.start('Menu'));
  }
}
