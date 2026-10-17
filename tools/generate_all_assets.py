#!/usr/bin/env python3
"""Generate all Murdoku game bitmap assets in PNG format."""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from canvas import Canvas

def draw_portrait_frame(cv, bg_color, border_color):
    """Draw a circular vignette portrait frame."""
    cv.fill_circle(64, 64, 60, border_color)
    cv.fill_circle(64, 64, 56, bg_color)

def generate_victim():
    """Lord Reginald Blackwood - Victim."""
    cv = Canvas(128, 128)
    # Background frame: dark muted purple/navy vignette
    draw_portrait_frame(cv, (35, 30, 48, 255), (180, 150, 90, 255))

    # Dark formal suit shoulders
    cv.fill_ellipse(64, 115, 46, 25, (20, 20, 28, 255))
    # White collar / cravat
    cv.fill_ellipse(64, 96, 16, 14, (230, 230, 235, 255))
    cv.fill_circle(64, 98, 4, (180, 150, 90, 255)) # Gold cravat pin

    # Neck and Face
    cv.fill_ellipse(64, 82, 12, 12, (235, 205, 185, 255))
    cv.fill_ellipse(64, 62, 22, 26, (240, 210, 190, 255)) # Face

    # Silver Hair
    cv.fill_ellipse(64, 42, 24, 16, (210, 215, 220, 255))
    cv.fill_ellipse(42, 52, 8, 16, (200, 205, 210, 255))
    cv.fill_ellipse(86, 52, 8, 16, (200, 205, 210, 255))

    # Eyes & Eyebrows (tired/aging)
    cv.draw_line(48, 54, 56, 54, 2, (140, 140, 150, 255))
    cv.draw_line(72, 54, 80, 54, 2, (140, 140, 150, 255))
    cv.fill_circle(52, 60, 3, (50, 60, 80, 255))
    cv.fill_circle(76, 60, 3, (50, 60, 80, 255))

    # Monocle over left eye
    cv.draw_circle_ring(76, 60, 8, 2, (215, 175, 75, 255))
    cv.draw_line(82, 66, 92, 95, 1.5, (215, 175, 75, 255)) # Chain

    # Thin grey mustache & stern mouth
    cv.draw_line(54, 75, 74, 75, 2, (180, 185, 190, 255))
    cv.draw_line(58, 79, 70, 79, 1.5, (160, 100, 100, 255))

    # Prominent Victim "V" Badge on corner
    cv.fill_circle(24, 24, 18, (170, 20, 35, 255))
    cv.draw_circle_ring(24, 24, 18, 2, (230, 200, 110, 255))
    # V letter
    cv.draw_line(15, 15, 24, 31, 3, (255, 255, 255, 255))
    cv.draw_line(24, 31, 33, 15, 3, (255, 255, 255, 255))

    cv.save("assets/characters/victim.png")

def generate_suspect_1():
    """Lady Beatrice - Socialite / Emerald Hat & Pearls."""
    cv = Canvas(128, 128)
    draw_portrait_frame(cv, (45, 25, 40, 255), (140, 100, 160, 255))

    # Lilac/purple evening gown shoulders
    cv.fill_ellipse(64, 115, 44, 24, (90, 45, 95, 255))
    # Pearl necklace
    for x in range(46, 83, 6):
        y = 100 + int(math.sin((x - 46) / 36 * math.pi) * 6)
        cv.fill_circle(x, y, 3, (245, 245, 250, 255))

    # Neck & Graceful Face
    cv.fill_ellipse(64, 85, 10, 12, (245, 220, 205, 255))
    cv.fill_ellipse(64, 65, 20, 24, (245, 220, 205, 255))

    # Golden Blonde Curls
    cv.fill_circle(44, 62, 10, (220, 190, 100, 255))
    cv.fill_circle(84, 62, 10, (220, 190, 100, 255))
    cv.fill_circle(42, 74, 9, (210, 180, 90, 255))
    cv.fill_circle(86, 74, 9, (210, 180, 90, 255))

    # Large Emerald Feathered Hat
    cv.fill_ellipse(64, 44, 36, 12, (20, 85, 55, 255))
    cv.fill_ellipse(64, 36, 22, 14, (15, 70, 45, 255))
    # Purple feather plume
    cv.fill_ellipse(38, 26, 12, 18, (130, 40, 120, 255))

    # Arched high eyebrows & green eyes
    cv.draw_line(50, 58, 58, 56, 1.5, (120, 90, 40, 255))
    cv.draw_line(70, 56, 78, 58, 1.5, (120, 90, 40, 255))
    cv.fill_circle(54, 63, 2.5, (30, 120, 80, 255))
    cv.fill_circle(74, 63, 2.5, (30, 120, 80, 255))

    # Elegant rose lips & beauty mark
    cv.fill_ellipse(64, 78, 5, 2.5, (190, 60, 80, 255))
    cv.fill_circle(72, 74, 1.5, (40, 20, 20, 255))

    cv.save("assets/characters/suspect-1.png")

def generate_suspect_2():
    """Colonel Vance - Military Officer / Peaked Cap & Walrus Mustache."""
    cv = Canvas(128, 128)
    draw_portrait_frame(cv, (35, 45, 30, 255), (160, 140, 80, 255))

    # Khaki Officer Tunic
    cv.fill_ellipse(64, 116, 46, 25, (75, 80, 50, 255))
    # Gold collar tab & medal ribbons
    cv.draw_line(50, 94, 78, 94, 3, (190, 160, 60, 255))
    cv.fill_rect(48, 102, 60, 108, (180, 40, 40, 255))
    cv.fill_rect(60, 102, 72, 108, (40, 70, 160, 255))

    # Neck and Rugged Square Jaw
    cv.fill_ellipse(64, 84, 14, 12, (230, 195, 170, 255))
    cv.fill_rect(48, 62, 80, 82, (235, 200, 175, 255))
    cv.fill_circle(64, 64, 20, (235, 200, 175, 255))

    # Stern eyes & heavy brows
    cv.draw_line(48, 60, 58, 62, 2.5, (80, 80, 80, 255))
    cv.draw_line(70, 62, 80, 60, 2.5, (80, 80, 80, 255))
    cv.fill_circle(53, 66, 2.5, (40, 50, 60, 255))
    cv.fill_circle(75, 66, 2.5, (40, 50, 60, 255))

    # Bushy grey walrus mustache
    cv.fill_ellipse(64, 76, 18, 7, (180, 180, 185, 255))
    cv.fill_circle(50, 77, 5, (170, 170, 175, 255))
    cv.fill_circle(78, 77, 5, (170, 170, 175, 255))

    # Officer Peaked Cap
    cv.fill_ellipse(64, 46, 28, 14, (65, 70, 45, 255))
    cv.fill_ellipse(64, 52, 30, 6, (30, 30, 25, 255)) # Black visor peak
    cv.fill_circle(64, 44, 4, (210, 175, 60, 255)) # Gold cockade badge

    cv.save("assets/characters/suspect-2.png")

def generate_suspect_3():
    """Professor Alder - Eccentric Scholar / Spectacles & Bowtie."""
    cv = Canvas(128, 128)
    draw_portrait_frame(cv, (45, 38, 25, 255), (170, 120, 60, 255))

    # Brown Tweed Jacket & Shirt
    cv.fill_ellipse(64, 116, 44, 24, (105, 75, 45, 255))
    cv.fill_ellipse(64, 98, 14, 12, (235, 230, 220, 255)) # Cream shirt
    # Orange/Maroon Bowtie
    cv.fill_ellipse(58, 98, 7, 5, (190, 70, 30, 255))
    cv.fill_ellipse(70, 98, 7, 5, (190, 70, 30, 255))
    cv.fill_circle(64, 98, 3, (160, 50, 20, 255))

    # Face & Neck
    cv.fill_ellipse(64, 84, 10, 10, (240, 215, 190, 255))
    cv.fill_ellipse(64, 64, 20, 24, (240, 215, 190, 255))

    # Wild Ginger Hair
    cv.fill_circle(44, 50, 12, (195, 95, 35, 255))
    cv.fill_circle(84, 50, 12, (195, 95, 35, 255))
    cv.fill_circle(64, 40, 15, (205, 105, 40, 255))
    cv.fill_circle(52, 38, 12, (200, 100, 38, 255))
    cv.fill_circle(76, 38, 12, (200, 100, 38, 255))

    # Round spectacles & hazel eyes
    cv.draw_circle_ring(52, 63, 8, 2, (60, 45, 30, 255))
    cv.draw_circle_ring(76, 63, 8, 2, (60, 45, 30, 255))
    cv.draw_line(60, 63, 68, 63, 2, (60, 45, 30, 255)) # Bridge
    cv.fill_circle(52, 63, 2.5, (90, 110, 60, 255))
    cv.fill_circle(76, 63, 2.5, (90, 110, 60, 255))

    # Curious smile
    cv.draw_line(58, 78, 70, 78, 1.5, (150, 90, 80, 255))

    cv.save("assets/characters/suspect-3.png")

def generate_suspect_4():
    """Miss Scarlett - Femme Fatale / Crimson Gown & Dark Bob."""
    cv = Canvas(128, 128)
    draw_portrait_frame(cv, (48, 20, 25, 255), (200, 80, 90, 255))

    # Scarlet Dress
    cv.fill_ellipse(64, 115, 42, 24, (160, 25, 45, 255))
    # Elegant Neck & Oval Face
    cv.fill_ellipse(64, 85, 10, 12, (245, 220, 210, 255))
    cv.fill_ellipse(64, 65, 19, 23, (245, 220, 210, 255))

    # Sleek Raven Bob Hair
    cv.fill_ellipse(64, 45, 24, 16, (25, 25, 30, 255))
    cv.fill_ellipse(42, 62, 8, 18, (25, 25, 30, 255))
    cv.fill_ellipse(86, 62, 8, 18, (25, 25, 30, 255))

    # Cat-eye dark lashes & seductive gaze
    cv.draw_line(49, 59, 58, 61, 2, (30, 30, 35, 255))
    cv.draw_line(70, 61, 79, 59, 2, (30, 30, 35, 255))
    cv.fill_circle(54, 63, 2.5, (60, 40, 90, 255))
    cv.fill_circle(74, 63, 2.5, (60, 40, 90, 255))

    # Ruby Earring
    cv.fill_circle(40, 72, 3, (210, 30, 50, 255))

    # Bold Red Lips
    cv.fill_ellipse(64, 78, 6, 3, (200, 20, 40, 255))

    cv.save("assets/characters/suspect-4.png")

def generate_suspect_5():
    """Dr. Samuel Croft - Physician / Goatee & Vest."""
    cv = Canvas(128, 128)
    draw_portrait_frame(cv, (25, 35, 45, 255), (100, 140, 170, 255))

    # Charcoal Physician Vest & White Shirt
    cv.fill_ellipse(64, 115, 44, 24, (45, 50, 58, 255))
    cv.fill_ellipse(64, 96, 12, 12, (235, 235, 240, 255))
    # Pocket watch chain
    for x in range(54, 76, 4):
        y = 108 + int(math.sin((x - 54) / 22 * math.pi) * 4)
        cv.fill_circle(x, y, 1.5, (215, 175, 75, 255))

    # Neck & Long Face
    cv.fill_ellipse(64, 84, 11, 11, (235, 210, 185, 255))
    cv.fill_ellipse(64, 64, 19, 24, (235, 210, 185, 255))

    # Dark Slicked Hair with Parting
    cv.fill_ellipse(64, 44, 23, 14, (35, 30, 30, 255))
    cv.draw_line(56, 38, 58, 48, 1.5, (180, 170, 160, 255)) # Gray streak/parting

    # Serious eyes & dark brows
    cv.draw_line(49, 58, 58, 58, 2, (50, 40, 40, 255))
    cv.draw_line(70, 58, 79, 58, 2, (50, 40, 40, 255))
    cv.fill_circle(54, 62, 2.5, (40, 45, 55, 255))
    cv.fill_circle(74, 62, 2.5, (40, 45, 55, 255))

    # Neat dark Van Dyke Goatee
    cv.fill_ellipse(64, 75, 10, 4, (40, 35, 35, 255)) # Mustache
    cv.fill_ellipse(64, 82, 5, 7, (40, 35, 35, 255))  # Chin beard

    cv.save("assets/characters/suspect-5.png")

def generate_icons():
    # 1. Victim Marker (64x64)
    cv = Canvas(64, 64)
    cv.fill_circle(32, 32, 28, (170, 25, 35, 255)) # Crimson wax seal
    cv.draw_circle_ring(32, 32, 28, 2.5, (235, 200, 100, 255))
    cv.draw_circle_ring(32, 32, 23, 1.5, (200, 160, 70, 255))
    # Elegant Serif 'V'
    cv.draw_line(20, 19, 32, 45, 4.5, (255, 255, 255, 255))
    cv.draw_line(32, 45, 44, 19, 4.5, (255, 255, 255, 255))
    cv.draw_line(17, 19, 23, 19, 3, (255, 255, 255, 255)) # Left serif
    cv.draw_line(41, 19, 47, 19, 3, (255, 255, 255, 255)) # Right serif
    cv.save("assets/icons/victim-marker.png")

    # 2. Cell X mark (64x64)
    cv = Canvas(64, 64)
    cv.draw_line(16, 16, 48, 48, 5, (190, 40, 40, 230))
    cv.draw_line(48, 16, 16, 48, 5, (190, 40, 40, 230))
    cv.save("assets/icons/mark-x.png")

    # 3. Action icon: Undo (48x48)
    cv = Canvas(48, 48)
    cv.fill_circle(24, 24, 21, (40, 44, 52, 255))
    cv.draw_circle_ring(24, 24, 21, 2, (180, 150, 90, 255))
    # Arc and arrow
    for deg in range(45, 220):
        rad = math.radians(deg)
        x = 24 + 11 * math.cos(rad)
        y = 25 - 11 * math.sin(rad)
        cv.fill_circle(x, y, 2.5, (240, 230, 210, 255))
    # Arrow head pointing left
    cv.draw_line(13, 25, 21, 17, 3, (240, 230, 210, 255))
    cv.draw_line(13, 25, 21, 33, 3, (240, 230, 210, 255))
    cv.save("assets/icons/undo.png")

    # 4. Action icon: Reset (48x48)
    cv = Canvas(48, 48)
    cv.fill_circle(24, 24, 21, (40, 44, 52, 255))
    cv.draw_circle_ring(24, 24, 21, 2, (180, 150, 90, 255))
    # Circular reload arrows
    for deg in range(30, 150):
        rad = math.radians(deg)
        cv.fill_circle(24 + 11 * math.cos(rad), 24 - 11 * math.sin(rad), 2, (240, 230, 210, 255))
    cv.draw_line(35, 14, 38, 22, 2.5, (240, 230, 210, 255))
    cv.draw_line(35, 14, 27, 15, 2.5, (240, 230, 210, 255))
    for deg in range(210, 330):
        rad = math.radians(deg)
        cv.fill_circle(24 + 11 * math.cos(rad), 24 - 11 * math.sin(rad), 2, (240, 230, 210, 255))
    cv.draw_line(13, 34, 10, 26, 2.5, (240, 230, 210, 255))
    cv.draw_line(13, 34, 21, 33, 2.5, (240, 230, 210, 255))
    cv.save("assets/icons/reset.png")

    # 5. Action icon: Check (48x48)
    cv = Canvas(48, 48)
    cv.fill_circle(24, 24, 21, (40, 44, 52, 255))
    cv.draw_circle_ring(24, 24, 21, 2, (180, 150, 90, 255))
    # Magnifying glass circle & handle
    cv.draw_circle_ring(21, 21, 10, 2.5, (215, 185, 110, 255))
    cv.draw_line(28, 28, 37, 37, 3.5, (160, 120, 60, 255))
    # Green checkmark inside
    cv.draw_line(16, 21, 20, 25, 2.5, (70, 190, 90, 255))
    cv.draw_line(20, 25, 27, 16, 2.5, (70, 190, 90, 255))
    cv.save("assets/icons/check.png")

    # 6. Action icon: New Case (48x48)
    cv = Canvas(48, 48)
    cv.fill_circle(24, 24, 21, (40, 44, 52, 255))
    cv.draw_circle_ring(24, 24, 21, 2, (180, 150, 90, 255))
    # Dossier folder
    cv.fill_rect(12, 14, 36, 34, (200, 165, 100, 255))
    cv.fill_rect(12, 12, 24, 16, (180, 145, 80, 255))
    # Question mark seal
    cv.fill_circle(24, 24, 6, (170, 30, 40, 255))
    cv.fill_circle(24, 22, 2, (255, 255, 255, 255))
    cv.fill_circle(24, 26, 1.2, (255, 255, 255, 255))
    cv.save("assets/icons/new-case.png")

    # 7. Furniture icons (64x64)
    # Desk
    cv = Canvas(64, 64)
    cv.fill_rect(12, 24, 52, 34, (120, 70, 35, 255)) # Top
    cv.fill_rect(16, 34, 24, 52, (95, 55, 25, 255))  # Left drawers
    cv.fill_rect(40, 34, 48, 52, (95, 55, 25, 255))  # Right drawers
    # Lamp
    cv.fill_circle(20, 18, 5, (50, 140, 80, 255))
    cv.draw_line(20, 20, 20, 24, 2, (200, 160, 60, 255))
    cv.save("assets/icons/furniture-desk.png")

    # Fireplace
    cv = Canvas(64, 64)
    cv.fill_rect(12, 16, 52, 52, (140, 60, 50, 255))
    cv.fill_rect(20, 26, 44, 52, (30, 25, 25, 255)) # Hearth
    # Fire flame
    cv.fill_ellipse(32, 44, 8, 8, (240, 120, 20, 255))
    cv.fill_ellipse(32, 46, 5, 5, (255, 220, 60, 255))
    cv.save("assets/icons/furniture-fireplace.png")

    # Table
    cv = Canvas(64, 64)
    cv.fill_ellipse(32, 32, 24, 12, (130, 80, 45, 255))
    cv.fill_ellipse(32, 30, 22, 10, (230, 225, 215, 255)) # Tablecloth
    cv.fill_rect(16, 34, 20, 52, (100, 60, 30, 255))     # Legs
    cv.fill_rect(44, 34, 48, 52, (100, 60, 30, 255))
    cv.save("assets/icons/furniture-table.png")

    # Armchair
    cv = Canvas(64, 64)
    cv.fill_ellipse(32, 30, 18, 14, (140, 35, 45, 255)) # Backrest
    cv.fill_rect(18, 34, 46, 46, (120, 25, 35, 255))   # Seat
    cv.fill_ellipse(16, 38, 5, 8, (100, 20, 30, 255))   # Left arm
    cv.fill_ellipse(48, 38, 5, 8, (100, 20, 30, 255))   # Right arm
    cv.fill_rect(18, 46, 22, 54, (80, 50, 25, 255))     # Legs
    cv.fill_rect(42, 46, 46, 54, (80, 50, 25, 255))
    cv.save("assets/icons/furniture-chair.png")

    # Piano
    cv = Canvas(64, 64)
    cv.fill_ellipse(32, 28, 22, 14, (25, 25, 30, 255))
    cv.fill_rect(14, 28, 50, 42, (25, 25, 30, 255))
    # Keys
    cv.fill_rect(18, 40, 46, 46, (240, 240, 245, 255))
    for x in range(22, 44, 4):
        cv.fill_rect(x, 40, x+2, 44, (20, 20, 20, 255))
    cv.fill_rect(18, 46, 21, 54, (25, 25, 30, 255)) # Legs
    cv.fill_rect(43, 46, 46, 54, (25, 25, 30, 255))
    cv.save("assets/icons/furniture-piano.png")

    # Billiards
    cv = Canvas(64, 64)
    cv.fill_rect(12, 20, 52, 44, (110, 70, 40, 255)) # Wood border
    cv.fill_rect(16, 24, 48, 40, (35, 130, 80, 255)) # Green baize
    # Cue balls
    cv.fill_circle(24, 32, 2.5, (245, 245, 245, 255))
    cv.fill_circle(38, 30, 2.5, (200, 40, 40, 255))
    cv.fill_circle(40, 34, 2.5, (220, 180, 30, 255))
    cv.fill_rect(15, 44, 19, 54, (90, 55, 30, 255)) # Legs
    cv.fill_rect(45, 44, 49, 54, (90, 55, 30, 255))
    cv.save("assets/icons/furniture-billiards.png")

def generate_rooms():
    # 8 distinct room patterns / textures (128x128)
    # 1. Library (Mahogany wood + book stripes)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (45, 28, 20, 255))
    for y in range(0, 128, 32):
        cv.fill_rect(0, y+28, 128, y+32, (30, 18, 12, 255)) # Shelves
        # Books
        colors = [
            (130, 35, 35, 255), (35, 75, 120, 255), (45, 100, 55, 255),
            (160, 120, 45, 255), (90, 40, 85, 255)
        ]
        x = 4
        while x < 124:
            bw = 6 + (x % 5) * 2
            col = colors[(x // 7) % len(colors)]
            cv.fill_rect(x, y + 4 + (x % 3) * 2, min(124, x + bw - 2), y + 28, col)
            x += bw
    cv.save("assets/rooms/library.png")

    # 2. Dining Room (Burgundy damask wallpaper)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (58, 18, 26, 255))
    for y in range(16, 128, 32):
        for x in range(16, 128, 32):
            cv.fill_circle(x, y, 6, (78, 26, 36, 255))
            cv.fill_ellipse(x, y - 9, 3, 5, (78, 26, 36, 255))
            cv.fill_ellipse(x, y + 9, 3, 5, (78, 26, 36, 255))
            cv.fill_ellipse(x - 9, y, 5, 3, (78, 26, 36, 255))
            cv.fill_ellipse(x + 9, y, 5, 3, (78, 26, 36, 255))
    cv.save("assets/rooms/dining.png")

    # 3. Conservatory (Sage foliage & glass lattice)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (22, 50, 34, 255))
    # Glass diamond lattice
    for i in range(-128, 256, 32):
        cv.draw_line(i, 0, i + 128, 128, 1.5, (38, 76, 52, 255))
        cv.draw_line(i, 128, i + 128, 0, 1.5, (38, 76, 52, 255))
    # Leaf silhouettes
    for y in range(16, 128, 32):
        for x in range(16, 128, 32):
            cv.fill_ellipse(x, y, 4, 8, (30, 70, 46, 255))
    cv.save("assets/rooms/conservatory.png")

    # 4. Lounge (Warm amber parquet)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (60, 40, 24, 255))
    for y in range(0, 128, 32):
        for x in range(0, 128, 32):
            cv.fill_rect(x, y, x+32, y+32, (68, 46, 28, 255) if ((x+y)//32)%2==0 else (54, 35, 20, 255))
            # Wood grain lines
            cv.draw_line(x+4, y+8, x+28, y+8, 1, (44, 28, 16, 255))
            cv.draw_line(x+4, y+16, x+28, y+16, 1, (44, 28, 16, 255))
            cv.draw_line(x+4, y+24, x+28, y+24, 1, (44, 28, 16, 255))
    cv.save("assets/rooms/lounge.png")

    # 5. Billiard Room (Teal baize felt)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (22, 48, 54, 255))
    for y in range(0, 128, 8):
        for x in range(0, 128, 8):
            if (x + y) % 16 == 0:
                cv.set_pixel(x, y, (28, 60, 66, 255))
    # Border cue lines
    cv.draw_circle_ring(64, 64, 48, 2, (34, 72, 80, 255))
    cv.save("assets/rooms/billiards.png")

    # 6. Ballroom (Champagne & gold parquet)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (60, 52, 32, 255))
    # Chevron parquet
    for y in range(0, 128, 16):
        for x in range(0, 128, 32):
            cv.draw_line(x, y, x+16, y+16, 1.5, (76, 66, 40, 255))
            cv.draw_line(x+16, y+16, x+32, y, 1.5, (76, 66, 40, 255))
    cv.save("assets/rooms/ballroom.png")

    # 7. Kitchen (Terracotta & cream quarry tile)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (60, 36, 26, 255))
    for y in range(0, 128, 32):
        for x in range(0, 128, 32):
            cv.fill_rect(x+2, y+2, x+30, y+30, (75, 45, 32, 255))
            cv.draw_line(x, y, x+32, y, 2, (35, 20, 15, 255))
            cv.draw_line(x, y, x, y+32, 2, (35, 20, 15, 255))
    cv.save("assets/rooms/kitchen.png")

    # 8. Cellar (Damp cobblestone vault)
    cv = Canvas(128, 128)
    cv.fill_rect(0, 0, 128, 128, (35, 38, 44, 255))
    for y in range(0, 128, 20):
        offset = 12 if (y // 20) % 2 == 1 else 0
        for x in range(-12 + offset, 140, 24):
            cv.fill_ellipse(x + 12, y + 10, 10, 7, (45, 48, 56, 255))
            cv.draw_line(x, y, x+24, y, 1.5, (25, 27, 32, 255))
    cv.save("assets/rooms/cellar.png")

def main():
    print("Generating character portraits...")
    generate_victim()
    generate_suspect_1()
    generate_suspect_2()
    generate_suspect_3()
    generate_suspect_4()
    generate_suspect_5()

    print("Generating icons...")
    generate_icons()

    print("Generating room textures...")
    generate_rooms()

    print("All assets generated successfully!")

if __name__ == '__main__':
    main()
