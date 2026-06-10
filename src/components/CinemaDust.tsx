"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";

/**
 * Пыль киносвета (Layer 2 луча проектора).
 *
 * WebGL-слой поверх hero: объёмная пыль плывёт в луче проектора — мелкие пылинки,
 * мерцающие искры и крупные расфокусированные «боке»-диски на разной глубине.
 * Пыль тонируется в акцент текущего альбома, «дышит» в такт лучу, расступается
 * и завихряется от курсора (на таче — от пальца), а раз в ~полминуты по лучу
 * проскальзывает «царапина плёнки» — быстрый световой штрих.
 *
 * Дешевизна по построению:
 *  - один draw call (Points + кастомный шейдер), вся анимация — в вершинном шейдере;
 *  - буферы аллоцируются один раз, в rAF-цикле нет ни одной аллокации;
 *  - DPR cap, число частиц по устройству, пауза вне вьюпорта/вкладки/под альбомом;
 *  - при reduced-motion компонент вообще не монтируется (решает Hero),
 *    при провале WebGL тихо отключается — сайт выглядит как раньше.
 */

type DustProps = {
  accent: string; // акцент текущего альбома (как --beam у луча)
  paused: boolean; // true, когда hero перекрыт альбомом/лайтбоксом
  pulse: number; // индекс активного кадра hero: смена → импульс «прокрутки бобины»
};

// Геометрия повторяет .hero-beam-shaft: клин с центром на 61% ширины / 50% высоты,
// наклонённый на -22°. Пыль живёт в «слябе» луча: u — поперёк, v — вдоль, depth — глубина.
const BEAM_ANGLE = (-22 * Math.PI) / 180;

const VERT = /* glsl */ `
  uniform vec2 uCenter;
  uniform vec2 uAxis;
  uniform vec2 uCrossDir;
  uniform float uHalfW;
  uniform float uHalfL;
  uniform float uTime;
  uniform float uDpr;
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uPush;
  uniform vec2 uPar;
  uniform float uFlow;
  uniform float uSizeScale;
  attribute vec4 aData; // size(px), baseAlpha, phase(0..1), speed(циклов/с)
  varying float vAlpha;
  varying float vSoft;

  void main() {
    float depth = position.z;
    // Дрейф вдоль луча (свет «сыплется» вниз), цикл зациклен через fract.
    // uFlow — добавочное «время» от импульса бобины при смене кадра hero.
    float cyc = fract(position.y + (uTime + uFlow) * aData.w);
    // Поперечное блуждание — у каждой пылинки своя фаза и частота.
    float wob = sin(uTime * (0.10 + 0.16 * fract(aData.z * 7.31)) + aData.z * 6.2831);
    float u = clamp(position.x + wob * (0.04 + 0.09 * depth), -1.0, 1.0);
    float v = cyc * 2.0 - 1.0;

    vec2 world = uCenter + uCrossDir * (u * uHalfW) + uAxis * (v * uHalfL);
    // Параллакс по глубине: ближние пылинки едут за курсором сильнее дальних.
    world += uPar * (depth - 0.5);

    // «Прикосновение к свету»: в радиусе курсора пыль мягко расталкивается
    // и слегка завихряется (перпендикулярная составляющая).
    vec2 d = world - uMouse;
    float dist = length(d) + 1e-4;
    float fall = 1.0 - smoothstep(0.0, uRadius, dist);
    fall *= fall;
    vec2 dir = d / dist;
    world += (dir + vec2(-dir.y, dir.x) * 0.6) * fall * uPush * (0.45 + 0.9 * depth);

    // Яркость: поперечный градиент луча × продольная маска (как у CSS-клина) × мерцание.
    float across = 1.0 - u * u;
    float along = smoothstep(0.0, 0.16, cyc) * (1.0 - smoothstep(0.64, 1.0, cyc));
    float tw = 0.72 + 0.28 * sin(uTime * (0.6 + depth * 1.1) + aData.z * 6.2831);
    vAlpha = aData.y * across * along * tw;
    vSoft = depth;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
    gl_PointSize = aData.x * uDpr * uSizeScale * (0.72 + 0.72 * depth);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uGlobal;
  varying float vAlpha;
  varying float vSoft;

  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = length(q) * 2.0;
    // Мягкий диск; у «боке» (vSoft → 1) сердцевина шире и край мягче.
    float disk = 1.0 - smoothstep(mix(0.12, 0.6, vSoft), 1.0, r);
    // «Ободок линзы»: у расфокусированных дисков тонкое кольцо у края — сигнатура кинооптики.
    float ring = smoothstep(0.55, 0.82, r) * (1.0 - smoothstep(0.82, 1.0, r));
    float a = (disk + ring * vSoft * 0.5) * vAlpha * uGlobal;
    if (a < 0.004) discard;
    // Искры в фокусе слегка выбелены в ядре — «пересвет» острых пылинок.
    vec3 col = mix(uColor, vec3(1.0), (1.0 - vSoft) * 0.35 * disk);
    gl_FragColor = vec4(col, a);
  }
`;

// Число частиц по устройству: ширина экрана + память/ядра как сигнал слабого железа.
function particleBudget(width: number) {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const weak = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
  const base = width >= 1100 ? 1600 : width >= 720 ? 850 : 460;
  return weak ? Math.round(base * 0.6) : base;
}

function randIn(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function CinemaDust({ accent, paused, pulse }: DustProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const accentRef = useRef(accent);
  const controlsRef = useRef<{ setPaused: (value: boolean) => void; kick: () => void } | null>(null);
  accentRef.current = accent;

  // Сцена строится один раз на монтирование; пропсы доезжают через refs,
  // чтобы перерендеры Hero (смена кадра каждые 6.5с) не пересоздавали WebGL.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      // failIfMajorPerformanceCaveat: на софтверном рендере (без GPU) не запускаемся.
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: true,
      });
    } catch {
      return; // нет нормального WebGL — сайт просто живёт без пыли
    }

    // Старые мобильные GPU умеют рисовать точки лишь до N px — ужимаем размеры под лимит.
    const gl = renderer.getContext();
    const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    const sizeScale = Math.min(1, (pointRange?.[1] ?? 64) / 34);

    const scene = new Scene();
    const camera = new OrthographicCamera(0, 1, 0, 1, -10, 10); // пиксели hero, y вниз — как в CSS

    // --- Частицы -------------------------------------------------------------
    const count = particleBudget(host.clientWidth || window.innerWidth);
    const positions = new Float32Array(count * 3); // x: u поперёк, y: фаза цикла вдоль, z: глубина
    const data = new Float32Array(count * 4); // размер, альфа, фаза, скорость

    for (let i = 0; i < count; i += 1) {
      const kind = Math.random();
      let depth: number;
      let size: number;
      let alpha: number;

      if (kind < 0.62) {
        // мелкая пыль — дальний план
        depth = randIn(0, 0.55);
        size = randIn(1.2, 2.8);
        alpha = randIn(0.32, 0.5);
      } else if (kind < 0.9) {
        // средние мерцающие пылинки
        depth = randIn(0.35, 0.8);
        size = randIn(2.8, 4.6);
        alpha = randIn(0.22, 0.36);
      } else {
        // крупные расфокусированные «боке» у самой камеры
        depth = randIn(0.68, 1);
        size = randIn(7, 15);
        alpha = randIn(0.09, 0.17);
      }

      // ~12% пылинок медленно всплывают против луча — живее, чем единый поток.
      const dir = Math.random() < 0.12 ? -1 : 1;
      const speed = dir * randIn(0.004, 0.011) * (1 - 0.45 * depth);

      positions[i * 3] = randIn(-1, 1);
      positions[i * 3 + 1] = Math.random();
      positions[i * 3 + 2] = depth;
      data[i * 4] = size;
      data[i * 4 + 1] = alpha;
      data[i * 4 + 2] = Math.random();
      data[i * 4 + 3] = speed;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("aData", new BufferAttribute(data, 4));

    const uniforms = {
      uCenter: { value: new Vector2() },
      uAxis: { value: new Vector2(Math.sin(-BEAM_ANGLE), Math.cos(BEAM_ANGLE)) },
      uCrossDir: { value: new Vector2(Math.cos(BEAM_ANGLE), Math.sin(BEAM_ANGLE)) },
      uHalfW: { value: 1 },
      uHalfL: { value: 1 },
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uMouse: { value: new Vector2(-99999, -99999) },
      uRadius: { value: 150 },
      uPush: { value: 0 },
      uPar: { value: new Vector2() },
      uFlow: { value: 0 },
      uSizeScale: { value: sizeScale },
      uColor: { value: new Color(accentRef.current) },
      uGlobal: { value: 0 },
    };

    const material = new ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // --- «Царапина плёнки»: редкий быстрый штрих света вдоль луча -------------
    const scratchGeometry = new BufferGeometry();
    const scratchPositions = new Float32Array(6);
    scratchGeometry.setAttribute("position", new BufferAttribute(scratchPositions, 3));
    const scratchMaterial = new LineBasicMaterial({
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const scratch = new Line(scratchGeometry, scratchMaterial);
    scratch.frustumCulled = false;
    scratch.visible = false;
    scene.add(scratch);

    let scratchWait = randIn(8, 16); // первая — пораньше, дальше раз в 20–40с
    let scratchProgress = -1; // <0 — неактивна
    let scratchU = 0;

    // --- Размеры и геометрия луча ---------------------------------------------
    let pushPx = 32;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w >= 1100 ? 1.5 : 1.25));
      renderer.setSize(w, h, false);
      camera.right = w;
      camera.bottom = h;
      camera.updateProjectionMatrix();

      uniforms.uCenter.value.set(w * 0.61, h * 0.5);
      uniforms.uHalfW.value = w * 0.17 * 1.3; // чуть шире клина — мягкие края
      uniforms.uHalfL.value = h * 0.84 * 1.05;
      uniforms.uRadius.value = Math.min(190, Math.max(110, w * 0.12));
      uniforms.uDpr.value = renderer.getPixelRatio();
      pushPx = Math.min(46, Math.max(24, w * 0.03));
    };

    resize();
    host.appendChild(renderer.domElement);

    // --- Курсор/тач: позиция и «сила прикосновения» ----------------------------
    const heroEl = (host.closest(".hero") as HTMLElement | null) ?? host;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const mouseTarget = new Vector2(-99999, -99999);
    const parTarget = new Vector2();
    let lastMoveAt = -1e9;
    let push = 0;

    // Сырые координаты складываем в буфер, а layout-чтение (getBoundingClientRect)
    // делаем не чаще раза в кадр уже в tick — тот же приём, что у параллакса hero.
    const pointerRaw = { x: 0, y: 0, fresh: false };
    const onPointerMove = (event: PointerEvent) => {
      pointerRaw.x = event.clientX;
      pointerRaw.y = event.clientY;
      pointerRaw.fresh = true;
      lastMoveAt = performance.now();
    };
    const onPointerLeave = () => {
      mouseTarget.set(-99999, -99999);
      parTarget.set(0, 0);
    };

    heroEl.addEventListener("pointermove", onPointerMove, { passive: true });
    heroEl.addEventListener("pointerdown", onPointerMove, { passive: true }); // тап — пульс в точке касания
    heroEl.addEventListener("pointerleave", onPointerLeave);

    // --- Цикл анимации ----------------------------------------------------------
    const targetColor = new Color(accentRef.current);
    let lastAccent = accentRef.current;
    let time = 0;
    let mounted = 0; // плавное проявление пыли после монтирования
    let last = 0;
    let raf = 0;
    let surge = 0; // импульс «прокрутки бобины» при смене кадра hero
    let flow = 0; // накопленное добавочное «время» дрейфа от импульсов
    let slowFrames = 0; // FPS-страховка: на стабильно слабом железе срезаем частицы
    let drawCount = count;
    let firstRender = true;

    // Состояние «можно ли крутить кадры»: всё в локальных флагах + один синк.
    let disposed = false;
    let contextOk = true;
    let visible = true;
    let hidden = document.hidden;
    let pausedFlag = paused;

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      mounted = Math.min(1, mounted + dt / 2.6);

      // Перевод сырых координат указателя в систему canvas — раз в кадр, не на событие.
      if (pointerRaw.fresh) {
        pointerRaw.fresh = false;
        const rect = host.getBoundingClientRect();
        mouseTarget.set(pointerRaw.x - rect.left, pointerRaw.y - rect.top);
        if (finePointer) {
          parTarget.set(
            ((pointerRaw.x - rect.left) / rect.width - 0.5) * 34,
            ((pointerRaw.y - rect.top) / rect.height - 0.5) * 22
          );
        }
      }

      // Плавная доводка курсора, силы толчка и параллакса (без аллокаций).
      const k = 1 - Math.exp(-dt * 9);
      uniforms.uMouse.value.lerp(mouseTarget, k);
      uniforms.uPar.value.lerp(parTarget, 1 - Math.exp(-dt * 4));
      const pushTarget = now - lastMoveAt < 160 ? 1 : finePointer ? 0.3 : 0;
      push += (pushTarget - push) * (1 - Math.exp(-dt * 3.5));
      uniforms.uPush.value = push * pushPx;

      // Импульс бобины: на смене кадра hero пыль на ~1.5с ускоряет течение вдоль луча.
      surge *= Math.exp(-dt * 1.8);
      flow += dt * surge * 7;
      uniforms.uFlow.value = flow;

      // Тонировка в акцент альбома — лерп как у CSS-переменной --beam (~1.2с).
      if (accentRef.current !== lastAccent) {
        lastAccent = accentRef.current;
        targetColor.set(lastAccent);
      }
      uniforms.uColor.value.lerp(targetColor, 1 - Math.exp(-dt * 2.5));

      // «Дыхание» пыли — тот же 14-секундный ритм, что у луча. Фаза — от абсолютных
      // часов страницы (performance.now), чтобы примерно совпадать с CSS beam-breathe.
      const ease = mounted * mounted * (3 - 2 * mounted);
      const breathe = 0.5 + 0.14 * Math.sin(((now / 1000) * Math.PI * 2) / 14);
      uniforms.uGlobal.value = ease * breathe * (1 + surge * 0.15);
      uniforms.uTime.value = time;

      // Царапина плёнки: штрих длиной ~12% луча проносится сверху вниз за полсекунды.
      if (scratchProgress >= 0) {
        scratchProgress += dt / 0.55;
        if (scratchProgress >= 1) {
          scratchProgress = -1;
          scratch.visible = false;
          scratchWait = randIn(20, 40);
        } else {
          const head = -0.75 + scratchProgress * 1.6;
          const cx = uniforms.uCenter.value;
          const ax = uniforms.uAxis.value;
          const cr = uniforms.uCrossDir.value;
          const halfW = uniforms.uHalfW.value;
          const halfL = uniforms.uHalfL.value;
          scratchPositions[0] = cx.x + cr.x * scratchU * halfW + ax.x * head * halfL;
          scratchPositions[1] = cx.y + cr.y * scratchU * halfW + ax.y * head * halfL;
          scratchPositions[3] = cx.x + cr.x * scratchU * halfW + ax.x * (head - 0.12) * halfL;
          scratchPositions[4] = cx.y + cr.y * scratchU * halfW + ax.y * (head - 0.12) * halfL;
          scratchGeometry.attributes.position.needsUpdate = true;
          scratchMaterial.opacity = Math.sin(Math.PI * scratchProgress) * 0.16 * ease;
        }
      } else {
        scratchWait -= dt;
        if (scratchWait <= 0) {
          scratchProgress = 0;
          scratchU = randIn(-0.5, 0.5);
          scratchMaterial.color.copy(uniforms.uColor.value);
          scratch.visible = true;
        }
      }

      // FPS-страховка: стабильно <25fps (это не 30fps-троттлинг iOS) → одноразово
      // вдвое срезаем частицы, при повторе — ещё вдвое. Дальше не трогаем.
      if (dt > 0.04) slowFrames += 1;
      else slowFrames = Math.max(0, slowFrames - 2);
      if (slowFrames >= 90 && drawCount > count / 4) {
        slowFrames = 0;
        drawCount = Math.floor(drawCount / 2);
        geometry.setDrawRange(0, drawCount);
      }

      // Первый кадр — под страховкой: если шейдер не соберётся на экзотическом
      // драйвере, глушим слой, а не роняем исключение в каждом кадре rAF.
      if (firstRender) {
        firstRender = false;
        try {
          renderer.render(scene, camera);
        } catch {
          contextOk = false;
          canvas.style.display = "none";
          syncRun();
          return;
        }
      } else {
        renderer.render(scene, camera);
      }
      syncRun();
    };

    const syncRun = () => {
      const should = !disposed && contextOk && visible && !hidden && !pausedFlag;
      if (should && !raf) {
        last = performance.now();
        raf = window.requestAnimationFrame(tick);
      } else if (!should && raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    controlsRef.current = {
      setPaused: (value: boolean) => {
        pausedFlag = value;
        syncRun();
      },
      kick: () => {
        surge = 1;
      },
    };

    // Пауза, когда hero не на экране (проскроллили к коллекциям) или вкладка скрыта.
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      syncRun();
    });
    io.observe(host);

    const onVisibility = () => {
      hidden = document.hidden;
      syncRun();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    // Потеря WebGL-контекста (мобильные так сбрасывают GPU-память) — пауза и возврат.
    const canvas = renderer.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextOk = false;
      syncRun();
    };
    const onContextRestored = () => {
      contextOk = true;
      syncRun();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    syncRun();

    return () => {
      disposed = true;
      syncRun();
      controlsRef.current = null;
      io.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      heroEl.removeEventListener("pointermove", onPointerMove);
      heroEl.removeEventListener("pointerdown", onPointerMove);
      heroEl.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      geometry.dispose();
      material.dispose();
      scratchGeometry.dispose();
      scratchMaterial.dispose();
      renderer.dispose();
      canvas.remove();
    };
    // Монтирование один раз; paused доезжает через controlsRef (эффект ниже).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controlsRef.current?.setPaused(paused);
  }, [paused]);

  // Смена кадра hero (каждые 6.5с или клик по точкам) — «прокрутка бобины».
  // Первый прогон эффекта — это маунт, а не смена кадра: импульс не даём.
  const firstPulse = useRef(true);
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    controlsRef.current?.kick();
  }, [pulse]);

  return <div ref={hostRef} className="hero-dust" aria-hidden="true" />;
}
