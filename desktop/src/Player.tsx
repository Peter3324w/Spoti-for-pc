import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  ListMusic,
  Heart,
  Mic2,
} from "lucide-react";
import { Artwork, time } from "./components";
import type { Client, PlayerState } from "./types";
export function Player({
  state,
  client,
  onError,
  onQueue,
  ready,
}: {
  state: PlayerState | null;
  client: Client;
  onError: (s: string) => void;
  onQueue: () => void;
  ready: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const [volume, setVolume] = useState(70);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const item = state?.item;
  const currentUri = useRef(item?.uri);
  currentUri.current = item?.uri;
  const likeGeneration = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let ignore = false;
    const generation = ++likeGeneration.current;
    setSaved(false);
    setSaving(false);
    if (item && ready)
      client
        .request<boolean>("library.contains", { uri: item.uri })
        .then((value) => {
          if (!ignore && generation === likeGeneration.current) setSaved(value);
        })
        .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [item?.uri, client, ready]);
  useEffect(() => {
    if (ready)
      client
        .request<number>("player.volume")
        .then((v) => setVolume(Math.round(v * 100)))
        .catch(() => {});
  }, [client, ready]);
  const command = (method: string, args?: Record<string, unknown>) =>
    client.request(method, args).catch((e) => onError(e.message));
  const position = item
    ? Math.min(
        item.durationMs,
        Math.max(
          0,
          (state?.positionMs || 0) +
            (!state?.isPaused && !state?.isBuffering
              ? Math.max(0, now - (state?.timestampMs || now)) *
                (state?.speed || 1)
              : 0),
        ),
      )
    : 0;
  const restrictions = state?.restrictions;
  async function save() {
    if (!item || saving) return;
    const uri = item.uri;
    const generation = ++likeGeneration.current;
    const target = !saved;
    setSaving(true);
    try {
      await client.request("library.save", { uri, saved: target });
      if (currentUri.current === uri && likeGeneration.current === generation)
        setSaved(target);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      if (currentUri.current === uri && likeGeneration.current === generation)
        setSaving(false);
    }
  }
  return (
    <footer className="player" aria-label="Music player">
      <div className="now-playing">
        <Artwork src={item?.imageUrl} images={item?.album?.images} />
        <div>
          <strong>{item?.name || "Nothing playing yet"}</strong>
          <span>
            {item?.artists?.map((a) => a.name).join(", ") ||
              "Find something that feels like you"}
          </span>
        </div>
        <button
          className={saved ? "active" : ""}
          aria-label={saved ? "Remove from Liked Songs" : "Save to Liked Songs"}
          disabled={!item || saving}
          onClick={save}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="transport">
        <div className="transport-buttons">
          <button
            className={state?.shuffle ? "active" : ""}
            aria-label="Shuffle"
            aria-pressed={!!state?.shuffle}
            disabled={!item}
            onClick={() => command("player.shuffle", { on: !state?.shuffle })}
          >
            <Shuffle size={17} />
          </button>
          <button
            aria-label="Previous track"
            disabled={!item || restrictions?.canSkipPrevious === false}
            onClick={() => command("player.previous")}
          >
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button
            className="main-play"
            aria-label={state && !state.isPaused ? "Pause" : "Resume playback"}
            disabled={
              !item ||
              (state?.isPaused
                ? restrictions?.canResume === false
                : restrictions?.canPause === false)
            }
            onClick={() =>
              command(state?.isPaused ? "player.resume" : "player.pause")
            }
          >
            {state && !state.isPaused ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>
          <button
            aria-label="Next track"
            disabled={!item || restrictions?.canSkipNext === false}
            onClick={() => command("player.next")}
          >
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className={state && state.repeat !== "OFF" ? "active" : ""}
            aria-label="Repeat"
            disabled={!item}
            onClick={() =>
              command("player.repeat", {
                mode:
                  state?.repeat === "OFF"
                    ? "CONTEXT"
                    : state?.repeat === "CONTEXT"
                      ? "TRACK"
                      : "OFF",
              })
            }
          >
            {state?.repeat === "TRACK" ? (
              <Repeat1 size={17} />
            ) : (
              <Repeat size={17} />
            )}
          </button>
        </div>
        <div className="seek">
          <span>{time(position)}</span>
          <input
            aria-label="Playback position"
            type="range"
            min="0"
            max={item?.durationMs || 1}
            value={position}
            disabled={!item || restrictions?.canSeek === false}
            onChange={(e) =>
              command("player.seek", { positionMs: Number(e.target.value) })
            }
          />
          <span>{time(item?.durationMs || 0)}</span>
        </div>
      </div>
      <div className="player-extras">
        <Mic2 size={17} aria-hidden="true" />
        <button aria-label="Open queue" onClick={onQueue}>
          <ListMusic size={19} />
        </button>
        <Volume2 size={19} />
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="100"
          value={volume}
          disabled={!ready}
          onChange={(e) => setVolume(Number(e.target.value))}
          onPointerUp={() => command("player.volume", { level: volume / 100 })}
          onKeyUp={() => command("player.volume", { level: volume / 100 })}
        />
      </div>
    </footer>
  );
}
