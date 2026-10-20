import Phaser from 'phaser';
import { COLORS, HEIGHT, PLAYER_COLORS, PLAYER_NAMES, WIDTH, hex } from '../config';
import { CONTROL_SCHEMES, createControls } from '../controls';
import { createLook, setLook, type Look } from '../cosmetics';
import { DEFAULT_ACCESSORY, DEFAULT_SKIN, GUEST_ID, type Profile } from '../profiles';
import { ProfilePicker, isTyping } from '../ui/ProfilePicker';

interface Column {
  picker: ProfilePicker;
  profile?: Profile;
  preview: Look;
  name: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

/** Each player picks (or creates) a profile before the round starts. */
export class JoinScene extends Phaser.Scene {
  private playerCount = 2;
  private columns: Column[] = [];
  private startText!: Phaser.GameObjects.Text;

  constructor() {
    super('Join');
  }

  init(data: { playerCount?: number }): void {
    this.playerCount = Phaser.Math.Clamp(data.playerCount ?? 2, 2, 3);
    this.columns = [];
  }

  create(): void {
    this.add
      .text(WIDTH / 2, 60, 'Who is playing?', { fontFamily: 'Arial Black, Arial', fontSize: '48px', color: '#ffcf4a' })
      .setOrigin(0.5)
      .setStroke('#3a2a10', 8);

    for (let i = 0; i < this.playerCount; i++) {
      const x = WIDTH / 2 + (i - (this.playerCount - 1) / 2) * 400;
      const controls = createControls(this, i);
      this.add
        .text(x, 150, `${PLAYER_NAMES[i]}  (${CONTROL_SCHEMES[i].label})`, {
          fontFamily: 'Arial Black, Arial',
          fontSize: '24px',
          color: hex(PLAYER_COLORS[i]),
        })
        .setOrigin(0.5);

      const preview = createLook(this, x, 330, i, DEFAULT_SKIN, DEFAULT_ACCESSORY).setScale(2.2).setVisible(false);
      const name = this.add
        .text(x, 400, '', { fontFamily: 'Arial Black, Arial', fontSize: '28px', color: hex(PLAYER_COLORS[i]) })
        .setOrigin(0.5)
        .setStroke('#000000', 5);
      const status = this.add
        .text(x, 445, '', { fontFamily: 'Arial', fontSize: '18px', color: COLORS.text, align: 'center' })
        .setOrigin(0.5);

      const column: Column = {
        preview,
        name,
        status,
        picker: new ProfilePicker(this, x, 230, controls, PLAYER_COLORS[i], {
          allowGuest: true,
          isTaken: (id) => id !== GUEST_ID && this.columns.some((c) => c !== column && c.profile?.id === id),
          onSelect: (profile) => this.lock(i, profile),
        }),
      };
      this.columns.push(column);
      column.picker.open();

      const onUp = () => {
        if (!isTyping() && column.profile) this.unlock(i);
      };
      controls.up.on('down', onUp);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => controls.up.off('down', onUp));
    }

    this.startText = this.add
      .text(WIDTH / 2, HEIGHT - 90, '', { fontFamily: 'Arial Black, Arial', fontSize: '30px', color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT - 40, 'Esc: back to menu', { fontFamily: 'Arial', fontSize: '18px', color: '#8f89a8' })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => {
      if (!isTyping() && this.allReady()) {
        this.scene.start('Game', {
          playerCount: this.playerCount,
          profileIds: this.columns.map((c) => c.profile!.id),
        });
      }
    });
    kb.on('keydown-ESC', () => {
      if (!isTyping()) this.scene.start('Menu');
    });
    this.refreshStart();
  }

  private lock(slot: number, profile: Profile): void {
    const c = this.columns[slot];
    c.profile = profile;
    setLook(c.preview, slot, profile.skin, profile.accessory);
    c.preview.setVisible(true);
    c.name.setText(profile.guest ? 'Guest' : profile.name).setVisible(true);
    c.status.setText(`${profile.guest ? 'Coins not saved' : `${profile.coins} coins`}\nReady!  (Up: change)`).setVisible(true);
    this.tweens.add({ targets: c.preview, scale: { from: 2.8, to: 2.2 }, duration: 250, ease: 'Back.easeOut' });
    this.refreshPickers();
    this.refreshStart();
  }

  private unlock(slot: number): void {
    const c = this.columns[slot];
    c.profile = undefined;
    for (const o of [c.preview, c.name, c.status]) o.setVisible(false);
    c.picker.open();
    this.refreshPickers();
    this.refreshStart();
  }

  private refreshPickers(): void {
    for (const c of this.columns) c.picker.refresh();
  }

  private allReady(): boolean {
    return this.columns.every((c) => c.profile);
  }

  private refreshStart(): void {
    this.startText.setText(this.allReady() ? 'Press SPACE to start!' : 'Waiting for players...');
    this.startText.setColor(this.allReady() ? '#ffcf4a' : '#8f89a8');
  }
}
