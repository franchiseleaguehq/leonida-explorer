// Category registry. Every category from the spec gets an id, label,
// color and a one-letter glyph icon (rendered as a styled divIcon — no
// external icon assets needed). Categories with no sourced locations
// stay in the list and render as empty (count 0) — never backfilled
// with invented locations.

export interface Category {
  id: string;
  label: string;
  color: string;
  glyph: string;
}

export const CATEGORIES: Category[] = [
  { id: 'stash-house', label: 'Stash Houses', color: '#F05CA9', glyph: 'S' },
  { id: 'hidden-cash', label: 'Hidden Cash', color: '#7BE495', glyph: '$' },
  { id: 'weapon-rare', label: 'Rare Weapons', color: '#FF9B54', glyph: 'W' },
  { id: 'weapon-unique', label: 'Unique Weapons', color: '#FF6B6B', glyph: 'U' },
  { id: 'ammo', label: 'Ammunition', color: '#FFC857', glyph: 'A' },
  { id: 'vehicle-rare', label: 'Rare Vehicles', color: '#38D9C5', glyph: 'V' },
  { id: 'vehicle-hidden', label: 'Hidden Vehicles', color: '#2BB3A3', glyph: 'H' },
  { id: 'safehouse', label: 'Safehouses', color: '#8ECAE6', glyph: '⌂' },
  { id: 'secret-room', label: 'Secret Rooms', color: '#B388FF', glyph: 'R' },
  { id: 'hidden-entrance', label: 'Hidden Entrances', color: '#957DAD', glyph: 'E' },
  { id: 'underground', label: 'Underground Locations', color: '#6C757D', glyph: 'D' },
  { id: 'easter-egg', label: 'Easter Eggs', color: '#F9F871', glyph: '✦' },
  { id: 'collectible', label: 'Collectibles', color: '#FFD166', glyph: 'C' },
  { id: 'treasure-hunt', label: 'Treasure Hunts', color: '#E0AA3E', glyph: 'T' },
  { id: 'random-encounter', label: 'Random Encounters', color: '#EF8354', glyph: '?' },
  { id: 'shipwreck', label: 'Shipwrecks', color: '#4CC9F0', glyph: '⚓' },
  { id: 'underwater', label: 'Underwater Locations', color: '#4361EE', glyph: '~' },
  { id: 'stunt-jump', label: 'Stunt Jumps', color: '#F72585', glyph: 'J' },
  { id: 'robbery', label: 'Robbery Locations', color: '#C1121F', glyph: '!' },
  { id: 'mission', label: 'Mission Locations', color: '#A8B3C2', glyph: 'M' },
  { id: 'gang-territory', label: 'Gang Territories', color: '#9D4EDD', glyph: 'G' },
  { id: 'store-clothing', label: 'Clothing Stores', color: '#FFAFCC', glyph: '👕' },
  { id: 'store-weapon', label: 'Weapon Stores', color: '#ADB5BD', glyph: '🔫' },
  { id: 'restaurant', label: 'Restaurants', color: '#FB8500', glyph: '🍔' },
  { id: 'gas-station', label: 'Gas Stations', color: '#606C38', glyph: '⛽' },
  { id: 'garage', label: 'Garages', color: '#5A189A', glyph: '🔧' },
  { id: 'hospital', label: 'Hospitals', color: '#FFFFFF', glyph: '✚' },
  { id: 'police', label: 'Police Stations', color: '#3A86FF', glyph: 'P' },
  { id: 'business', label: 'Businesses', color: '#83C5BE', glyph: 'B' },
  { id: 'activity', label: 'Activities', color: '#06D6A0', glyph: '★' },
  { id: 'landmark', label: 'Landmarks', color: '#E9C46A', glyph: '◆' },
  { id: 'other', label: 'Other', color: '#A8B3C2', glyph: '•' },
];

export const CATEGORY_MAP: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);
