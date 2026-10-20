import Phaser from 'phaser';

export interface PlayerControls {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
}

export interface ControlScheme {
  label: string;
  keys: { left: string; right: string; up: string; down: string };
}

export const CONTROL_SCHEMES: ControlScheme[] = [
  { label: 'W A S D', keys: { left: 'A', right: 'D', up: 'W', down: 'S' } },
  { label: 'Arrow keys', keys: { left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN' } },
  { label: 'I J K L', keys: { left: 'J', right: 'L', up: 'I', down: 'K' } },
];

export function createControls(scene: Phaser.Scene, index: number): PlayerControls {
  return scene.input.keyboard!.addKeys(CONTROL_SCHEMES[index].keys) as PlayerControls;
}
