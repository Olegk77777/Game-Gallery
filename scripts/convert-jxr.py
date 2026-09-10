#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["imagecodecs", "numpy", "pillow"]
# ///
"""
HDR-скриншоты Windows (.jxr) → JPG для галереи, с плёночной передачей яркости.

Откуда .jxr: при включённом HDR оверлей NVIDIA (и Game Bar) сохраняет кадр в JPEG-XR —
32-битный float в линейном scRGB, где 1.0 = 80 нит. macOS, sips и ffmpeg его не читают.
Простое «сохранить как JPG» тут не годится: небо в сотни нит выгорает целиком.

Как конвертирует: яркость в нитах проходит через S-кривую, как у негатива с печатью.
Средние тона сочные, тени мягко уходят в черноту, самое яркое (солнце, лампы) может
слегка выгореть. Никакого «выравнивания» кадра, как в дешёвом HDR.
Тёмные ночные сцены приподнимаются на 1,5–3 ступени — как если бы фотограф открыл
выдержку, — но остаются ночными.

Имя чистится под галерею:
  «Kingdom Come  Deliverance II Screenshot 2026.09.08 - 20.30.00.65.jxr»
  → «Kingdom Come Deliverance II 2026.09.08 - 20.30.00.65.jpg»

Запуск из корня проекта (uv сам поставит зависимости):
  uv run scripts/convert-jxr.py ~/Downloads/Скриншоты/Сталкер --out "public/gallery/S.T.A.L.K.E.R. 2 Heart of Chornobyl"
  uv run scripts/convert-jxr.py кадр.jxr --ev 0.5      # на полступени светлее
Готовые JPG не перезаписываются; --force — перезаписать.
"""

import argparse
import re
import sys
from pathlib import Path

import imagecodecs
import numpy as np
from PIL import Image, ImageCms

# --- Настройки плёночной кривой ---
PAPER_WHITE = 203.0   # ниты «белого листа» (BT.2408); серое 18% = 0.18 от него
CONTRAST = 1.5        # крутизна кривой: больше — плотнее тени и сочнее цвет
WHITE_CLIP = 4.0      # чистый белый = 4 × белый лист ≈ 810 нит; всё ярче — пересвет
MID_GREY = 0.18       # серое 18% остаётся серым 18% (≈ 118 из 255)
NIGHT_BELOW = 5.0     # ниты: сцена со средней яркостью ниже этой — ночная
NIGHT_SHARE = 0.75    # какую долю нехватки света возмещаем (1.0 = как днём)
NIGHT_MAX_EV = 3.0    # потолок подъёма, ступеней
JPEG_QUALITY = 92

# Кривая x^a / (b·x^a + c): серое → серое, WHITE_CLIP → 1.0, у нуля — носок x^a
_A = CONTRAST
_B = (-MID_GREY**_A + WHITE_CLIP**_A * MID_GREY) / ((WHITE_CLIP**_A - MID_GREY**_A) * MID_GREY)
_C = (WHITE_CLIP**_A * MID_GREY**_A * (1 - MID_GREY)) / ((WHITE_CLIP**_A - MID_GREY**_A) * MID_GREY)


def film_curve(x):
    """Сцена (1.0 = белый лист) → яркость экрана 0..1.
    Каждый канал отдельно, как слои плёнки: яркие цвета у белой точки сами уходят в белое."""
    xa = np.power(np.maximum(x, 0.0), _A)
    return np.clip(xa / (_B * xa + _C), 0.0, 1.0)


def srgb_encode(x):
    """Линейный свет → гамма sRGB (0..1)."""
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def load_nits(path):
    """Читает .jxr и возвращает RGB в нитах (float32, H×W×3)."""
    img = imagecodecs.jpegxr_decode(path.read_bytes())
    if img.ndim != 3 or img.shape[2] < 3 or img.dtype.kind != "f":
        raise ValueError(f"неожиданный формат пикселей {img.shape} {img.dtype}, ждал HDR float RGB")
    # Отрицательные значения — цвета за пределами sRGB (широкий охват HDR); обрезаем
    return np.clip(img[..., :3].astype(np.float32), 0.0, None) * 80.0


def night_lift(nits):
    """Сколько ступеней добавить тёмной сцене (днём — 0) и средняя яркость кадра."""
    luma = nits @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    avg = float(np.exp(np.log(np.maximum(luma, 0.05)).mean()))  # среднее геометрическое
    if avg >= NIGHT_BELOW:
        return 0.0, avg
    return min(NIGHT_SHARE * float(np.log2(NIGHT_BELOW / avg)), NIGHT_MAX_EV), avg


def clean_name(stem):
    """Имя от NVIDIA → имя как в галерее: без «Screenshot» и двойных пробелов."""
    return re.sub(r"\s+", " ", re.sub(r"\bScreenshot\b", " ", stem)).strip()


def convert(src, out, ev_extra):
    """Конвертирует один кадр. Возвращает (подъём в EV, средняя яркость в нитах)."""
    nits = load_nits(src)
    ev, avg = night_lift(nits)
    ev += ev_extra
    display = srgb_encode(film_curve(nits / PAPER_WHITE * 2.0**ev))
    # Шум в полшага перед округлением до 8 бит — чтобы на гладком небе не было ступенек
    noise = np.random.default_rng(0).uniform(-0.5, 0.5, display.shape).astype(np.float32)
    rgb8 = np.clip(display * 255.0 + 0.5 + noise, 0, 255).astype(np.uint8)
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    Image.fromarray(rgb8).save(out, quality=JPEG_QUALITY, optimize=True, progressive=True, icc_profile=icc)
    return ev, avg


def collect(inputs):
    """Файлы .jxr из списка файлов и папок (папки — рекурсивно)."""
    files = []
    for item in inputs:
        p = Path(item).expanduser()
        if p.is_dir():
            files += [f for f in sorted(p.rglob("*")) if f.suffix.lower() == ".jxr"]
        elif p.is_file():
            files.append(p)
        else:
            print(f"❌ Не найдено: {p}")
    return files


def main():
    ap = argparse.ArgumentParser(description="HDR-скриншоты .jxr → JPG с плёночной кривой")
    ap.add_argument("inputs", nargs="+", help="файлы .jxr или папки с ними")
    ap.add_argument("--out", help="куда класть JPG (по умолчанию — рядом с исходником)")
    ap.add_argument("--ev", type=float, default=0.0, help="поправка экспозиции: +0.5 светлее, -0.5 темнее")
    ap.add_argument("--force", action="store_true", help="перезаписывать готовые JPG")
    args = ap.parse_args()

    files = collect(args.inputs)
    if not files:
        print("Нечего конвертировать: .jxr не найдены.")
        return 1

    failed = 0
    for src in files:
        out_dir = Path(args.out).expanduser() if args.out else src.parent
        out = out_dir / (clean_name(src.stem) + ".jpg")
        if out.exists() and not args.force:
            print(f"⏭️  Уже есть: {out.name}")
            continue
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            ev, avg = convert(src, out, args.ev)
            print(f"✅ {out.name}  ({out.stat().st_size / 1e6:.1f} МБ, средняя яркость {avg:.1f} нит, подъём {ev:+.1f} EV)")
        except Exception as e:
            failed += 1
            print(f"❌ {src.name}: {e}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
