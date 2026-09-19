"""Generate the HooshyarOS application icon (.ico) used by the Windows installer.

The asset is deterministic and dependency-free so the packaging pipeline can
reproduce it. Run: python installer/generate-hooshyaros-icon.py
"""
from __future__ import annotations

import struct
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent / "hooshyaros.ico"

BACKGROUND = (10, 26, 52, 255)
ACCENT = (46, 196, 182, 255)
GLYPH = (240, 246, 255, 255)

SIZES = (16, 32, 48, 64, 128, 256)


def _inside_rounded(x: float, y: float, size: int, radius: float) -> bool:
    left, top, right, bottom = 0.0, 0.0, float(size), float(size)
    if x < left + radius and y < top + radius:
        return (x - (left + radius)) ** 2 + (y - (top + radius)) ** 2 <= radius ** 2
    if x > right - radius and y < top + radius:
        return (x - (right - radius)) ** 2 + (y - (top + radius)) ** 2 <= radius ** 2
    if x < left + radius and y > bottom - radius:
        return (x - (left + radius)) ** 2 + (y - (bottom - radius)) ** 2 <= radius ** 2
    if x > right - radius and y > bottom - radius:
        return (x - (right - radius)) ** 2 + (y - (bottom - radius)) ** 2 <= radius ** 2
    return True


def render(size: int) -> list[list[tuple[int, int, int, int]]]:
    radius = size * 0.16
    pixels = [[BACKGROUND if _inside_rounded(x + 0.5, y + 0.5, size, radius) else (0, 0, 0, 0)
               for x in range(size)] for y in range(size)]

    def fill(x0: float, y0: float, x1: float, y1: float, color: tuple[int, int, int, int]) -> None:
        for y in range(size):
            for x in range(size):
                fx, fy = x + 0.5, y + 0.5
                if x0 * size <= fx <= x1 * size and y0 * size <= fy <= y1 * size:
                    pixels[y][x] = color

    fill(0.28, 0.26, 0.38, 0.74, GLYPH)
    fill(0.62, 0.26, 0.72, 0.74, GLYPH)
    fill(0.38, 0.45, 0.62, 0.55, GLYPH)
    fill(0.24, 0.80, 0.76, 0.88, ACCENT)
    return pixels


def _dib(pixels: list[list[tuple[int, int, int, int]]]) -> bytes:
    size = len(pixels)
    header = struct.pack("<IiiHHIIiiII", 40, size, size * 2, 1, 32, 0, size * size * 4, 0, 0, 0, 0)
    xor = bytearray()
    for y in range(size - 1, -1, -1):
        for (red, green, blue, alpha) in pixels[y]:
            xor += bytes((blue, green, red, alpha))
    mask_row = ((size + 31) // 32) * 4
    and_mask = bytes(mask_row * size)
    return header + bytes(xor) + and_mask


def build() -> bytes:
    images = [(size, _dib(render(size))) for size in SIZES]
    directory = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries = bytearray()
    payload = bytearray()
    for size, data in images:
        dimension = 0 if size >= 256 else size
        entries += struct.pack("<BBBBHHII", dimension, dimension, 0, 0, 1, 32, len(data), offset)
        payload += data
        offset += len(data)
    return bytes(directory + entries + payload)


if __name__ == "__main__":
    OUTPUT.write_bytes(build())
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
