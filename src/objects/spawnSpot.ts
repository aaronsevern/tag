import Phaser from 'phaser';
import { PLAYER_SIZE } from '../config';
import { TRAMPOLINE_WIDTH, type LevelDef } from '../level';
import type { Player } from './Player';

const MIN_PLAYER_GAP = 90;

/** Random point just above a platform, clear of players, trampolines and `taken` spots. */
export function pickSpot(
  level: LevelDef,
  players: Player[],
  radius: number,
  taken: Phaser.Math.Vector2[] = [],
  minGap = 0,
): Phaser.Math.Vector2 | undefined {
  const floorTrampolines = level.trampolines.map((t) => t.x + TRAMPOLINE_WIDTH / 2);
  for (let attempt = 0; attempt < 30; attempt++) {
    const plat = Phaser.Utils.Array.GetRandom(level.platforms);
    const x = Phaser.Math.Between(plat.x + radius + 10, plat.x + plat.w - radius - 10);
    const y = plat.y - PLAYER_SIZE / 2 - 4;
    if (plat.solid && floorTrampolines.some((tx) => Math.abs(tx - x) < TRAMPOLINE_WIDTH)) continue;
    if (players.some((p) => Phaser.Math.Distance.Between(p.x, p.y, x, y) < MIN_PLAYER_GAP)) continue;
    if (taken.some((t) => Phaser.Math.Distance.Between(t.x, t.y, x, y) < minGap)) continue;
    return new Phaser.Math.Vector2(x, y);
  }
  return undefined;
}
