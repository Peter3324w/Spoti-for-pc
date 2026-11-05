import { Music2, Play, Clock3 } from "lucide-react";
import type { Card, Image, Track } from "./types";
export function Artwork({
  images,
  src,
  label = "",
  className = "",
}: {
  images?: Image[];
  src?: string;
  label?: string;
  className?: string;
}) {
  const url = src || images?.[0]?.url;
  return (
    <span className={`artwork ${className}`}>
      {url ? (
        <img
          src={url}
          alt={label}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <Music2 size={28} />
      )}
    </span>
  );
}
export function MediaCards({
  items,
  onOpen,
}: {
  items: Card[];
  onOpen: (card: Card) => void;
}) {
  return (
    <div className="media-grid">
      {items.map((c, i) => (
        <button
          className={`media-card ${c.kind === "ARTIST" ? "artist-card" : ""}`}
          key={`${c.uri}-${i}`}
          aria-label={`Open ${c.title}`}
          onClick={() => onOpen(c)}
        >
          <span className="cover-wrap">
            <Artwork images={c.images} />
            <span className="card-play">
              <Play size={23} fill="currentColor" />
            </span>
          </span>
          <strong>{c.title}</strong>
          <span className="card-subtitle">
            {c.subtitle || c.kind.toLowerCase()}
          </span>
        </button>
      ))}
    </div>
  );
}
export function time(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function TrackList({
  tracks,
  onPlay,
  current,
  context,
}: {
  tracks: Track[];
  onPlay: (uri: string, trackUri?: string) => void;
  current?: string;
  context?: string;
}) {
  return (
    <table className="track-table">
      <thead>
        <tr>
          <th className="number">#</th>
          <th>Title</th>
          <th className="album-column">Album</th>
          <th className="duration">
            <Clock3 size={16} />
            <span className="sr-only">Duration</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((track, i) => (
          <tr
            key={`${track.uri}-${i}`}
            className={current === track.uri ? "current-track" : ""}
          >
            <td className="number">
              <button
                aria-label={`Play ${track.name}`}
                disabled={track.playable === false}
                onClick={() => onPlay(context || track.uri, track.uri)}
              >
                <span className="track-number">{i + 1}</span>
                <Play className="row-play" size={15} fill="currentColor" />
              </button>
            </td>
            <td>
              <button
                className="track-title"
                disabled={track.playable === false}
                onClick={() => onPlay(context || track.uri, track.uri)}
              >
                <Artwork images={track.album?.images} src={track.imageUrl} />
                <span>
                  <strong>{track.name}</strong>
                  <small>
                    {track.explicit && <span className="explicit">E</span>}
                    {track.artists?.map((a) => a.name).join(", ")}
                  </small>
                </span>
              </button>
            </td>
            <td className="album-column">{track.album?.name || "—"}</td>
            <td className="duration">{time(track.durationMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
