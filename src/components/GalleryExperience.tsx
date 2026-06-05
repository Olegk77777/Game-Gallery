"use client";

/* eslint-disable @next/next/no-img-element */

import type { CSSProperties, PointerEvent, TouchEvent, WheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Game as SourceGame, Screenshot as SourceShot } from "@/lib/gallery";

type GalleryShot = SourceShot & {
  displaySrc: string;
  fullSrc: string;
};

type GalleryGame = {
  id: string;
  title: string;
  full: string;
  place: string;
  year: number;
  accent: string;
  cover?: string; // имя файла кадра-обложки; если не задано — берётся первый кадр
  shots: GalleryShot[];
};

type GalleryRoute =
  | { view: "home" }
  | { view: "album"; gameId: string; shot: number | null };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const GAME_META: Record<string, Omit<GalleryGame, "id" | "shots">> = {
  "The Witcher 3 Wild Hunt": {
    title: "The Witcher 3",
    full: "The Witcher 3: Wild Hunt",
    place: "Velen - No Man's Land",
    year: 2015,
    accent: "#e6a15c",
  },
  "S.T.A.L.K.E.R. 2 Heart of Chornobyl": {
    title: "S.T.A.L.K.E.R. 2",
    full: "S.T.A.L.K.E.R. 2: Heart of Chornobyl",
    place: "The Zone - Chornobyl",
    year: 2024,
    accent: "#cdd66b",
  },
  "Cyberpunk 2077": {
    title: "Cyberpunk 2077",
    full: "Cyberpunk 2077",
    place: "Night City",
    year: 2020,
    accent: "#e2c84b",
    cover: "Cyberpunk 2077® 2026.06.05 - 19.43.16.09 копия.jpg",
  },
  "Kingdom Come Deliverance": {
    title: "Kingdom Come",
    full: "Kingdom Come: Deliverance",
    place: "Bohemia, 1403",
    year: 2018,
    accent: "#bfa07a",
  },
  "Forza Horizon 6": {
    title: "Forza Horizon 6",
    full: "Forza Horizon 6",
    place: "Japan",
    year: 2026,
    accent: "#d98a5b",
  },
};

function slugify(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || fallback;
}

function assetPath(pathname: string | undefined) {
  return pathname ? encodeURI(pathname) : undefined;
}

function toGalleryGame(game: SourceGame, index: number): GalleryGame {
  const meta = GAME_META[game.title] ?? {
    title: game.title,
    full: game.title,
    place: "Curated archive",
    year: 2026,
    accent: ["#e6a15c", "#cdd66b", "#e2c84b", "#bfa07a"][index % 4],
  };

  return {
    id: slugify(game.title, `game-${index + 1}`),
    ...meta,
    shots: game.screenshots.map((shot) => {
      const src = assetPath(shot.src) ?? "";
      const previewSrc = assetPath(shot.previewSrc);
      const thumbSrc = assetPath(shot.thumbSrc);
      const heroSrc = assetPath(shot.heroSrc);

      return {
        ...shot,
        src,
        previewSrc,
        thumbSrc,
        heroSrc,
        displaySrc: previewSrc ?? heroSrc ?? src,
        fullSrc: src,
      };
    }),
  };
}

function accentStyle(accent: string) {
  return { "--accent": accent } as CSSProperties;
}

function setHash(pathname: string) {
  if (typeof window === "undefined") return;
  window.location.hash = pathname;
}

function parseHash(): GalleryRoute {
  if (typeof window === "undefined") return { view: "home" };

  const parts = (window.location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);

  if (parts[0] === "a" && parts[1]) {
    const shot = parts[2] != null ? Number.parseInt(parts[2], 10) : null;

    return {
      view: "album",
      gameId: decodeURIComponent(parts[1]),
      shot: Number.isFinite(shot) ? shot : null,
    };
  }

  return { view: "home" };
}

function useHashRoute() {
  const [route, setRoute] = useState<GalleryRoute>({ view: "home" });

  useEffect(() => {
    const sync = () => setRoute(parseHash());
    sync();
    window.addEventListener("hashchange", sync);

    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return route;
}

function useBodyLock(active: boolean) {
  useEffect(() => {
    document.body.classList.toggle("lock", active);

    return () => document.body.classList.remove("lock");
  }, [active]);
}

function Preloader() {
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<"load" | "exit" | "gone">("load");

  useEffect(() => {
    let progress = 0;
    const interval = window.setInterval(() => {
      progress = Math.min(100, progress + Math.round(4 + Math.random() * 9));
      setPct(progress);

      if (progress >= 100) {
        window.clearInterval(interval);
        window.setTimeout(() => setPhase("exit"), 420);
        window.setTimeout(() => setPhase("gone"), 1420);
      }
    }, 70);

    return () => window.clearInterval(interval);
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`preloader${phase === "exit" ? " exit" : ""}`}>
      <div className="pl-top label">Cinematic 21:9 Frame Archive</div>
      <div className="pl-center">
        <div className="pl-word serif">
          Game <em>Gallery</em>
        </div>
      </div>
      <div className="pl-foot">
        <div className="pl-bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="pl-meta">
          <span className="label">Loading archive</span>
          <span className="label">{String(pct).padStart(3, "0")} / 100</span>
        </div>
      </div>
    </div>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (on) {
      audio.pause();
      setOn(false);
      return;
    }

    try {
      audio.volume = 0.28;
      await audio.play();
      setOn(true);
    } catch {
      setOn(false);
    }
  };

  return (
    <button className="sound" type="button" onClick={toggle} aria-label="Toggle sound">
      <audio ref={audioRef} src={`${BASE_PATH}/audio/ambient.wav`} loop />
      {on ? <SoundOnIcon /> : <SoundOffIcon />}
      <span>{on ? "Sound On" : "Sound Off"}</span>
    </button>
  );
}

function SoundOnIcon() {
  return (
    <svg className="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg className="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M22 9l-5 6" />
      <path d="M17 9l5 6" />
    </svg>
  );
}

function Hero({ games }: { games: GalleryGame[] }) {
  const featured = useMemo(
    () =>
      games
        .flatMap((game) => game.shots.slice(0, 2).map((shot) => ({ game, shot })))
        .slice(0, 6),
    [games]
  );
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);
  const current = featured[active] ?? featured[0];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % featured.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [featured.length]);

  return (
    <section className={`hero${shown ? " shown" : ""}`} data-screen-label="Hero">
      <div className="hero-media">
        {featured.map((item, index) => (
          <img
            key={`${item.game.id}-${item.shot.id}`}
            className={`frame-img${index === active ? " on" : ""}`}
            src={item.shot.fullSrc}
            alt=""
          />
        ))}
      </div>
      <div className="hero-grade" />

      <div className="hero-content">
        {current && (
          <div className="hero-now anim d1" style={accentStyle(current.game.accent)}>
            <span className="ln" />
            <span className="t">Now viewing - {current.game.full}</span>
          </div>
        )}
        <h1 className="serif anim d2">
          Game <em>Gallery</em>
        </h1>
        <p className="lede anim d3">
          A curated visual archive of game worlds - light, atmosphere and composition, projected one
          cinematic frame at a time.
        </p>
      </div>

      <div className="hero-foot anim d4">
        <a className="scrollcue" href="#collections">
          <span>Collections</span>
          <span className="bar" />
        </a>
        <div className="hero-dots" aria-label="Featured frames">
          {featured.map((item, index) => (
            <button
              key={`${item.game.id}-dot-${item.shot.id}`}
              className={index === active ? "on" : ""}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show featured frame ${index + 1}`}
            />
          ))}
        </div>
        <div className="authorchip">
          <img className="ava-img" src={`${BASE_PATH}/assets/author.jpg`} alt="Oleg Krugliak" />
          <div className="meta">
            <div className="nm serif">Oleg Krugliak</div>
            <div className="rl">Curator & Designer</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Collections({ games }: { games: GalleryGame[] }) {
  return (
    <section className="collections" id="collections" data-screen-label="Collections">
      <div className="sec-head">
        <h2 className="serif">Collections</h2>
        <div className="cnt">{String(games.length).padStart(2, "0")} Archives</div>
      </div>

      {games.map((game, index) => {
        const empty = game.shots.length === 0;
        const cover =
          (game.cover && game.shots.find((shot) => shot.id === game.cover)) || game.shots[0];

        return (
          <button
            key={game.id}
            type="button"
            className={`album-row${empty ? " empty" : ""}`}
            data-screen-label={`Album row - ${game.title}`}
            onClick={() => !empty && setHash(`/a/${encodeURIComponent(game.id)}`)}
            style={accentStyle(game.accent)}
            disabled={empty}
          >
            <div className="idx">{String(index + 1).padStart(2, "0")}</div>
            <div className="info">
              <div className="nm serif">{game.title}</div>
              <div className="sub">
                <span>{game.place}</span>
                <span className="dot" />
                <span>{game.year}</span>
                <span className="dot" />
                <span>{empty ? "No frames yet" : `${game.shots.length} Frames`}</span>
              </div>
            </div>
            {empty ? (
              <div className="soon">Coming soon</div>
            ) : (
              <div className="album-thumb">
                <img src={cover.displaySrc} alt={game.title} />
                <div className="open">
                  <span>Open</span>
                  <span>↗</span>
                </div>
              </div>
            )}
          </button>
        );
      })}

      <div className="site-foot">
        <p>© 2026 Oleg Krugliak</p>
        <div className="lks" aria-label="Archive metadata">
          <span>Archive in motion</span>
          <span>21:9 photography</span>
        </div>
      </div>
    </section>
  );
}

function AlbumView({
  game,
  shotIndex,
}: {
  game: GalleryGame;
  shotIndex: number | null;
}) {
  const [shown, setShown] = useState(false);
  const lightboxOpen = shotIndex !== null && game.shots.length > 0;

  useBodyLock(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !lightboxOpen) setHash("/");
    };
    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen]);

  return (
    <div className={`album-view${shown ? " in" : ""}`} data-screen-label={`Album - ${game.title}`}>
      <div className="av-top">
        <button className="av-back" type="button" onClick={() => setHash("/")}>
          <span className="ar">←</span>
          <span>Collections</span>
        </button>
        <div className="av-title">
          <div className="t serif">{game.full}</div>
          <div className="p">
            {game.place} · {game.year}
          </div>
        </div>
        <div className="av-count">
          {game.shots.length > 0 ? (
            <>
              <b>{String((shotIndex ?? 0) + 1).padStart(2, "0")}</b> /{" "}
              {String(game.shots.length).padStart(2, "0")}
            </>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>

      {game.shots.length > 0 ? (
        <Carousel3D
          shots={game.shots}
          accent={game.accent}
          keyboardEnabled={!lightboxOpen}
          onOpen={(index) => setHash(`/a/${encodeURIComponent(game.id)}/${index}`)}
        />
      ) : (
        <div className="av-empty">
          <div className="big serif">No frames archived yet</div>
          <p>This collection is being curated. New cinematic frames from {game.title} will appear here soon.</p>
          <button className="navbtn wide" type="button" onClick={() => setHash("/")}>
            Back to collections
          </button>
        </div>
      )}

      {lightboxOpen && (
        <Lightbox
          game={game}
          index={Math.max(0, Math.min(shotIndex, game.shots.length - 1))}
          onClose={() => setHash(`/a/${encodeURIComponent(game.id)}`)}
        />
      )}
    </div>
  );
}

function getPointerX(event: React.MouseEvent<Element> | TouchEvent<Element>) {
  if ("touches" in event) return event.touches[0]?.clientX ?? 0;
  return event.clientX;
}

function Carousel3D({
  shots,
  accent,
  keyboardEnabled,
  onOpen,
}: {
  shots: GalleryShot[];
  accent: string;
  keyboardEnabled: boolean;
  onOpen: (index: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    x: number;
    startPos: number;
    moved: boolean;
    lastT: number;
    vel: number;
    stoppedSpin: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const posRef = useRef(0);
  const velocity = useRef(0);
  const momentumRef = useRef<number | null>(null);
  const [dim, setDim] = useState({ w: 1200, h: 480 });
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const realCount = shots.length;
  const slotCount = realCount >= 6 ? realCount : realCount * Math.max(2, Math.ceil(7 / realCount));
  const step = 360 / slotCount;
  const cardWidth = Math.max(280, Math.min(1180, dim.w * 0.64, dim.h * 1.92));
  const cardHeight = (cardWidth * 9) / 21;
  const radius = cardWidth / 2 / Math.tan((step / 2) * Math.PI / 180);
  const rotation = pos * step;
  const frontSlot = ((Math.round(pos) % slotCount) + slotCount) % slotCount;
  const activeReal = frontSlot % realCount;

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const fit = () => setDim({ w: element.clientWidth, h: element.clientHeight });
    fit();

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(element);
    window.addEventListener("resize", fit);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const stopMomentum = useCallback(() => {
    if (momentumRef.current != null) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
    velocity.current = 0;
  }, []);

  // Доводим барабан до ближайшей карточки и возвращаем плавную CSS-анимацию.
  const settle = useCallback(() => {
    setSpinning(false);
    const target = Math.round(posRef.current);
    posRef.current = target;
    setPos(target);
  }, []);

  // Свободный ход по инерции: каждый кадр двигаем барабан и гасим скорость трением.
  // Скорость живёт в velocity.current, поэтому её можно подкручивать на лету (колесо, повторный бросок).
  const runMomentum = useCallback(() => {
    if (momentumRef.current != null) return;
    setSpinning(true);
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      posRef.current += velocity.current * dt;
      setPos(posRef.current);
      // Экспоненциальное трение: за секунду скорость падает примерно до 12%.
      velocity.current *= Math.pow(0.12, dt);

      if (Math.abs(velocity.current) < 0.5) {
        momentumRef.current = null;
        velocity.current = 0;
        settle();
        return;
      }
      momentumRef.current = requestAnimationFrame(tick);
    };

    momentumRef.current = requestAnimationFrame(tick);
  }, [settle]);

  // Толчок маховика: и бросок мышью, и щелчок колеса добавляют скорость в общий механизм инерции.
  const addSpin = useCallback(
    (dv: number) => {
      velocity.current = Math.max(-26, Math.min(26, velocity.current + dv));
      runMomentum();
    },
    [runMomentum]
  );

  useEffect(() => () => stopMomentum(), [stopMomentum]);

  useEffect(() => {
    if (!dragging) return;

    const sensitivity = Math.max(70, cardWidth * 0.42);
    const move = (event: MouseEvent | globalThis.TouchEvent) => {
      if (!drag.current) return;
      const x = "touches" in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
      const now = performance.now();
      const delta = x - drag.current.x;

      if (Math.abs(delta) > 4) drag.current.moved = true;
      const newPos = drag.current.startPos - delta / sensitivity;
      const dt = Math.max(0.001, (now - drag.current.lastT) / 1000);
      const instant = (newPos - posRef.current) / dt;
      // Сглаживаем скорость, чтобы «бросок» считался по последнему движению.
      drag.current.vel = drag.current.vel * 0.6 + instant * 0.4;
      drag.current.lastT = now;
      posRef.current = newPos;
      setPos(newPos);
    };
    const up = () => {
      setDragging(false);
      const info = drag.current;
      drag.current = null;
      suppressClick.current = Boolean(info?.moved || info?.stoppedSpin);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 60);

      const v = info?.vel ?? 0;
      // Резкий бросок — пускаем по инерции, плавное движение — просто доводим до карточки.
      if (Math.abs(v) > 1.4) addSpin(v);
      else settle();
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [cardWidth, dragging, settle, addSpin]);

  const go = useCallback(
    (direction: number) => {
      stopMomentum();
      setSpinning(false);
      const target = Math.round(posRef.current) + direction;
      posRef.current = target;
      setPos(target);
    },
    [stopMomentum]
  );

  useEffect(() => {
    if (!keyboardEnabled) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "Enter") onOpen(activeReal);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeReal, go, keyboardEnabled, onOpen]);

  const goToReal = (index: number) => {
    stopMomentum();
    setSpinning(false);
    const current = Math.round(posRef.current);
    let best = current;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let offset = -slotCount; offset <= slotCount; offset += 1) {
      const slot = current + offset;
      if ((((slot % slotCount) + slotCount) % slotCount) % realCount === index) {
        const distance = Math.abs(offset);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = slot;
        }
      }
    }

    posRef.current = best;
    setPos(best);
  };

  const onDown = (event: React.MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
    // Если барабан летел по инерции — это касание его останавливает (и не считается кликом).
    const wasSpinning = momentumRef.current != null;
    stopMomentum();
    const x = getPointerX(event);
    drag.current = {
      x,
      startPos: posRef.current,
      moved: false,
      lastT: performance.now(),
      vel: 0,
      stoppedSpin: wasSpinning,
    };
    setSpinning(true);
    setDragging(true);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(raw) < 1) return;

    // Колесо мыши шлёт «строки», трекпад — пиксели; приводим всё к пикселям.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? dim.h || 800 : 1;
    const px = raw * unit;
    // Прокрутка подкручивает тот же маховик, что и перетаскивание, — отсюда инерция и плавность.
    const impulse = Math.sign(px) * Math.min(3, Math.abs(px) / 48);
    addSpin(impulse);
  };

  const handleClick = (slot: number) => {
    if (suppressClick.current) return;
    if (slot === frontSlot) {
      onOpen(slot % realCount);
    } else {
      stopMomentum();
      setSpinning(false);
      posRef.current = slot;
      setPos(slot);
    }
  };

  return (
    <>
      <div
        ref={stageRef}
        className={`stage3d${dragging ? " drag" : ""}`}
        onMouseDown={onDown}
        onTouchStart={onDown}
        onWheel={onWheel}
        style={accentStyle(accent)}
      >
        <div
          className={`ring${spinning ? " dragging" : ""}`}
          style={{ transform: `translateZ(${-radius}px) rotateY(${-rotation}deg)` }}
        >
          {Array.from({ length: slotCount }, (_, slot) => {
            const shot = shots[slot % realCount];
            let face = slot * step - rotation;
            face = ((face % 360) + 540) % 360 - 180;

            const absFace = Math.abs(face);
            const isFront = slot === frontSlot;
            const scale = isFront ? 1.14 : 0.88;
            const opacity = absFace >= 92 ? 0 : 0.32 + 0.68 * Math.cos((face * Math.PI) / 180);

            return (
              <div
                key={slot}
                className={`card3d${isFront ? " active" : ""}`}
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  marginLeft: `${-cardWidth / 2}px`,
                  marginTop: `${-cardHeight / 2}px`,
                  transform: `rotateY(${slot * step}deg) translateZ(${radius}px) scale(${scale})`,
                  opacity,
                  filter: isFront ? "none" : "brightness(0.78)",
                  transition: spinning
                    ? "opacity .15s linear, transform .15s linear"
                    : "transform .55s var(--ease-soft), opacity .5s ease, filter .5s ease",
                  pointerEvents: absFace >= 80 ? "none" : "auto",
                  zIndex: isFront ? 10 : 1,
                }}
                onClick={() => handleClick(slot)}
              >
                <div className="shot">
                  <img src={shot.displaySrc} alt={shot.annotation} draggable="false" />
                  <span className="ix">{String((slot % realCount) + 1).padStart(2, "0")}</span>
                  <span className="openhint">View frame</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="av-hint">Drag to rotate · click frame to open</div>
      </div>

      <div className="av-caption">
        <p className="cap" key={activeReal}>
          {shots[activeReal]?.annotation}
        </p>
      </div>

      <div className="av-controls">
        <div className="dots">
          {shots.map((shot, index) => (
            <button
              key={shot.id}
              className={index === activeReal ? "on" : ""}
              type="button"
              onClick={() => goToReal(index)}
              aria-label={`Show frame ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function Lightbox({
  game,
  index,
  onClose,
}: {
  game: GalleryGame;
  index: number;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [offset, setOffset] = useState<{ dy: number } | null>(null);
  const drag = useRef<{ x0: number; y0: number; dx: number; dy: number } | null>(null);
  const shot = game.shots[index];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const close = useCallback(() => {
    setShown(false);
    window.setTimeout(onClose, 380);
  }, [onClose]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close]);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;

    drag.current = { x0: event.clientX, y0: event.clientY, dx: 0, dy: 0 };
    setOffset({ dy: 0 });
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;

    drag.current.dx = event.clientX - drag.current.x0;
    drag.current.dy = event.clientY - drag.current.y0;
    setOffset({ dy: drag.current.dy });
  };

  const onUp = () => {
    if (!drag.current) return;

    const { dx, dy } = drag.current;
    drag.current = null;
    setOffset(null);

    // Палец/курсор почти не двигался — это клик по кадру: сворачиваем обратно в барабан.
    const moved = Math.abs(dx) > 10 || Math.abs(dy) > 10;
    // Либо потянули кадр вниз — тоже закрываем.
    if (!moved || (dy > 90 && dy > Math.abs(dx))) close();
  };

  const dragStyle = offset
    ? {
        transform: `translateY(${Math.max(0, offset.dy) * 0.5}px) scale(${
          1 - Math.min(Math.max(0, offset.dy), 320) / 1600
        })`,
        transition: "none",
        opacity: 1 - Math.min(Math.max(0, offset.dy), 320) / 680,
      }
    : {};

  if (!shot) return null;

  return (
    <div className={`lightbox${shown ? " in" : ""}`} style={accentStyle(game.accent)}>
      <div className="lb-top">
        <div className="meta">{game.full}</div>
        <div className="lb-count">
          <b>{String(index + 1).padStart(2, "0")}</b> / {String(game.shots.length).padStart(2, "0")}
        </div>
        <button className="lb-close" type="button" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="lb-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <img className="lb-img" key={shot.id} src={shot.fullSrc} alt={shot.annotation} style={dragStyle} draggable="false" />
        <div className="lb-hint">Click frame to return to carousel</div>
      </div>

      <div className="lb-cap">
        <span className="c">{shot.annotation}</span>
      </div>
    </div>
  );
}

export default function GalleryExperience({ games }: { games: SourceGame[] }) {
  const galleryGames = useMemo(() => games.map(toGalleryGame), [games]);
  const route = useHashRoute();
  const albumGame =
    route.view === "album" ? galleryGames.find((game) => game.id === route.gameId) ?? null : null;
  const albumShotIndex = route.view === "album" ? route.shot : null;

  useEffect(() => {
    document.documentElement.dataset.grain = "on";
    document.documentElement.style.setProperty("--frame-radius", "10px");
  }, []);

  useEffect(() => {
    if (route.view === "album" && !albumGame) setHash("/");
  }, [albumGame, route.view]);

  return (
    <>
      <Preloader />
      <div className="chrome">
        <a
          className="wordmark"
          href="#/"
          onClick={() => {
            setHash("/");
          }}
        >
          <span className="gm serif">Game Gallery</span>
          <span className="tag">Archive</span>
        </a>
        <SoundToggle />
      </div>

      <main>
        <Hero games={galleryGames} />
        <Collections games={galleryGames} />
      </main>

      {albumGame && <AlbumView game={albumGame} shotIndex={albumShotIndex} />}
      <div className="grain" />
    </>
  );
}
