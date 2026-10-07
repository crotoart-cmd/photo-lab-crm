#!/usr/bin/env python3
"""Sinh icon iOS + logo nền trắng từ nuoc-leo-logo.png gốc."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/public/nuoc-leo-logo.png"
ARCHIVE = ROOT / "frontend/public/nuoc-leo-logo-original.png"

OUT_LOGO = ROOT / "frontend/public/nuoc-leo-logo.png"
OUT_ICON = ROOT / "ios-app/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
ANDROID_RES = ROOT / "ios-app/android/app/src/main/res"
OUT_SPLASH_DIR = ROOT / "ios-app/ios/App/App/Assets.xcassets/Splash.imageset"
OUT_BACKEND = ROOT / "backend/assets/nuoc-leo-logo.png"
OUT_BACKEND_EMAIL = ROOT / "backend/assets/nuoc-leo-logo-email.png"


def flatten_dark_bg(img: Image.Image, threshold: int = 48) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                px[x, y] = (255, 255, 255, 0)
    return rgba


def fit_on_canvas(logo: Image.Image, size: int, padding: float = 0.1) -> Image.Image:
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    inner = int(size * (1 - padding * 2))
    ratio = min(inner / logo.width, inner / logo.height)
    w = max(1, int(logo.width * ratio))
    h = max(1, int(logo.height * ratio))
    resized = logo.resize((w, h), Image.Resampling.LANCZOS)
    rgb = Image.new("RGB", resized.size, (255, 255, 255))
    rgb.paste(resized, mask=resized.split()[3] if resized.mode == "RGBA" else None)
    x = (size - w) // 2
    y = (size - h) // 2
    canvas.paste(rgb, (x, y))
    return canvas


def logo_on_white(logo: Image.Image) -> Image.Image:
    flat = flatten_dark_bg(logo)
    bg = Image.new("RGB", flat.size, (255, 255, 255))
    bg.paste(flat, mask=flat.split()[3])
    return bg


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Không tìm thấy logo: {SRC}")

    if not ARCHIVE.exists():
        import shutil

        shutil.copy2(SRC, ARCHIVE)

    source = Image.open(ARCHIVE if ARCHIVE.exists() else SRC)
    header_logo = logo_on_white(source)
    header_logo.save(OUT_LOGO, optimize=True)
    header_logo.save(OUT_BACKEND, optimize=True)

    # Email header nền tối — giữ logo gốc (chữ sáng trên nền đen)
    source.save(OUT_BACKEND_EMAIL, optimize=True)

    icon = fit_on_canvas(flatten_dark_bg(source), 1024, padding=0.14)
    icon.save(OUT_ICON, optimize=True)

    # Android launcher: cùng nhận diện với iPhone.
    # Legacy icon dùng đúng canvas trắng; adaptive foreground chừa safe zone
    # để launcher Y700 không cắt logo khi mask thành hình tròn/bo góc.
    android_sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    adaptive_sizes = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    flat_source = flatten_dark_bg(source)
    for density, size in android_sizes.items():
        out_dir = ANDROID_RES / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)
        legacy = fit_on_canvas(flat_source, size, padding=0.14)
        legacy.save(out_dir / "ic_launcher.png", optimize=True)
        legacy.save(out_dir / "ic_launcher_round.png", optimize=True)

    for density, size in adaptive_sizes.items():
        out_dir = ANDROID_RES / f"mipmap-{density}"
        foreground = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        logo = fit_on_canvas(flat_source, size, padding=0.24).convert("RGBA")
        # Bỏ nền trắng của canvas để background adaptive cung cấp nền đồng nhất.
        pixels = logo.load()
        for y in range(size):
            for x in range(size):
                r, g, b, a = pixels[x, y]
                if r >= 248 and g >= 248 and b >= 248:
                    pixels[x, y] = (255, 255, 255, 0)
        foreground.alpha_composite(logo)
        foreground.save(out_dir / "ic_launcher_foreground.png", optimize=True)

    splash = fit_on_canvas(flatten_dark_bg(source), 2732, padding=0.22)
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        splash.save(OUT_SPLASH_DIR / name, optimize=True)

    touch = fit_on_canvas(flatten_dark_bg(source), 180, padding=0.12)
    touch.save(ROOT / "frontend/public/apple-touch-icon.png", optimize=True)

    print("✅ Logo header:", OUT_LOGO)
    print("✅ App icon:", OUT_ICON)
    print("✅ Android launcher:", ANDROID_RES / "mipmap-*")
    print("✅ Splash:", OUT_SPLASH_DIR)
    print("✅ Backend (web):", OUT_BACKEND)
    print("✅ Backend (email):", OUT_BACKEND_EMAIL)


if __name__ == "__main__":
    main()
