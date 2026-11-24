export type VerificationStatus =
  | 'verified' // Verified in-game
  | 'official' // Officially documented
  | 'community' // Community verified
  | 'unconfirmed' // Unconfirmed
  | 'approximate'; // Approximate location

export interface GameLocation {
  id: string;
  name: string;
  category: string; // category id, see categories.ts
  county?: string;
  city?: string;
  neighborhood?: string;
  /** [y, x] in game CRS pixel space (Leaflet [lat, lng] order). */
  coords: [number, number];
  description?: string;
  directions?: string;
  reward?: string;
  unlock?: string;
  respawn?: string;
  verification: VerificationStatus;
  source: string;
  sourceUrl?: string;
  lastVerified?: string; // ISO date
}

export interface CustomMarker {
  id: string;
  name: string;
  coords: [number, number];
  note?: string;
  createdAt: string;
}

export interface UserState {
  found: Record<string, true>;
  favorites: Record<string, true>;
  notes: Record<string, string>;
  customMarkers: CustomMarker[];
  hiddenCategories: Record<string, boolean>;
  hideFound: boolean;
}

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verified in-game',
  official: 'Officially documented',
  community: 'Community verified',
  unconfirmed: 'Unconfirmed',
  approximate: 'Approximate location',
};
