#!/usr/bin/env python3
"""Asset generation script for Murdoku game bitmap assets.

Generates standalone 32-bit RGBA PNG assets without external dependencies.
"""
import math
import os
import struct
import zlib

def make_png(width: int, height: int, rgba: bytearray) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    raw = bytearray()
    row_bytes = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        start = y * row_bytes
        raw.extend(rgba[start:start + row_bytes])
    idat = zlib.compress(bytes(raw), 9)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

class Canvas:
    def __init__(self, width: int, height: int, bg=(0, 0, 0, 0)):
        self.w = width
        self.h = height
        self.data = bytearray(bg * (width * height))

    def set_pixel(self, x: int, y: int, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            idx = (y * self.w + x) * 4
            if color[3] == 255 or self.data[idx+3] == 0:
                self.data[idx:idx+4] = bytearray(color)
            else:
                # Alpha composite
                sa = color[3] / 255.0
                da = self.data[idx+3] / 255.0
                out_a = sa + da * (1.0 - sa)
                if out_a > 0:
                    r = int((color[0] * sa + self.data[idx] * da * (1.0 - sa)) / out_a)
                    g = int((color[1] * sa + self.data[idx+1] * da * (1.0 - sa)) / out_a)
                    b = int((color[2] * sa + self.data[idx+2] * da * (1.0 - sa)) / out_a)
                    a = int(out_a * 255)
                    self.data[idx:idx+4] = bytearray((r, g, b, a))

    def fill_rect(self, x1, y1, x2, y2, color):
        for y in range(max(0, y1), min(self.h, y2)):
            for x in range(max(0, x1), min(self.w, x2)):
                self.set_pixel(x, y, color)

    def fill_circle(self, cx, cy, r, color):
        r_sq = r * r
        for y in range(int(cy - r), int(cy + r + 1)):
            for x in range(int(cx - r), int(cx + r + 1)):
                if (x - cx)**2 + (y - cy)**2 <= r_sq:
                    self.set_pixel(x, y, color)

    def draw_circle_ring(self, cx, cy, r, thickness, color):
        r_outer = r * r
        r_inner = (r - thickness) * (r - thickness)
        for y in range(int(cy - r), int(cy + r + 1)):
            for x in range(int(cx - r), int(cx + r + 1)):
                d_sq = (x - cx)**2 + (y - cy)**2
                if r_inner <= d_sq <= r_outer:
                    self.set_pixel(x, y, color)

    def fill_ellipse(self, cx, cy, rx, ry, color):
        for y in range(int(cy - ry), int(cy + ry + 1)):
            for x in range(int(cx - rx), int(cx + rx + 1)):
                if ((x - cx) / rx)**2 + ((y - cy) / ry)**2 <= 1.0:
                    self.set_pixel(x, y, color)

    def draw_line(self, x0, y0, x1, y1, width, color):
        dx = x1 - x0
        dy = y1 - y0
        dist = math.hypot(dx, dy)
        if dist == 0:
            self.fill_circle(x0, y0, width / 2, color)
            return
        steps = int(dist * 2)
        for s in range(steps + 1):
            t = s / steps
            cx = x0 + dx * t
            cy = y0 + dy * t
            self.fill_circle(cx, cy, width / 2, color)

    def save(self, filepath: str):
        directory = os.path.dirname(filepath)
        if directory:
            os.makedirs(directory, exist_ok=True)
        content = make_png(self.w, self.h, self.data)
        with open(filepath, 'wb') as f:
            f.write(content)

print("Canvas helper ready")
