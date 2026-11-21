import type { Card, Client, Track } from "./types";
const records = [
  ["playlist", "night", "Night Drive", "After dark, on repeat."],
  ["album", "velvet", "Velvet Hour", "Milo Rivers"],
  ["playlist", "slow", "Slow Sunday", "A little room to breathe."],
  ["album", "orbit", "In Orbit", "Luna Park"],
  ["playlist", "focus", "Deep Focus", "Find your flow."],
  ["album", "blue", "Blue Room", "The Sundays Club"],
  ["playlist", "gold", "Golden", "Good days sound like this."],
  ["album", "waves", "Soft Waves", "Coastline"],
];
export const cards: Card[] = records.map(([kind, id, title, subtitle]) => ({
  uri: `spotify:${kind}:${id}`,
  kind: kind.toUpperCase(),
  title,
  subtitle,
  images: [{ url: `./art/${id}.svg` }],
}));
const titles = [
  "After Hours",
  "City Lights",
  "A Long Way Home",
  "Velvet Sky",
  "Between the Lines",
  "Stay Awhile",
  "Quiet Motion",
  "Last Train",
];
export const tracks: Track[] = titles.map((name, i) => ({
  uri: `spotify:track:preview${i}`,
  name,
  durationMs: 183000 + i * 13000,
  artists: [{ name: ["Milo Rivers", "Luna Park", "Coastline"][i % 3] }],
  album: { uri: cards[1].uri, name: "Velvet Hour", images: cards[i].images },
  playable: true,
}));
export const preview: Client = {
  subscribe: () => () => {},
  async request(method, args = {}) {
    if (method.startsWith("player.") || method === "library.save")
      throw new Error(
        "Playback is available in the Windows app. This preview uses a sample library.",
      );
    if (method === "home")
      return {
        greeting: "Made for a good day",
        shelves: [
          { title: "Your heavy rotation", items: cards.slice(0, 6) },
          {
            title: "A little more your mood",
            items: [...cards.slice(4), ...cards.slice(0, 2)],
          },
        ],
      } as any;
    if (method === "account")
      return { name: "Preview", username: "preview" } as any;
    if (method === "library")
      return {
        items: cards
          .filter(
            (c) =>
              !args.filter ||
              args.filter === "ALL" ||
              (args.filter === "PLAYLISTS" && c.kind === "PLAYLIST") ||
              (args.filter === "ALBUMS" && c.kind === "ALBUM"),
          )
          .map((c) => ({ ...c, name: c.title })),
        total: 8,
        nextOffset: null,
      } as any;
    if (method === "search") {
      const q = String(args.query).toLowerCase();
      return {
        tracks: {
          items: tracks.filter((t) => t.name.toLowerCase().includes(q)),
        },
        albums: {
          items: cards
            .filter((c) => c.title.toLowerCase().includes(q))
            .map((c) => ({ ...c, name: c.title })),
        },
        artists: { items: [] },
        playlists: { items: [] },
      } as any;
    }
    if (method === "playlist" || method === "album") {
      const card = cards.find((c) => c.uri === args.uri) || cards[0];
      return {
        details: {
          ...card,
          name: card.title,
          description: card.subtitle,
          owner: "Spoti Editorial",
          trackCount: tracks.length,
        },
        tracks: { items: tracks, total: tracks.length, nextOffset: null },
      } as any;
    }
    if (method === "liked")
      return {
        items: tracks.map((track) => ({ track })),
        total: tracks.length,
        nextOffset: null,
      } as any;
    if (method === "queue") return { queued: [], nextUp: [] } as any;
    if (method === "library.contains") return false as any;
    return null as any;
  },
};
