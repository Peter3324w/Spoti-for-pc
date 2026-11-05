import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Home,
  Search,
  Library,
  Heart,
  Music2,
  Plus,
  Play,
  ListMusic,
  Settings2,
  X,
  LoaderCircle,
  Disc3,
  Headphones,
  ExternalLink,
} from "lucide-react";
import { Artwork, MediaCards, TrackList } from "./components";
import { Player } from "./Player";
import { preview } from "./preview";
import type {
  Card,
  Client,
  DetailPage,
  LibraryItem,
  PlayerState,
  Session,
  Track,
} from "./types";
type Route = {
  type: "home" | "search" | "detail" | "liked" | "queue";
  uri?: string;
  kind?: string;
  query?: string;
};
const offline: Client = {
  request: async () => {
    throw new Error(
      "Open the Windows app to connect to Spotify, or explore the interface preview.",
    );
  },
  subscribe: () => () => {},
};
export default function App() {
  const [demo, setDemo] = useState(false);
  const client = demo ? preview : window.spoti || offline;
  const [session, setSession] = useState<Session>({
    connected: false,
    signedIn: false,
  });
  const ready = demo || session.signedIn;
  const [account, setAccount] = useState<{ name: string } | null>(null);
  const [route, setRoute] = useState<Route>({ type: "home" });
  const [history, setHistory] = useState<Route[]>([]);
  const [future, setFuture] = useState<Route[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [homeFilter, setHomeFilter] = useState("ALL");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryNext, setLibraryNext] = useState<number | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const libGeneration = useRef(0);
  const pageKey = JSON.stringify([route, query, homeFilter]);
  const [pageData, setPageData] = useState<{ key: string; value: any } | null>(
    null,
  );
  const data = pageData?.key === pageKey ? pageData.value : null;
  const setData = (value: any) =>
    setPageData((old) => ({
      key: pageKey,
      value:
        typeof value === "function"
          ? value(old?.key === pageKey ? old.value : null)
          : value,
    }));
  const [loading, setLoading] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const pageGeneration = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const aboutTrigger = useRef<HTMLButtonElement>(null);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [about, setAbout] = useState(false);
  function navigate(next: Route) {
    setHistory((h) => [...h, { ...route, query }]);
    setFuture([]);
    setRoute(next);
    if (next.type !== "search") setQuery("");
  }
  function back() {
    if (!history.length) return;
    setFuture((f) => [{ ...route, query }, ...f]);
    const previous = history[history.length - 1];
    setRoute(previous);
    setQuery(previous.query || "");
    setHistory((h) => h.slice(0, -1));
  }
  function forward() {
    if (!future.length) return;
    setHistory((h) => [...h, { ...route, query }]);
    setRoute(future[0]);
    setQuery(future[0].query || "");
    setFuture((f) => f.slice(1));
  }
  useEffect(() => {
    if (demo) return;
    let ignore = false;
    client
      .request<Session>("session.status")
      .then((s) => {
        if (!ignore) setSession(s);
      })
      .catch(() => {});
    const unsub = client.subscribe((e) => {
      if (e.event === "session") {
        setSession(e.value);
        if (e.value.error) setError(e.value.error);
      }
      if (e.event === "player") setPlayer(e.value);
    });
    return () => {
      ignore = true;
      unsub();
    };
  }, [client, demo]);
  useEffect(() => {
    let ignore = false;
    if (!ready) {
      setAccount(null);
      setData(null);
      setLibrary([]);
      setPlayer(null);
      return;
    }
    client
      .request("account")
      .then((value) => {
        if (!ignore) setAccount(value);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [client, ready]);
  useEffect(() => {
    const generation = ++libGeneration.current;
    setLibrary([]);
    setLibraryNext(null);
    if (!ready) return;
    setLibraryBusy(true);
    client
      .request("library", { filter })
      .then((value) => {
        if (libGeneration.current === generation) {
          setLibrary(value.items);
          setLibraryNext(value.nextOffset ?? null);
        }
      })
      .catch((e) => {
        if (libGeneration.current === generation) setError(e.message);
      })
      .finally(() => {
        if (libGeneration.current === generation) setLibraryBusy(false);
      });
  }, [client, ready, filter, refresh]);
  useEffect(() => {
    const generation = ++pageGeneration.current;
    setData(null);
    setPageError("");
    setMoreBusy(false);
    if (!ready) {
      setLoading(false);
      return;
    }
    if (route.type === "search" && !query.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(
      () => {
        const method =
          route.type === "home"
            ? "home"
            : route.type === "search"
              ? "search"
              : route.type === "detail"
                ? route.kind === "ALBUM"
                  ? "album"
                  : route.kind === "ARTIST"
                    ? "artist"
                    : "playlist"
                : route.type === "liked"
                  ? "liked"
                  : "queue";
        client
          .request(method, {
            uri: route.uri,
            query: query.trim(),
            filter: homeFilter,
          })
          .then((value) => {
            if (pageGeneration.current === generation) setData(value);
          })
          .catch((e) => {
            if (pageGeneration.current === generation) setPageError(e.message);
          })
          .finally(() => {
            if (pageGeneration.current === generation) setLoading(false);
          });
      },
      route.type === "search" ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [client, ready, route, query, homeFilter, refresh]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!about) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbout(false);
      if (e.key === "Tab") {
        const nodes =
          dialog.current?.querySelectorAll<HTMLElement>("button,a[href]");
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
      aboutTrigger.current?.focus();
    };
  }, [about]);
  async function connect() {
    setError("");
    setConnecting(true);
    try {
      const s = await client.request<Session>("desktop.connect");
      setSession(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }
  async function play(uri: string, trackUri?: string) {
    try {
      await client.request("player.play", { uri, trackUri });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function open(card: Card) {
    if (["TRACK", "EPISODE"].includes(card.kind)) {
      void play(card.uri);
      return;
    }
    if (!["ALBUM", "PLAYLIST", "ARTIST", "COLLECTION"].includes(card.kind)) {
      setError(
        "This content type is not available in the first desktop version yet.",
      );
      return;
    }
    navigate(
      card.kind === "COLLECTION"
        ? { type: "liked" }
        : { type: "detail", uri: card.uri, kind: card.kind },
    );
  }
  async function loadMoreLibrary() {
    if (libraryNext === null || libraryBusy) return;
    const generation = libGeneration.current;
    setLibraryBusy(true);
    try {
      const result = await client.request("library", {
        filter,
        offset: libraryNext,
      });
      if (generation === libGeneration.current) {
        setLibrary((old) => [...old, ...result.items]);
        setLibraryNext(result.nextOffset ?? null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (generation === libGeneration.current) setLibraryBusy(false);
    }
  }
  async function loadMoreTracks() {
    if (moreBusy) return;
    const generation = pageGeneration.current;
    const page = route.type === "liked" ? data : data?.tracks;
    if (page?.nextOffset == null) return;
    setMoreBusy(true);
    try {
      const method =
        route.type === "liked"
          ? "liked"
          : route.kind === "ALBUM"
            ? "album"
            : "playlist";
      const result = await client.request(method, {
        uri: route.uri,
        offset: page.nextOffset,
      });
      if (generation === pageGeneration.current)
        setData((old: any) =>
          route.type === "liked"
            ? { ...result, items: [...old.items, ...result.items] }
            : {
                ...result,
                tracks: {
                  ...result.tracks,
                  items: [...old.tracks.items, ...result.tracks.items],
                },
              },
        );
    } catch (e) {
      if (generation === pageGeneration.current) setError((e as Error).message);
    } finally {
      if (generation === pageGeneration.current) setMoreBusy(false);
    }
  }
  const detail =
    route.type === "detail" && route.kind === "ARTIST" && data
      ? ({
          details: data.artist,
          tracks: {
            items: data.topTracks.map((t: { track: Track }) => t.track),
            total: data.topTracks.length,
          },
        } as DetailPage)
      : route.type === "detail"
        ? (data as DetailPage)
        : null;
  const visibleTracks: Track[] =
    route.type === "liked"
      ? (data?.items || []).map((s: { track: Track }) => s.track)
      : detail?.tracks.items || [];
  const nextOffset =
    route.type === "liked" ? data?.nextOffset : detail?.tracks.nextOffset;
  const mapped = (items: any[], kind: string): Card[] =>
    items.map((item) => ({
      ...item,
      kind,
      title: item.name,
      subtitle:
        item.artists?.map((a: { name: string }) => a.name).join(", ") ||
        item.owner,
      images: item.images || [],
    }));
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          aria-label="Spoti home"
          onClick={() => navigate({ type: "home" })}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <strong>
            spoti<span>for pc</span>
          </strong>
        </button>
        <div className="search-area">
          <button
            className={`home-button ${route.type === "home" ? "selected" : ""}`}
            aria-label="Home"
            onClick={() => navigate({ type: "home" })}
          >
            <Home
              size={24}
              fill={route.type === "home" ? "currentColor" : "none"}
            />
          </button>
          <label className="search-field">
            <Search size={24} />
            <input
              ref={searchInput}
              type="search"
              aria-label="Search music"
              placeholder="What do you want to play?"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (route.type !== "search") navigate({ type: "search" });
              }}
            />
            <span className="search-key">Ctrl K</span>
            <Disc3 size={23} />
          </label>
        </div>
        <div className="top-actions">
          <span className="desktop-label">
            <Headphones size={15} />
            Made for your desktop
          </span>
          <button
            ref={aboutTrigger}
            className="about-button"
            aria-label="About Spoti for PC"
            onClick={() => setAbout(true)}
          >
            <Settings2 size={20} />
          </button>
          {ready ? (
            <span className="avatar" title={account?.name}>
              {account?.name?.[0] || "S"}
            </span>
          ) : (
            <button
              className="login-small"
              onClick={connect}
              disabled={connecting}
            >
              Log in
            </button>
          )}
        </div>
      </header>
      <div className="workspace">
        <aside className="library-panel" aria-label="Your library">
          <div className="library-heading">
            <span>
              <Library size={23} />
              <strong>Your Library</strong>
            </span>
            <button
              aria-label="Refresh library"
              onClick={() => setRefresh((n) => n + 1)}
              disabled={!ready}
            >
              <Plus size={22} />
            </button>
          </div>
          <div className="library-filters">
            {[
              ["ALL", "All"],
              ["PLAYLISTS", "Playlists"],
              ["ALBUMS", "Albums"],
              ["ARTISTS", "Artists"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "selected" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="library-sort">
            <span>
              {ready ? "Your collection" : "A home for your favorites"}
            </span>
            <span>
              Recents <ListMusic size={16} />
            </span>
          </div>
          <div className="library-scroll">
            {ready && (
              <button
                className={`library-item ${route.type === "liked" ? "selected" : ""}`}
                onClick={() => navigate({ type: "liked" })}
              >
                <span className="liked-art">
                  <Heart size={23} fill="currentColor" />
                </span>
                <span>
                  <strong>Liked Songs</strong>
                  <small>Playlist · Your favorites</small>
                </span>
              </button>
            )}
            {library.map((item) => (
              <button
                key={item.uri}
                className={`library-item ${route.uri === item.uri ? "selected" : ""}`}
                onClick={() => open({ ...item, title: item.name })}
              >
                <Artwork
                  images={item.images}
                  className={item.kind === "ARTIST" ? "round" : ""}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.kind.toLowerCase()}{" "}
                    {item.subtitle && `· ${item.subtitle}`}
                  </small>
                </span>
              </button>
            ))}
            {libraryNext !== null && (
              <button
                className="subtle-button"
                disabled={libraryBusy}
                onClick={loadMoreLibrary}
              >
                {libraryBusy ? "Loading…" : "Load more"}
              </button>
            )}
            {!ready && (
              <div className="library-empty">
                <h2>Your next favorite is waiting</h2>
                <p>
                  Bring your playlists, albums, and artists together in one
                  place.
                </p>
                <button onClick={connect} disabled={connecting}>
                  Connect your library <ArrowRight size={16} />
                </button>
              </div>
            )}
            {ready && !libraryBusy && !library.length && (
              <p className="quiet-empty">
                No {filter === "ALL" ? "saved music" : filter.toLowerCase()}{" "}
                yet.
              </p>
            )}
            {libraryBusy && (
              <div className="inline-loading">
                <LoaderCircle className="spin" size={18} />
                Loading library
              </div>
            )}
          </div>
          <div className="library-footer">
            <span>
              Powered by <button onClick={() => setAbout(true)}>Myspoti</button>
            </span>
            <span>GPL-3.0</span>
          </div>
        </aside>
        <main
          className={`content-panel ${route.type === "home" ? "home-content" : ""}`}
        >
          <div className="content-toolbar">
            <div className="history-buttons">
              <button
                aria-label="Go back"
                disabled={!history.length}
                onClick={back}
              >
                <ArrowLeft size={18} />
              </button>
              <button
                aria-label="Go forward"
                disabled={!future.length}
                onClick={forward}
              >
                <ArrowRight size={18} />
              </button>
            </div>
            {demo ? (
              <span className="preview-label">
                Interface preview · sample library · no audio
              </span>
            ) : (
              <span className="connection-label">
                <i className={session.signedIn ? "online" : ""} />
                {session.signedIn
                  ? "Connected to Spotify"
                  : session.connected
                    ? "Waiting for Spotify login"
                    : "Your music, on Windows"}
              </span>
            )}
          </div>
          {!ready ? (
            <section className="welcome">
              <div className="welcome-art" aria-hidden="true">
                <div className="record">
                  <div />
                </div>
                <div className="sleeve">
                  <span>
                    GOOD
                    <br />
                    SOUNDS.
                  </span>
                  <Music2 size={35} />
                </div>
                <span className="welcome-caption">
                  A familiar feeling. A new home.
                </span>
              </div>
              <h1>Your music. Your desktop.</h1>
              <p>
                Your playlists, your favorites, your everyday soundtrack.
                <br />A desktop home for everything you love listening to.
              </p>
              <button
                className="primary-button"
                onClick={connect}
                disabled={connecting}
              >
                {connecting ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <ArrowUpRight size={19} />
                )}{" "}
                {connecting ? "Opening Spotify…" : "Connect to Spotify"}
              </button>
              {session.connecting || session.connected ? (
                <p className="login-note">
                  Finish signing in in the Chrome playback window.
                  <br />
                  Your library will appear here automatically.
                </p>
              ) : (
                <p className="login-note">
                  Sign in on Spotify’s own page. Your password stays with
                  Spotify.
                </p>
              )}
              {!window.spoti && (
                <button
                  className="preview-button"
                  onClick={() => {
                    setDemo(true);
                    setError("");
                  }}
                >
                  Explore the preview <ArrowRight size={16} />
                </button>
              )}
              <div className="welcome-bottom">
                <span>
                  <Library size={16} />
                  Your real library
                </span>
                <span>
                  <ListMusic size={16} />
                  Your kind of queue
                </span>
                <span>
                  <Headphones size={16} />
                  Made for Windows
                </span>
              </div>
            </section>
          ) : (
            <div
              className="content-body"
              key={`${route.type}-${route.uri || ""}`}
            >
              {route.type === "home" && (
                <>
                  <div className="home-filters">
                    {[
                      ["ALL", "All"],
                      ["MUSIC", "Music"],
                      ["PODCASTS", "Podcasts"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={homeFilter === value ? "selected" : ""}
                        onClick={() => setHomeFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {!loading && data && (
                    <>
                      <div className="home-intro">
                        <h1>{data.greeting || "Welcome back"}</h1>
                        <span>Your world, in sound.</span>
                      </div>
                      <div className="quick-grid">
                        {library.slice(0, 8).map((item) => (
                          <button
                            key={item.uri}
                            onClick={() => open({ ...item, title: item.name })}
                          >
                            <Artwork images={item.images} />
                            <strong>{item.name}</strong>
                            <Play size={18} fill="currentColor" />
                          </button>
                        ))}
                      </div>
                      {data.shelves
                        ?.filter((s: { items: Card[] }) => s.items?.length)
                        .map(
                          (s: { title: string; items: Card[] }, i: number) => (
                            <section className="shelf" key={`${s.title}-${i}`}>
                              <div className="section-heading">
                                <h2>{s.title || "Made for you"}</h2>
                              </div>
                              <MediaCards items={s.items} onOpen={open} />
                            </section>
                          ),
                        )}
                      {!data.shelves?.length && (
                        <div className="empty-state">
                          <Music2 size={35} />
                          <h2>Your home is getting started</h2>
                          <p>
                            Search for an artist or open something from your
                            library.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {route.type === "search" && (
                <>
                  <h1>
                    {query.trim()
                      ? "Search results"
                      : "Find your next favorite"}
                  </h1>
                  {!query.trim() && (
                    <p className="quiet-empty">
                      Artists, songs, albums, and the playlists you’ll keep
                      coming back to.
                    </p>
                  )}
                  {data && (
                    <>
                      {data.tracks?.items?.length > 0 && (
                        <section className="shelf">
                          <h2>Songs</h2>
                          <TrackList
                            tracks={data.tracks.items}
                            onPlay={play}
                            current={player?.item?.uri}
                          />
                        </section>
                      )}
                      {[
                        ["artists", "Artists", "ARTIST"],
                        ["albums", "Albums", "ALBUM"],
                        ["playlists", "Playlists", "PLAYLIST"],
                      ].map(
                        ([key, title, kind]) =>
                          data[key]?.items?.length > 0 && (
                            <section className="shelf" key={key}>
                              <h2>{title}</h2>
                              <MediaCards
                                items={mapped(data[key].items, kind)}
                                onOpen={open}
                              />
                            </section>
                          ),
                      )}
                      {!["tracks", "artists", "albums", "playlists"].some(
                        (k) => data[k]?.items?.length,
                      ) && (
                        <div className="empty-state">
                          <Search size={36} />
                          <h2>No results for “{query}”</h2>
                          <p>Try another artist, album, or song.</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {(detail || route.type === "liked") && (
                <>
                  <section className="detail-hero">
                    {route.type === "liked" ? (
                      <span className="liked-art large">
                        <Heart size={74} fill="currentColor" />
                      </span>
                    ) : (
                      <Artwork images={detail?.details.images} />
                    )}
                    <div>
                      <span className="detail-kind">
                        {route.type === "liked"
                          ? "Playlist"
                          : route.kind?.toLowerCase()}
                      </span>
                      <h1>
                        {route.type === "liked"
                          ? "Liked Songs"
                          : detail?.details.name}
                      </h1>
                      {detail?.details.description && (
                        <p>
                          {detail.details.description.replace(/<[^>]*>/g, "")}
                        </p>
                      )}
                      <span className="detail-meta">
                        {detail?.details.owner ||
                          detail?.details.artists
                            ?.map((a) => a.name)
                            .join(", ") ||
                          account?.name}{" "}
                        <b>·</b>{" "}
                        {route.type === "liked"
                          ? data?.total || 0
                          : detail?.tracks.total || 0}{" "}
                        songs
                      </span>
                    </div>
                  </section>
                  <div className="detail-actions">
                    <button
                      className="green-play"
                      aria-label={`Play ${route.type === "liked" ? "Liked Songs" : detail?.details.name}`}
                      disabled={!visibleTracks.length}
                      onClick={() =>
                        play(
                          route.type === "liked"
                            ? "spotify:collection:tracks"
                            : route.uri!,
                        )
                      }
                    >
                      <Play size={27} fill="currentColor" />
                    </button>
                    <span>
                      {route.type === "liked"
                        ? "All the songs you love, in one place."
                        : "Let it play."}
                    </span>
                  </div>
                  <TrackList
                    tracks={visibleTracks}
                    context={
                      route.type === "liked"
                        ? "spotify:collection:tracks"
                        : route.uri
                    }
                    onPlay={play}
                    current={player?.item?.uri}
                  />
                  {nextOffset != null && (
                    <button
                      className="subtle-button load-more"
                      disabled={moreBusy}
                      onClick={loadMoreTracks}
                    >
                      {moreBusy ? "Loading…" : "Load more songs"}
                    </button>
                  )}
                  {!loading && !visibleTracks.length && (
                    <p className="quiet-empty">No tracks to show yet.</p>
                  )}
                </>
              )}
              {route.type === "queue" && (
                <>
                  <h1>Queue</h1>
                  <section className="shelf">
                    <h2>Now playing</h2>
                    {player?.item ? (
                      <TrackList tracks={[player.item]} onPlay={play} />
                    ) : (
                      <p className="quiet-empty">
                        Pick a song to get things started.
                      </p>
                    )}
                  </section>
                  <section className="shelf">
                    <h2>Up next</h2>
                    {data && (data.queued?.length || data.nextUp?.length) ? (
                      <TrackList
                        tracks={[
                          ...(data.queued || []),
                          ...(data.nextUp || []),
                        ]}
                        onPlay={play}
                      />
                    ) : (
                      <p className="quiet-empty">
                        Your next tracks will appear here.
                      </p>
                    )}
                    <button
                      className="subtle-button"
                      onClick={() => setRefresh((n) => n + 1)}
                    >
                      Refresh queue
                    </button>
                  </section>
                </>
              )}
              {loading && (
                <div className="page-loading" role="status">
                  <LoaderCircle className="spin" size={26} />
                  Finding your music…
                </div>
              )}
              {pageError && (
                <div className="empty-state" role="alert">
                  <h2>That didn’t load</h2>
                  <p>{pageError}</p>
                  <button
                    className="subtle-button"
                    onClick={() => setRefresh((n) => n + 1)}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <Player
        state={player}
        client={client}
        ready={ready && !demo}
        onError={setError}
        onQueue={() => navigate({ type: "queue" })}
      />
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {about && (
        <div className="modal-backdrop" onClick={() => setAbout(false)}>
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            className="about-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              autoFocus
              aria-label="Close about"
              onClick={() => setAbout(false)}
            >
              <X size={22} />
            </button>
            <Music2 className="about-logo" size={36} />
            <h2 id="about-title">Spoti for PC</h2>
            <p>A desktop home for your music.</p>
            <p>
              Windows interface by Peter Phiri. Powered by{" "}
              <strong>Myspoti</strong> and its original Kotlin API and Chrome
              playback integration. This modified desktop version is licensed
              under <strong>GPL-3.0</strong>. Changes began November 5, 2026.
            </p>
            <p>
              Includes work from Spotui, Metrolist, BitChord and other projects
              listed in THIRD_PARTY_NOTICES.md, shipped with the app. This
              software comes without warranty. You may modify and redistribute
              it under GPL-3.0.
            </p>
            <div className="about-links">
              <a
                href="https://github.com/Peter3324w/Spoti-for-pc"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (window.spoti) {
                    e.preventDefault();
                    void client.request("desktop.link", { name: "source" });
                  }
                }}
              >
                Source & license <ExternalLink size={14} />
              </a>
              <a
                href="https://github.com/kota-zo/myspoti"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (window.spoti) {
                    e.preventDefault();
                    void client.request("desktop.link", { name: "upstream" });
                  }
                }}
              >
                Original Myspoti <ExternalLink size={14} />
              </a>
            </div>
            <small>
              Independent project. Not affiliated with or endorsed by Spotify.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
