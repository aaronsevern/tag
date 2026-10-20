import Phaser from 'phaser';
import { COLORS, hex } from '../config';
import type { PlayerControls } from '../controls';
import { GUEST_ID, MAX_NAME_LENGTH, profileStore, type Profile } from '../profiles';

const NEW_ID = '__new__';

// Only one picker can be typing a name at a time; while it is, every other
// picker (and the owning scene) should ignore player keys, since letters typed
// for the name are also other players' movement keys.
let typingOwner: ProfilePicker | null = null;
export const isTyping = (): boolean => typingOwner !== null;

export interface PickerOptions {
  allowGuest: boolean;
  /** True if another column already holds this profile. */
  isTaken(id: string): boolean;
  onSelect(profile: Profile): void;
}

/** Per-player profile chooser: Left/Right cycle, Down select, "+ New" types a name. */
export class ProfilePicker {
  private readonly scene: Phaser.Scene;
  private readonly controls: PlayerControls;
  private readonly opts: PickerOptions;
  private readonly title: Phaser.GameObjects.Text;
  private readonly main: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private options: string[] = [];
  private index = 0;
  private active = false;
  private naming = false;
  private nameBuffer = '';
  private ignoreBefore = 0;
  private openedAt = 0;
  private caretTimer?: Phaser.Time.TimerEvent;
  private caretOn = true;

  constructor(scene: Phaser.Scene, x: number, y: number, controls: PlayerControls, color: number, opts: PickerOptions) {
    this.scene = scene;
    this.controls = controls;
    this.opts = opts;

    const font = 'Arial';
    this.title = scene.add
      .text(x, y, 'Choose profile', { fontFamily: font, fontSize: '18px', color: '#b8b3cc' })
      .setOrigin(0.5);
    this.main = scene.add
      .text(x, y + 40, '', { fontFamily: 'Arial Black, Arial', fontSize: '28px', color: hex(color) })
      .setOrigin(0.5)
      .setStroke('#000000', 5);
    this.sub = scene.add
      .text(x, y + 78, '', { fontFamily: font, fontSize: '18px', color: COLORS.text, align: 'center' })
      .setOrigin(0.5);
    this.hint = scene.add
      .text(x, y + 112, '', { fontFamily: font, fontSize: '15px', color: '#8f89a8', align: 'center' })
      .setOrigin(0.5);

    controls.left.on('down', this.onLeft, this);
    controls.right.on('down', this.onRight, this);
    controls.down.on('down', this.onDown, this);
    scene.input.keyboard!.on('keydown', this.onType, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.active;
  }

  open(): void {
    // Ignore the keypress that caused the open (another listener may be
    // handling the very same Down event).
    this.openedAt = performance.now();
    this.active = true;
    this.naming = false;
    this.rebuildOptions();
    // Start on the first real profile when there is one.
    this.index = 0;
    this.setVisible(true);
    this.render();
  }

  /** Re-filter options (e.g. another column took a profile), keeping the highlighted one if still available. */
  refresh(): void {
    if (!this.active) return;
    const current = this.options[this.index];
    this.rebuildOptions();
    const kept = this.options.indexOf(current);
    if (kept !== -1) this.index = kept;
    this.render();
  }

  close(): void {
    this.active = false;
    this.stopNaming();
    this.setVisible(false);
  }

  private rebuildOptions(): void {
    const ids = profileStore
      .list()
      .map((p) => p.id)
      .filter((id) => !this.opts.isTaken(id));
    if (this.opts.allowGuest) ids.push(GUEST_ID);
    ids.push(NEW_ID);
    this.options = ids;
    this.index = Phaser.Math.Clamp(this.index, 0, ids.length - 1);
  }

  private canUseKeys(event?: KeyboardEvent): boolean {
    if (event && event.timeStamp <= this.openedAt) return false;
    return this.active && !this.naming && typingOwner === null;
  }

  private onLeft(): void {
    if (!this.canUseKeys()) return;
    this.index = (this.index - 1 + this.options.length) % this.options.length;
    this.render();
  }

  private onRight(): void {
    if (!this.canUseKeys()) return;
    this.index = (this.index + 1) % this.options.length;
    this.render();
  }

  private onDown(_key: unknown, event: KeyboardEvent): void {
    if (!this.canUseKeys(event)) return;
    const id = this.options[this.index];
    if (id === NEW_ID) {
      this.startNaming(event.timeStamp);
      return;
    }
    if (id !== GUEST_ID && this.opts.isTaken(id)) {
      this.refresh();
      return;
    }
    this.close();
    this.opts.onSelect(profileStore.get(id));
  }

  private startNaming(pressedAt: number): void {
    this.naming = true;
    typingOwner = this;
    this.nameBuffer = '';
    // The Down press that opened naming may be a letter (S/K); don't type it.
    this.ignoreBefore = pressedAt;
    this.caretTimer = this.scene.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        this.caretOn = !this.caretOn;
        this.render();
      },
    });
    this.render();
  }

  private stopNaming(): void {
    if (typingOwner === this) typingOwner = null;
    this.naming = false;
    this.caretTimer?.remove();
    this.caretTimer = undefined;
  }

  private onType(event: KeyboardEvent): void {
    if (!this.naming || event.timeStamp <= this.ignoreBefore) return;
    if (event.key === 'Escape') {
      this.stopNaming();
    } else if (event.key === 'Enter') {
      if (this.nameBuffer.trim() === '') return;
      const profile = profileStore.create(this.nameBuffer);
      this.stopNaming();
      this.close();
      this.opts.onSelect(profile);
      return;
    } else if (event.key === 'Backspace') {
      this.nameBuffer = this.nameBuffer.slice(0, -1);
    } else if (/^[a-zA-Z0-9 ]$/.test(event.key) && this.nameBuffer.length < MAX_NAME_LENGTH) {
      this.nameBuffer += event.key;
    }
    this.render();
  }

  private render(): void {
    if (!this.active) return;
    if (this.naming) {
      this.title.setText('New profile');
      this.main.setText(this.nameBuffer + (this.caretOn ? '_' : ' '));
      this.sub.setText('Type a name');
      this.hint.setText('Enter: save    Esc: cancel');
      return;
    }
    const id = this.options[this.index];
    this.title.setText('Choose profile');
    this.hint.setText('Left/Right: browse    Down: select');
    if (id === NEW_ID) {
      this.main.setText('◀  + New  ▶');
      this.sub.setText('Create a profile');
    } else if (id === GUEST_ID) {
      this.main.setText('◀  Guest  ▶');
      this.sub.setText("Play without saving coins");
    } else {
      const p = profileStore.get(id);
      this.main.setText(`◀  ${p.name}  ▶`);
      this.sub.setText(`${p.coins} coins`);
    }
  }

  private setVisible(v: boolean): void {
    for (const t of [this.title, this.main, this.sub, this.hint]) t.setVisible(v);
  }

  private destroy(): void {
    this.stopNaming();
    this.controls.left.off('down', this.onLeft, this);
    this.controls.right.off('down', this.onRight, this);
    this.controls.down.off('down', this.onDown, this);
    this.scene.input.keyboard?.off('keydown', this.onType, this);
  }
}
