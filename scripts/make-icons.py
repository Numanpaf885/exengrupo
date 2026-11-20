"""Generate the black/white exengrupo icons (run once: python3 scripts/make-icons.py).

Swiss style: black square, white lowercase "ex" in Inter Bold, flush left,
sitting on the baseline of an 8-unit grid. No rounded corners, no gradients.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"


def glyph(size: int, scale: float, bg, fg, margin_ratio: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), bg)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(str(FONT), int(size * scale))
    text = "ex"
    left, top, right, bottom = d.textbbox((0, 0), text, font=font)
    m = int(size * margin_ratio)
    x = m - left
    y = size - m - bottom
    d.text((x, y), text, font=font, fill=fg)
    return img


BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

full = lambda s: glyph(s, 0.56, BLACK, WHITE, 0.125)
# Adaptive / maskable icons keep the glyph inside the central safe zone.
safe = lambda s, bg: glyph(s, 0.36, bg, WHITE, 0.25)

full(1024).convert("RGB").save(ROOT / "assets/icon.png")
safe(1024, CLEAR).save(ROOT / "assets/android-icon-foreground.png")
safe(1024, CLEAR).save(ROOT / "assets/android-icon-monochrome.png")
full(48).convert("RGB").save(ROOT / "assets/favicon.png")
full(48).convert("RGB").save(ROOT / "public/favicon.png")
full(180).convert("RGB").save(ROOT / "public/apple-touch-icon.png")
full(192).convert("RGB").save(ROOT / "public/icon-192.png")
full(512).convert("RGB").save(ROOT / "public/icon-512.png")
safe(512, BLACK).convert("RGB").save(ROOT / "public/icon-maskable-512.png")
print("icons written")
