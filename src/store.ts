import type { UserState } from './types';

const KEY = 'leonida-explorer-state-v1';

const DEFAULT_STATE: UserState = {
  found: {},
  favorites: {},
  notes: {},
  customMarkers: [],
  hiddenCategories: {},
  hideFound: false,
};

export function loadState(): UserState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<UserState>) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: UserState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full/unavailable — progress simply won't persist */
  }
}

export function exportState(state: UserState): string {
  return JSON.stringify({ app: 'leonida-explorer', version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importState(json: string): UserState {
  const parsed = JSON.parse(json) as { state?: Partial<UserState> };
  if (!parsed || typeof parsed !== 'object' || !parsed.state) throw new Error('Not a Leonida Explorer backup');
  return { ...DEFAULT_STATE, ...parsed.state };
}
