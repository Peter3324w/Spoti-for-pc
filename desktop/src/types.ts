export interface Image {
  url: string;
}
export interface Card {
  uri: string;
  kind: string;
  title: string;
  subtitle?: string;
  images: Image[];
}
export interface Track {
  uri: string;
  name: string;
  durationMs: number;
  artists: { name: string }[];
  album?: { uri: string; name: string; images: Image[] };
  imageUrl?: string;
  playable?: boolean;
  explicit?: boolean;
}
export interface Page<T> {
  items: T[];
  total: number;
  nextOffset?: number | null;
}
export interface LibraryItem {
  uri: string;
  kind: string;
  name: string;
  subtitle?: string;
  images: Image[];
}
export interface Shelf {
  title: string;
  items: Card[];
}
export interface Feed {
  greeting: string;
  shelves: Shelf[];
}
export interface Details {
  uri: string;
  name: string;
  description?: string;
  owner?: string;
  images: Image[];
  artists?: { name: string }[];
  trackCount?: number;
}
export interface DetailPage {
  details: Details;
  tracks: Page<Track>;
}
export interface PlayerState {
  item: Track | null;
  contextUri?: string;
  isPaused: boolean;
  isBuffering: boolean;
  positionMs: number;
  timestampMs: number;
  speed: number;
  shuffle: boolean;
  repeat: "OFF" | "CONTEXT" | "TRACK";
  restrictions?: {
    canPause: boolean;
    canResume: boolean;
    canSeek: boolean;
    canSkipNext: boolean;
    canSkipPrevious: boolean;
  };
}
export interface Session {
  connected: boolean;
  signedIn: boolean;
  connecting?: boolean;
  error?: string;
}
export interface Event {
  event: string;
  value: any;
}
export interface Client {
  request<T = any>(method: string, args?: Record<string, unknown>): Promise<T>;
  subscribe(callback: (event: Event) => void): () => void;
}
declare global {
  interface Window {
    spoti?: Client;
  }
}
