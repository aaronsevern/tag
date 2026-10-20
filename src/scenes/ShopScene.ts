import Phaser from 'phaser';
import { ACCESSORY_PRICE, COLORS, HEIGHT, PLAYER_COLORS, PLAYER_NAMES, SKIN_PRICE, TRAIL_PRICE, WIDTH, hex } from '../config';
import { CONTROL_SCHEMES, createControls, type PlayerControls } from '../controls';
import { ACCESSORIES, SKINS, TRAILS, createLook, createTrail, setLook, type Look } from '../cosmetics';
import { DEFAULT_ACCESSORY, DEFAULT_SKIN, PRICES, profileStore, type CosmeticKind, type Profile } from '../profiles';
import { ProfilePicker, isTyping } from '../ui/ProfilePicker';

interface Section {
  label: string;
  kind: CosmeticKind;
  items: { id: string; name: string }[];
}

const SECTIONS: Section[] = [
  { label: 'Skins', kind: 'skin', items: SKINS },
  { label: 'Accessories', kind: 'accessory', items: ACCESSORIES },
  { label: 'Trails', kind: 'trail', items: TRAILS },
];
// The last tab, after the sections, switches profile.
const TABS = [...SECTIONS.map((s) => s.label), 'Profile'];
const PROFILE_TAB = SECTIONS.length;
const PREVIEW_SCALE = 1.5;

interface Column {
  slot: number;
  x: number;
  controls: PlayerControls;
  picker: ProfilePicker;
  profile?: Profile;
  tab: number;
  enteredAt: number;
  /** Browsing position within each section. */
  itemIdx: number[];
  emitter: Phaser.GameObjects.Particles.ParticleEmitter | null;
  ui: Phaser.GameObjects.GameObject[];
  name: Phaser.GameObjects.Text;
  coins: Phaser.GameObjects.Text;
  tabs: Phaser.GameObjects.Text[];
  preview: Look;
  item: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

/** Three side-by-side shop counters, one per keyboard slot. */
export class ShopScene extends Phaser.Scene {
  private columns: Column[] = [];

  constructor() {
    super('Shop');
  }

  init(): void {
    this.columns = [];
  }

  create(): void {
    this.add
      .text(WIDTH / 2, 50, 'SHOP', { fontFamily: 'Arial Black, Arial', fontSize: '56px', color: '#ffcf4a' })
      .setOrigin(0.5)
      .setStroke('#3a2a10', 8);
    this.add
      .text(WIDTH / 2, 100, `Skins ${SKIN_PRICE} coins  ·  Accessories ${ACCESSORY_PRICE} coins  ·  Trails ${TRAIL_PRICE} coins`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#b8b3cc',
      })
      .setOrigin(0.5);

    for (let slot = 0; slot < 3; slot++) this.columns.push(this.buildColumn(slot));

    this.add
      .text(WIDTH / 2, HEIGHT - 30, 'Esc: back to menu', { fontFamily: 'Arial', fontSize: '18px', color: '#8f89a8' })
      .setOrigin(0.5);
    this.input.keyboard!.on('keydown-ESC', () => {
      if (!isTyping()) this.scene.start('Menu');
    });
  }

  private buildColumn(slot: number): Column {
    const x = WIDTH / 2 + (slot - 1) * 420;
    const color = PLAYER_COLORS[slot];
    const controls = createControls(this, slot);

    this.add.rectangle(x, 400, 390, 520, 0x000000, 0.18).setStrokeStyle(2, color, 0.5);
    this.add
      .text(x, 160, `${PLAYER_NAMES[slot]}  (${CONTROL_SCHEMES[slot].label})`, {
        fontFamily: 'Arial Black, Arial',
        fontSize: '20px',
        color: hex(color),
      })
      .setOrigin(0.5);

    const text = (y: number, size: number, c = COLORS.text, bold = false) =>
      this.add
        .text(x, y, '', { fontFamily: bold ? 'Arial Black, Arial' : 'Arial', fontSize: `${size}px`, color: c, align: 'center' })
        .setOrigin(0.5);

    const name = text(200, 26, hex(color), true).setStroke('#000000', 5);
    const coins = text(235, 20, '#ffcf4a', true);
    const tabs = TABS.map((label, i) => text(275, 16).setX(x + (i - (TABS.length - 1) / 2) * 92).setText(label));
    // Runs back and forth at roughly player speed so trails stream out behind it like in a game.
    const preview = createLook(this, x, 385, slot, DEFAULT_SKIN, DEFAULT_ACCESSORY).setScale(PREVIEW_SCALE).setDepth(5);
    this.tweens.add({ targets: preview, x: { from: x - 120, to: x + 120 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const item = text(460, 26, COLORS.text, true);
    const status = text(500, 18);
    const hint = text(590, 15, '#8f89a8').setText('Left/Right: browse   Up: next tab\nDown: buy / equip');

    const column: Column = {
      slot,
      x,
      controls,
      tab: 0,
      enteredAt: 0,
      itemIdx: SECTIONS.map(() => 0),
      emitter: null,
      ui: [name, coins, ...tabs, preview, item, status, hint],
      name,
      coins,
      tabs,
      preview,
      item,
      status,
      picker: new ProfilePicker(this, x, 300, controls, color, {
        allowGuest: false,
        isTaken: (id) => this.columns.some((c) => c !== column && c.profile?.id === id),
        onSelect: (profile) => this.enterShop(column, profile),
      }),
    };
    this.showShop(column, false);
    column.picker.open();

    // Skip the keypress that selected the profile (the picker handles that same event).
    const ok = (e: KeyboardEvent) => this.shopping(column) && e.timeStamp > column.enteredAt;
    const onLeft = (_k: unknown, e: KeyboardEvent) => ok(e) && this.browse(column, -1);
    const onRight = (_k: unknown, e: KeyboardEvent) => ok(e) && this.browse(column, 1);
    const onUp = (_k: unknown, e: KeyboardEvent) => ok(e) && this.nextTab(column);
    const onDown = (_k: unknown, e: KeyboardEvent) => ok(e) && this.confirm(column);
    controls.left.on('down', onLeft);
    controls.right.on('down', onRight);
    controls.up.on('down', onUp);
    controls.down.on('down', onDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      controls.left.off('down', onLeft);
      controls.right.off('down', onRight);
      controls.up.off('down', onUp);
      controls.down.off('down', onDown);
    });
    return column;
  }

  private shopping(c: Column): boolean {
    return !!c.profile && !isTyping();
  }

  private enterShop(c: Column, profile: Profile): void {
    c.profile = profile;
    c.enteredAt = performance.now();
    this.refreshPickers();
    c.tab = 0;
    c.itemIdx = SECTIONS.map((sec) => Math.max(0, sec.items.findIndex((it) => it.id === profile[sec.kind])));
    this.showShop(c, true);
    this.render(c);
  }

  /** Other columns' pickers must stop offering a profile that was just taken (or offer a released one). */
  private refreshPickers(): void {
    for (const col of this.columns) col.picker.refresh();
  }

  private showShop(c: Column, visible: boolean): void {
    for (const o of c.ui) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
    if (!visible) this.setEmitter(c, null);
  }

  private browse(c: Column, dir: number): void {
    const sec = SECTIONS[c.tab];
    if (sec) c.itemIdx[c.tab] = (c.itemIdx[c.tab] + dir + sec.items.length) % sec.items.length;
    this.render(c);
  }

  private nextTab(c: Column): void {
    c.tab = (c.tab + 1) % TABS.length;
    this.render(c);
  }

  private confirm(c: Column): void {
    const profile = c.profile!;
    if (c.tab === PROFILE_TAB) {
      c.profile = undefined;
      this.showShop(c, false);
      c.picker.open();
      this.refreshPickers();
      return;
    }
    const sec = SECTIONS[c.tab];
    const result = profileStore.buyOrEquip(profile.id, sec.kind, sec.items[c.itemIdx[c.tab]].id);
    if (result === 'bought') {
      this.floatText(c, `-${PRICES[sec.kind]}`, '#ffcf4a');
      this.tweens.add({ targets: c.preview, scale: { from: PREVIEW_SCALE * 1.4, to: PREVIEW_SCALE }, duration: 300, ease: 'Back.easeOut' });
    } else if (result === 'equipped') {
      this.tweens.add({ targets: c.preview, scale: { from: PREVIEW_SCALE * 1.2, to: PREVIEW_SCALE }, duration: 200 });
    } else if (result === 'poor') {
      this.tweens.add({ targets: c.status, x: { from: c.x - 8, to: c.x }, duration: 60, repeat: 3, yoyo: true });
    }
    this.render(c);
  }

  private render(c: Column): void {
    const p = c.profile;
    if (!p) return;
    c.name.setText(p.name);
    c.coins.setText(`${p.coins} coins`);
    c.tabs.forEach((t, i) => {
      t.setColor(i === c.tab ? '#ffcf4a' : '#8f89a8');
      t.setFontStyle(i === c.tab ? 'bold' : '');
    });

    // Preview the item being browsed, combined with what is equipped in the other sections.
    const shown = (kind: CosmeticKind) => {
      const i = SECTIONS.findIndex((sec) => sec.kind === kind);
      return c.tab === i ? SECTIONS[i].items[c.itemIdx[i]].id : p[kind];
    };
    setLook(c.preview, c.slot, shown('skin'), shown('accessory'));
    this.setEmitter(c, shown('trail'));

    if (c.tab === PROFILE_TAB) {
      c.item.setText('Switch profile');
      c.status.setText('Down: choose another profile').setColor(COLORS.text);
      return;
    }

    const { kind, items: list } = SECTIONS[c.tab];
    const idx = c.itemIdx[c.tab];
    const itemId = list[idx].id;
    const price = PRICES[kind];
    c.item.setText(`◀  ${list[idx].name}  ▶`);

    let status: string;
    let color = COLORS.text;
    if (profileStore.equipped(p, kind) === itemId) {
      status = 'Equipped';
      color = '#5be37d';
    } else if (profileStore.owns(p, kind, itemId)) {
      status = 'Owned  -  Down: equip';
    } else if (p.coins >= price) {
      status = `${price} coins  -  Down: buy`;
      color = '#ffcf4a';
    } else {
      status = `${price} coins  -  not enough coins`;
      color = '#ff6b6b';
    }
    c.status.setText(`${status}\n${idx + 1} / ${list.length}`).setColor(color);
  }

  private setEmitter(c: Column, trailId: string | null): void {
    const current = c.emitter?.getData('trail') as string | undefined;
    if (current === (trailId ?? undefined) && (c.emitter || !trailId)) return;
    c.emitter?.destroy();
    c.emitter = trailId ? createTrail(this, trailId, PLAYER_COLORS[c.slot]) : null;
    if (c.emitter) {
      c.emitter.setData('trail', trailId).setDepth(4);
      c.emitter.startFollow(c.preview);
    }
  }

  private floatText(c: Column, msg: string, color: string): void {
    const t = this.add
      .text(c.x + 70, 330, msg, { fontFamily: 'Arial Black, Arial', fontSize: '28px', color })
      .setOrigin(0.5)
      .setStroke('#000000', 5)
      .setDepth(10);
    this.tweens.add({ targets: t, y: 280, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
