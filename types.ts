export enum ToolType {
  PEN = 'PEN',
  ERASER = 'ERASER',
  FILL = 'FILL',
  PICKER = 'PICKER',
  GRADIENT = 'GRADIENT',
  LINE = 'LINE',
  RULER = 'RULER',
  MIRROR = 'MIRROR'
}

export type SymmetryAxisType = 'vertical' | 'horizontal' | 'dual';

export type ProjectType = 'static' | 'animated';

export type PixelColor = string | null; // Hex string or null for transparent
export type GridState = PixelColor[][];

export interface HistoryState {
  past: GridState[];
  present: GridState;
  future: GridState[];
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface Project {
  id?: string;
  name: string;
  grid: string; // Serialized GridState or first frame
  frames?: string[]; // Serialized array of GridState for animation
  fps?: number; // Frames per second
  projectType?: ProjectType;
  width: number;
  height: number;
  userId: string;
  ownerName?: string;
  ownerEmail?: string;
  previewImage?: string; // Base64 data URL
  customColors?: string[]; // Custom project palette colors
  updatedAt: any; // Firestore Timestamp
}

import { User } from 'firebase/auth';

export interface Hotkey {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  label: string;
}

export type HotkeyConfig = Record<string, Hotkey>;

export interface ExtendedUser extends User {
  provider?: string;
  steamId?: string;
  githubId?: string;
  xId?: string;
}

