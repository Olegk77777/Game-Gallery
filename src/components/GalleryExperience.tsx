"use client";

/* eslint-disable @next/next/no-img-element */

import type { CSSProperties, PointerEvent, TouchEvent, WheelEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const meta: Omit<GalleryGame, "id" | "shots"> = GAME_META[game.title] ?? {
    title: game.title,
    full: game.title,
    place: "Curated archive",
    year: 2026,
    accent: ["#e6a15c", "#cdd66b", "#e2c84b", "#bfa07a"][index % 4],
  };

  const shots = game.screenshots.map((shot) => {
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
  });

  // Кадр-обложку поднимаем в начало, чтобы барабан стартовал именно с него.
  if (meta.cover) {
    const coverIndex = shots.findIndex((shot) => shot.id === meta.cover);
    if (coverIndex > 0) {
      shots.unshift(shots.splice(coverIndex, 1)[0]);
    }
  }

  return {
    id: slugify(game.title, `game-${index + 1}`),
    ...meta,
    shots,
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

// Уважаем системную настройку «уменьшить движение»: при ней отключаем
// курсорные эффекты (CSS-анимации глушит глобальный @media-блок).
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);

    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

// Указатель есть только на десктопе (мышь/трекпад). На тач-экранах курсорные
// эффекты не имеют смысла и просто тратят ресурсы — там их не включаем.
function hasFinePointer() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}

// Синхронная проверка «уменьшить движение» — для эффектов, решение по которым
// нужно принять прямо в момент монтирования (хук обновляет state только в effect).
function prefersReducedMotionNow() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Прямоугольник реально видим на экране и пригоден для морфа (не нулевой, в кадре).
function rectUsable(r: DOMRect | null | undefined): r is DOMRect {
  return (
    !!r &&
    r.width > 4 &&
    r.height > 4 &&
    r.right > 0 &&
    r.bottom > 0 &&
    r.left < window.innerWidth &&
    r.top < window.innerHeight
  );
}

// FLIP-инверсия: трансформ, который визуально кладёт элемент `to` поверх `from`.
// Анимируем ТОЛЬКО transform (translate+scale) — это работа композитора, без пейнта.
function flipInvert(from: DOMRect, to: DOMRect) {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = from.width / to.width;
  return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`;
}

const PUSH_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

// Разные траектории «дрейфа» (Ken Burns) для кадров шапки — чтобы каждый кадр
// жил по-своему: своя точка отсчёта масштаба и направление сдвига.
const HERO_KB: { x: string; y: string; o: string }[] = [
  { x: "2.4%", y: "-1.6%", o: "30% 35%" },
  { x: "-2.6%", y: "1.4%", o: "70% 40%" },
  { x: "1.8%", y: "2.2%", o: "42% 70%" },
  { x: "-1.8%", y: "-2.2%", o: "64% 64%" },
  { x: "2.8%", y: "1%", o: "32% 62%" },
  { x: "-2.4%", y: "-1.2%", o: "62% 30%" },
];

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
  const heroRef = useRef<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const baseFeatured = useMemo(
    () =>
      games
        .flatMap((game) => game.shots.slice(0, 2).map((shot) => ({ game, shot })))
        .slice(0, 6),
    [games]
  );
  // Порядок кадров в шапке. На сервере (статический экспорт) — детерминированный,
  // иначе будет рассинхрон гидрации. Перемешиваем уже на клиенте, в useEffect ниже.
  const [featured, setFeatured] = useState(baseFeatured);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);
  const current = featured[active] ?? featured[0];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // После загрузки тасуем кадры (Фишер–Йейтс), чтобы каждый раз был свой порядок.
  // setState откладываем в rAF — тот же приём, что и для setShown выше.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const shuffled = [...baseFeatured];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setFeatured(shuffled);
      setActive(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [baseFeatured]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % featured.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [featured.length]);

  // Параллакс по курсору: фон шапки мягко смещается вслед за мышью, создавая
  // глубину «окна в мир игры». Двигаем только CSS-переменные (--px/--py) раз в
  // кадр через requestAnimationFrame — браузер сам сглаживает сдвиг CSS-переходом,
  // поэтому это композитная анимация без перерасчёта вёрстки.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || reduced || !hasFinePointer()) return;

    let frame = 0;
    let cx = 0;
    let cy = 0;

    const apply = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const nx = (cx - rect.left) / rect.width - 0.5;
      const ny = (cy - rect.top) / rect.height - 0.5;
      el.style.setProperty("--px", `${(nx * 36).toFixed(2)}px`);
      el.style.setProperty("--py", `${(ny * 24).toFixed(2)}px`);
    };
    const onMove = (event: MouseEvent) => {
      cx = event.clientX;
      cy = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0px");
      el.style.setProperty("--py", "0px");
    };

    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("mouseleave", onLeave);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [reduced]);

  return (
    <section ref={heroRef} className={`hero${shown ? " shown" : ""}`} data-screen-label="Hero">
      <div className="hero-media">
        {featured.map((item, index) => {
          const kb = HERO_KB[index % HERO_KB.length];

          return (
            <img
              key={`${item.game.id}-${item.shot.id}`}
              className={`frame-img${index === active ? " on" : ""}`}
              src={item.shot.fullSrc}
              alt=""
              style={
                {
                  "--kb-x": kb.x,
                  "--kb-y": kb.y,
                  "--kb-origin": kb.o,
                  animationDelay: `${(-index * 4.3).toFixed(1)}s`,
                } as CSSProperties
              }
            />
          );
        })}
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
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  // Эти классы держим в state, чтобы className оставался единственным источником
  // правды (перерендер не сотрёт классы, которые иначе пришлось бы ставить вручную).
  const [ready, setReady] = useState(false);
  const [spotOn, setSpotOn] = useState(false);

  // Хореография появления: строки альбомов всплывают по очереди, когда входят в
  // экран. Класс is-ready включает стартовое «спрятанное» состояние только когда
  // JS реально готов его раскрыть (без JS контент виден как обычно). Сам класс in
  // навешиваем на строки напрямую — их className-проп постоянен, перерендер не трогает.
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduced) {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }

    const raf = window.requestAnimationFrame(() => setReady(true));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    targets.forEach((el) => io.observe(el));
    return () => {
      window.cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [reduced, games.length]);

  // Пятно света за курсором: композитная анимация (двигаем элемент через
  // transform по CSS-переменным), репейнта вёрстки нет.
  useEffect(() => {
    const root = sectionRef.current;
    if (!root || reduced || !hasFinePointer()) return;

    let frame = 0;
    let cx = 0;
    let cy = 0;

    const apply = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      root.style.setProperty("--mx", `${(cx - rect.left).toFixed(1)}px`);
      root.style.setProperty("--my", `${(cy - rect.top).toFixed(1)}px`);
    };
    const onMove = (event: MouseEvent) => {
      cx = event.clientX;
      cy = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    root.addEventListener("mousemove", onMove, { passive: true });
    const raf = window.requestAnimationFrame(() => setSpotOn(true));

    return () => {
      window.cancelAnimationFrame(raf);
      if (frame) window.cancelAnimationFrame(frame);
      root.removeEventListener("mousemove", onMove);
      setSpotOn(false);
    };
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className={`collections${ready ? " is-ready" : ""}${spotOn ? " spot" : ""}`}
      id="collections"
      data-screen-label="Collections"
    >
      <div className="spotlight" aria-hidden="true" />
      <div className="sec-head" data-reveal>
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
            data-reveal
            onClick={() => !empty && setHash(`/a/${encodeURIComponent(game.id)}`)}
            style={{ ...accentStyle(game.accent), transitionDelay: `${(index * 0.05).toFixed(2)}s` }}
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

      <div className="site-foot" data-reveal>
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
  // Прямоугольник карты, из которой открыли кадр — источник «наезда камеры».
  // Живёт в AlbumView, т.к. Carousel3D (пишет) и Lightbox (читает) — соседи.
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);

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
          onOpen={(index, rect) => {
            setOriginRect(rect ?? null);
            setHash(`/a/${encodeURIComponent(game.id)}/${index}`);
          }}
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
          originRect={originRect}
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
  onOpen: (index: number, originRect?: DOMRect | null) => void;
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
  const reduced = usePrefersReducedMotion();

  // Скоростное свечение барабана: чем быстрее крутится, тем ярче ореол в цвет
  // альбома (CSS-переменная --spin, 0..1). Гаснет, когда барабан останавливается.
  const setSpin = useCallback(
    (raw: number) => {
      const el = stageRef.current;
      if (!el) return;
      el.style.setProperty("--spin", reduced ? "0" : Math.min(1, Math.abs(raw) / 16).toFixed(3));
    },
    [reduced]
  );

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
    setSpin(0);
    const target = Math.round(posRef.current);
    posRef.current = target;
    setPos(target);
  }, [setSpin]);

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
      setSpin(velocity.current);

      if (Math.abs(velocity.current) < 0.5) {
        momentumRef.current = null;
        velocity.current = 0;
        settle();
        return;
      }
      momentumRef.current = requestAnimationFrame(tick);
    };

    momentumRef.current = requestAnimationFrame(tick);
  }, [settle, setSpin]);

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
      setSpin(drag.current.vel);
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
  }, [cardWidth, dragging, settle, addSpin, setSpin]);

  const go = useCallback(
    (direction: number) => {
      stopMomentum();
      setSpinning(false);
      setSpin(0);
      const target = Math.round(posRef.current) + direction;
      posRef.current = target;
      setPos(target);
    },
    [stopMomentum, setSpin]
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

    // Колесо мыши (дискретные «щелчки»: режим строк/страниц или крупный пиксельный шаг)
    // двигает ровно на одну карточку за щелчок — реагирует с первого щелчка и не
    // проскакивает пачками. Мелкий пиксельный поток (трекпад) — плавная инерция.
    if (event.deltaMode !== 0 || Math.abs(px) >= 40) {
      go(Math.sign(px));
      return;
    }

    const impulse = Math.sign(px) * Math.min(3, Math.abs(px) / 48);
    addSpin(impulse);
  };

  const handleClick = (slot: number) => {
    if (suppressClick.current) return;
    if (slot === frontSlot) {
      // Замеряем живой прямоугольник кликнутой (активной) карты — отсюда «вылетит»
      // кадр в полный экран (FLIP-морф в лайтбоксе). Если не нашли — лайтбокс
      // откроется обычным способом.
      const cardImg = stageRef.current?.querySelector<HTMLImageElement>(".card3d.active .shot img");
      onOpen(slot % realCount, cardImg?.getBoundingClientRect() ?? null);
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
                  <span className="gloss" aria-hidden="true" />
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
  originRect,
  onClose,
}: {
  game: GalleryGame;
  index: number;
  originRect: DOMRect | null;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [offset, setOffset] = useState<{ dy: number } | null>(null);
  // morphStyle — инлайн-трансформ кадра во время «наезда»/«отъезда» камеры (FLIP).
  // Пока он не null, он полностью владеет transform/opacity картинки (перебивает CSS).
  const [morphStyle, setMorphStyle] = useState<CSSProperties | null>(null);
  // armed — drag-to-close включается только ПОСЛЕ входного наезда, чтобы жесты не столкнулись.
  const [armed, setArmed] = useState(false);
  const [src, setSrc] = useState(game.shots[index]?.displaySrc ?? "");
  const drag = useRef<{ x0: number; y0: number; dx: number; dy: number } | null>(null);
  const lbImgRef = useRef<HTMLImageElement | null>(null);
  const originCaptured = useRef(originRect);
  const closing = useRef(false);
  const shot = game.shots[index];

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // ВХОД: «наезд камеры». Кадр стартует ровно поверх кликнутой карты барабана и
  // доезжает до полноэкранного положения. Анимируется только transform (композитно).
  useLayoutEffect(() => {
    const img = lbImgRef.current;
    const from = originCaptured.current;

    // Нет карты-источника / она за кадром / включён reduced-motion → без морфа:
    // лайтбокс открывается обычным CSS-появлением (scale .86 → 1).
    if (!img || !rectUsable(from) || prefersReducedMotionNow()) {
      const id = window.requestAnimationFrame(() => setArmed(true));
      return () => window.cancelAnimationFrame(id);
    }

    const node = img; // не-null после guard; держим в локали для замыканий
    // База даёт `.lb-img { transform: scale(0.86) }` — снимаем его, чтобы померить
    // ИСТИННЫЙ конечный прямоугольник (scale 1). Делаем это до пейнта, в layout-effect.
    node.style.transform = "none";
    const to = node.getBoundingClientRect();
    // INVERT: ставим кадр на место карты (мгновенно, без перехода).
    setMorphStyle({ transform: flipInvert(from, to), opacity: 1, transition: "none", willChange: "transform" });

    let raf1 = 0;
    let raf2 = 0;
    let timer = 0;

    function finish() {
      window.clearTimeout(timer);
      node.removeEventListener("transitionend", onEnd);
      setMorphStyle(null);
      setArmed(true);
    }
    function onEnd(event: TransitionEvent) {
      if (event.propertyName === "transform") finish();
    }

    // PLAY: следующим кадром снимаем трансформ → CSS-переход проигрывает наезд.
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setMorphStyle({ transform: "none", opacity: 1, transition: `transform 0.52s ${PUSH_EASE}`, willChange: "transform" });
        node.addEventListener("transitionend", onEnd);
        timer = window.setTimeout(finish, 640); // фолбэк: transitionend может не сработать
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
      node.removeEventListener("transitionend", onEnd);
    };
    // Запуск один раз на монтировании (originRect/shot фиксируются на маунте).
  }, []);

  // Тяжёлый оригинал грузим ТОЛЬКО после того, как наезд осел, и через decode() —
  // чтобы декод 2560px/4K не дёргал кадр анимации на слабых устройствах.
  useEffect(() => {
    if (!armed || !shot || src === shot.fullSrc) return;
    let cancelled = false;
    const apply = () => {
      if (!cancelled) setSrc(shot.fullSrc);
    };
    const hi = new Image();
    hi.src = shot.fullSrc;
    if (hi.decode) hi.decode().then(apply).catch(apply);
    else {
      hi.onload = apply;
      if (hi.complete) apply();
    }
    return () => {
      cancelled = true;
    };
  }, [armed, shot, src]);

  // ВЫХОД: по клику/Esc/крестику кадр «отъезжает» обратно в свой слот барабана.
  // Свайп вниз (viaDrag) закрывает прежним мягким сворачиванием — не морфим, чтобы
  // жест перетаскивания не конфликтовал с обратным наездом.
  const close = useCallback(
    (viaDrag: boolean) => {
      if (closing.current) return;
      closing.current = true;

      const img = lbImgRef.current;
      const target = document
        .querySelector<HTMLImageElement>(".card3d.active .shot img")
        ?.getBoundingClientRect();

      if (viaDrag || !img || !rectUsable(target) || prefersReducedMotionNow()) {
        setShown(false);
        window.setTimeout(onClose, 380);
        return;
      }

      const node = img; // не-null после guard; держим в локали для замыканий
      setShown(false); // затемнение уходит, барабан проступает
      const fromRect = node.getBoundingClientRect();
      setMorphStyle({ transform: "none", opacity: 1, transition: "none", willChange: "transform" });

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setMorphStyle({
            transform: flipInvert(target, fromRect),
            opacity: 0,
            transition: `transform 0.46s ${PUSH_EASE}, opacity 0.46s ease`,
            willChange: "transform",
          });
        });
      });

      const done = () => {
        node.removeEventListener("transitionend", done);
        onClose();
      };
      node.addEventListener("transitionend", done);
      window.setTimeout(done, 560);
    },
    [onClose]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close]);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!armed || closing.current) return; // во время наезда жесты не ловим
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

    const moved = Math.abs(dx) > 10 || Math.abs(dy) > 10;
    // Клик по кадру → обратный наезд. Свайп вниз → мягкое сворачивание.
    if (!moved) close(false);
    else if (dy > 90 && dy > Math.abs(dx)) close(true);
  };

  const dragStyle: CSSProperties = offset
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
    <div className={`lightbox${shown ? " in" : ""}${morphStyle ? " morphing" : ""}`} style={accentStyle(game.accent)}>
      <div className="lb-top">
        <div className="meta">{game.full}</div>
        <div className="lb-count">
          <b>{String(index + 1).padStart(2, "0")}</b> / {String(game.shots.length).padStart(2, "0")}
        </div>
        <button className="lb-close" type="button" onClick={() => close(false)} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="lb-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <img
          className="lb-img"
          key={shot.id}
          ref={lbImgRef}
          src={src}
          alt={shot.annotation}
          style={morphStyle ?? dragStyle}
          draggable="false"
        />
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
