import { ACCESSORY_PRICE, SKIN_PRICE, TRAIL_PRICE } from './config';

export type CosmeticKind = 'skin' | 'accessory' | 'trail';

export interface Profile {
  id: string;
  name: string;
  coins: number;
  ownedSkins: string[];
  ownedTrails: string[];
  ownedAccessories: string[];
  skin: string;
  trail: string;
  accessory: string;
  guest?: boolean;
}

export const GUEST_ID = 'guest';
export const DEFAULT_SKIN = 'classic';
export const DEFAULT_TRAIL = 'none';
export const DEFAULT_ACCESSORY = 'none';

export const PRICES: Record<CosmeticKind, number> = {
  skin: SKIN_PRICE,
  accessory: ACCESSORY_PRICE,
  trail: TRAIL_PRICE,
};

const OWNED: Record<CosmeticKind, 'ownedSkins' | 'ownedAccessories' | 'ownedTrails'> = {
  skin: 'ownedSkins',
  accessory: 'ownedAccessories',
  trail: 'ownedTrails',
};

// These used to be sold as skins; profiles that bought them keep them as accessories.
const FORMER_ACCESSORY_SKINS = ['tophat', 'crown', 'bow', 'shades'];
export const MAX_NAME_LENGTH = 12;

const STORAGE_KEY = 'tag.profiles.v1';

function blankProfile(id: string, name: string): Profile {
  return {
    id,
    name,
    coins: 0,
    ownedSkins: [DEFAULT_SKIN],
    ownedTrails: [DEFAULT_TRAIL],
    ownedAccessories: [DEFAULT_ACCESSORY],
    skin: DEFAULT_SKIN,
    trail: DEFAULT_TRAIL,
    accessory: DEFAULT_ACCESSORY,
  };
}

function migrate(p: Profile): Profile {
  const moved = p.ownedSkins.filter((id) => FORMER_ACCESSORY_SKINS.includes(id));
  if (moved.length === 0) return p;
  p.ownedSkins = p.ownedSkins.filter((id) => !moved.includes(id));
  p.ownedAccessories = [...new Set([...p.ownedAccessories, ...moved])];
  if (moved.includes(p.skin)) {
    p.accessory = p.skin;
    p.skin = DEFAULT_SKIN;
  }
  return p;
}

export type PurchaseResult = 'bought' | 'equipped' | 'already' | 'poor' | 'guest';

/**
 * Profiles persist in localStorage. Storage can be unavailable (private
 * windows, blocked site data), so every access is guarded and the store keeps
 * working in memory for the session.
 */
class ProfileStore {
  private profiles: Profile[] = [];

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { profiles?: Profile[] }) : undefined;
      if (Array.isArray(parsed?.profiles)) {
        this.profiles = parsed.profiles.map((p) => migrate({ ...blankProfile(p.id, p.name), ...p }));
        this.save();
      }
    } catch {
      this.profiles = [];
    }
  }

  list(): Profile[] {
    return this.profiles;
  }

  get(id: string): Profile {
    if (id === GUEST_ID) return { ...blankProfile(GUEST_ID, 'Guest'), guest: true };
    return this.profiles.find((p) => p.id === id) ?? { ...blankProfile(GUEST_ID, 'Guest'), guest: true };
  }

  create(name: string): Profile {
    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH) || 'Player';
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const profile = blankProfile(id, trimmed);
    this.profiles.push(profile);
    this.save();
    return profile;
  }

  award(id: string, coins: number): void {
    const p = this.profiles.find((x) => x.id === id);
    if (!p || coins <= 0) return;
    p.coins += coins;
    this.save();
  }

  owns(profile: Profile, kind: CosmeticKind, itemId: string): boolean {
    return profile[OWNED[kind]].includes(itemId);
  }

  equipped(profile: Profile, kind: CosmeticKind): string {
    return profile[kind];
  }

  /** Buy (if needed) and equip an item. */
  buyOrEquip(id: string, kind: CosmeticKind, itemId: string): PurchaseResult {
    const p = this.profiles.find((x) => x.id === id);
    if (!p) return 'guest';
    if (this.equipped(p, kind) === itemId) return 'already';

    let result: PurchaseResult = 'equipped';
    if (!this.owns(p, kind, itemId)) {
      if (p.coins < PRICES[kind]) return 'poor';
      p.coins -= PRICES[kind];
      p[OWNED[kind]].push(itemId);
      result = 'bought';
    }
    p[kind] = itemId;
    this.save();
    return result;
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profiles: this.profiles }));
    } catch {
      // Storage unavailable: keep in-memory state only.
    }
  }
}

export const profileStore = new ProfileStore();
