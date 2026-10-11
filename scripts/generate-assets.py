import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# Exact Weiss theme tokens (matching Calmcoder / Noctis Obscuro)
C_CANVAS_RGB = (3, 20, 23)           # #031417
C_CANVAS = (3, 20, 23, 255)
C_ELEVATED = (6, 46, 50, 255)         # #062e32
C_ELEVATED2 = (8, 63, 68, 255)        # #083f44
C_BORDER = (19, 94, 104, 255)        # #135e68
C_BORDER_LIGHT = (28, 140, 155, 255) # #1c8c9b
C_FG = (178, 202, 205, 255)          # #b2cacd
C_FG_MUTED = (91, 133, 139, 255)     # #5b858b
C_TEXT_LINE = (15, 68, 75, 255)      # #0f444b
C_HL_GLOW = (20, 184, 166, 255)      # #14b8a6
C_HL_CORE = (22, 159, 177, 255)      # #169fb1
C_HL_BRIGHT = (34, 211, 238, 255)    # #22d3ee
C_HL_TEXT = (240, 253, 250, 255)     # #f0fdfa
C_WHITE = (255, 255, 255, 255)

def draw_single_card(width, height, radius, fill_color, border_color, border_width, lines=True, highlight=False, is_mono=False):
    card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)

    # Base shape
    draw.rounded_rectangle([0, 0, width - 1, height - 1], radius=radius, fill=fill_color)

    # Border
    if border_width > 0:
        draw.rounded_rectangle(
            [border_width // 2, border_width // 2, width - 1 - border_width // 2, height - 1 - border_width // 2],
            radius=radius,
            outline=border_color,
            width=border_width
        )

    if lines:
        margin_x = int(width * 0.12)
        start_y = int(height * 0.16)
        line_h = int(height * 0.046)
        gap_y = int(height * 0.14)

        line_configs = [
            (0.70, False),
            (0.90, highlight),   # Line 2: Highlighted
            (0.62, False),
            (0.80, False),
            (0.48, False),
        ]

        for i, (ratio, is_hl) in enumerate(line_configs):
            y = start_y + i * gap_y
            line_w = int((width - 2 * margin_x) * ratio)
            x1 = margin_x
            x2 = margin_x + line_w

            if is_hl:
                if is_mono:
                    # Solid white highlight bar for monochrome
                    hl_pad = int(line_h * 0.55)
                    draw.rounded_rectangle(
                        [x1 - hl_pad, y - hl_pad, x1 + int(line_w * 0.88) + hl_pad, y + line_h + hl_pad],
                        radius=int(line_h * 0.8),
                        fill=(255, 255, 255, 255)
                    )
                else:
                    # Highlighter bar: glowing teal/cyan pill
                    hl_pad = int(line_h * 0.55)
                    hl_w = int(line_w * 0.88)
                    hl_box = [x1 - hl_pad, y - hl_pad, x1 + hl_w + hl_pad, y + line_h + hl_pad]
                    hl_r = int((hl_box[3] - hl_box[1]) / 2)

                    # Soft outer glow
                    glow_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                    glow_draw = ImageDraw.Draw(glow_layer)
                    glow_draw.rounded_rectangle(hl_box, radius=hl_r, fill=C_HL_GLOW)
                    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(line_h * 0.8)))
                    card = Image.alpha_composite(card, glow_layer)
                    draw = ImageDraw.Draw(card)

                    # Vibrant highlighter pill
                    draw.rounded_rectangle(hl_box, radius=hl_r, fill=C_HL_CORE)
                    draw.rounded_rectangle([hl_box[0] + 2, hl_box[1] + 2, hl_box[2] - 2, hl_box[3] - 2], radius=hl_r - 2, outline=C_HL_BRIGHT, width=3)

                    # Highlighted text line (crisp light-teal)
                    draw.rounded_rectangle([x1, y, x2, y + line_h], radius=line_h // 2, fill=C_HL_TEXT)
            else:
                line_color = (255, 255, 255, 90) if is_mono else C_TEXT_LINE
                draw.rounded_rectangle([x1, y, x2, y + line_h], radius=line_h // 2, fill=line_color)

    return card

def render_cards_composition(canvas_size=2048, is_mono=False, scale_factor=1.0):
    """
    Renders 3 overlapping study cards with realistic soft drop shadows.
    """
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    base_card_w = int(520 * (canvas_size / 1024) * scale_factor)
    base_card_h = int(620 * (canvas_size / 1024) * scale_factor)
    radius = int(48 * (canvas_size / 1024) * scale_factor)
    bw = int(4 * (canvas_size / 1024) * scale_factor)

    cx = canvas_size // 2
    cy = canvas_size // 2

    # Card 1: Back-Left (-9 degrees)
    c1_fill = (255, 255, 255, 50) if is_mono else (4, 30, 34, 255)
    c1_border = (255, 255, 255, 80) if is_mono else (10, 56, 62, 255)
    c1 = draw_single_card(base_card_w, base_card_h, radius, c1_fill, c1_border, bw, lines=True, highlight=False, is_mono=is_mono)
    c1_rot = c1.rotate(-9, resample=Image.Resampling.BICUBIC, expand=True)

    # Card 2: Middle-Right (+7.5 degrees)
    c2_fill = (255, 255, 255, 90) if is_mono else (5, 38, 42, 255)
    c2_border = (255, 255, 255, 120) if is_mono else (14, 75, 83, 255)
    c2 = draw_single_card(base_card_w, base_card_h, radius, c2_fill, c2_border, bw, lines=True, highlight=False, is_mono=is_mono)
    c2_rot = c2.rotate(7.5, resample=Image.Resampling.BICUBIC, expand=True)

    # Card 3: Front-Center (0 degrees)
    c3_fill = (255, 255, 255, 220) if is_mono else C_ELEVATED
    c3_border = (255, 255, 255, 255) if is_mono else C_BORDER_LIGHT
    c3 = draw_single_card(base_card_w, base_card_h, radius, c3_fill, c3_border, int(bw * 1.2), lines=True, highlight=True, is_mono=is_mono)

    # Offsets
    shift = int(38 * (canvas_size / 1024) * scale_factor)

    # Composite Card 1
    p1 = (cx - c1_rot.width // 2 - shift, cy - c1_rot.height // 2 - int(shift * 0.6))
    if not is_mono:
        sh1 = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        sh1.paste((0, 0, 0, 100), (p1[0], p1[1] + int(24 * scale_factor)), c1_rot.split()[3])
        sh1 = sh1.filter(ImageFilter.GaussianBlur(radius=int(28 * (canvas_size / 1024) * scale_factor)))
        canvas = Image.alpha_composite(canvas, sh1)
    canvas.paste(c1_rot, p1, c1_rot)

    # Composite Card 2
    p2 = (cx - c2_rot.width // 2 + int(shift * 0.95), cy - c2_rot.height // 2 - int(shift * 0.25))
    if not is_mono:
        sh2 = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 120))
        sh2.paste((0, 0, 0, 120), (p2[0], p2[1] + int(24 * scale_factor)), c2_rot.split()[3])
        sh2 = sh2.filter(ImageFilter.GaussianBlur(radius=int(26 * (canvas_size / 1024) * scale_factor)))
        canvas = Image.alpha_composite(canvas, sh2)
    canvas.paste(c2_rot, p2, c2_rot)

    # Composite Card 3 (Front)
    p3 = (cx - c3.width // 2, cy - c3.height // 2 + int(shift * 0.5))
    if not is_mono:
        sh3 = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        sh3.paste((0, 0, 0, 160), (p3[0], p3[1] + int(32 * scale_factor)), c3.split()[3])
        sh3 = sh3.filter(ImageFilter.GaussianBlur(radius=int(32 * (canvas_size / 1024) * scale_factor)))
        canvas = Image.alpha_composite(canvas, sh3)
    canvas.paste(c3, p3, c3)

    return canvas

def make_icon_png():
    size = 2048
    img = Image.new("RGBA", (size, size), C_CANVAS)

    # Ambient radial glow in center
    cx, cy = size // 2, size // 2
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    for r in range(int(size * 0.45), 0, -20):
        t = 1.0 - (r / (size * 0.45))
        a = int(45 * (t ** 1.5))
        g_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(12, 68, 76, a))
    img = Image.alpha_composite(img, glow)

    # Cards composition
    cards = render_cards_composition(canvas_size=size, is_mono=False, scale_factor=0.92)
    img = Image.alpha_composite(img, cards)

    return img.resize((1024, 1024), resample=Image.Resampling.LANCZOS)

def make_adaptive_foreground():
    size = 2048
    cards = render_cards_composition(canvas_size=size, is_mono=False, scale_factor=0.74)
    return cards.resize((1024, 1024), resample=Image.Resampling.LANCZOS)

def make_adaptive_monochrome():
    size = 2048
    cards = render_cards_composition(canvas_size=size, is_mono=True, scale_factor=0.74)
    return cards.resize((1024, 1024), resample=Image.Resampling.LANCZOS)

def make_splash_icon():
    size = 2048
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Cards positioned slightly higher
    cards = render_cards_composition(canvas_size=size, is_mono=False, scale_factor=0.62)
    canvas.paste(cards, (0, -int(size * 0.08)), cards)

    # Wordmark Weiss
    draw = ImageDraw.Draw(canvas)
    try:
        font_main = ImageFont.truetype(r"C:\Windows\Fonts\georgia.ttf", size=int(size * 0.096))
        font_sub = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", size=int(size * 0.026))
    except Exception:
        font_main = ImageFont.load_default()
        font_sub = font_main

    title = "Weiss"
    tb = draw.textbbox((0, 0), title, font=font_main)
    tb_full = draw.textbbox((0, 0), "Weiss.", font=font_main)
    tb_dot = draw.textbbox((0, 0), ".", font=font_main)

    total_w = tb_full[2] - tb_full[0]
    start_x = (size - total_w) // 2 - tb_full[0]
    ty = int(size * 0.63)

    # Draw wordmark
    draw.text((start_x, ty), title, font=font_main, fill=(240, 244, 240, 255))

    # Draw trademark glowing cyan/teal dot at the exact period position
    dot_r = int((tb_dot[3] - tb_dot[1]) * 0.55)
    dot_cx = start_x + (tb[2] + tb_full[2]) // 2
    dot_cy = ty + (tb_dot[1] + tb_dot[3]) // 2

    # Subtle glow behind dot
    glow_r = int(dot_r * 1.8)
    glow_dot = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_dot_draw = ImageDraw.Draw(glow_dot)
    g_dot_draw.ellipse([dot_cx - glow_r, dot_cy - glow_r, dot_cx + glow_r, dot_cy + glow_r], fill=C_HL_GLOW)
    glow_dot = glow_dot.filter(ImageFilter.GaussianBlur(radius=dot_r // 2))
    canvas = Image.alpha_composite(canvas, glow_dot)
    draw = ImageDraw.Draw(canvas)

    draw.ellipse([dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r], fill=C_HL_BRIGHT)

    # Subtitle
    subtitle = "FLASHCARDS & CONSULTA"
    stb = draw.textbbox((0, 0), subtitle, font=font_sub)
    sw = stb[2] - stb[0]
    sx = (size - sw) // 2 - stb[0]
    sy = ty + (tb[3] - tb[1]) + int(size * 0.04)

    draw.text((sx, sy), subtitle, font=font_sub, fill=(135, 167, 171, 230))

    return canvas.resize((1024, 1024), resample=Image.Resampling.LANCZOS)

def make_adaptive_background():
    size = 2048
    img = Image.new("RGBA", (size, size), C_CANVAS)
    cx, cy = size // 2, size // 2
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    for r in range(int(size * 0.45), 0, -20):
        t = 1.0 - (r / (size * 0.45))
        a = int(40 * (t ** 1.5))
        g_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(12, 68, 76, a))
    img = Image.alpha_composite(img, glow)
    return img.resize((1024, 1024), resample=Image.Resampling.LANCZOS)

def make_favicon():
    icon = make_icon_png()
    return icon.resize((48, 48), resample=Image.Resampling.LANCZOS)

def main():
    target_dir = r"assets/images"
    os.makedirs(target_dir, exist_ok=True)
    print(f"Generating refined Weiss assets into {target_dir}...")

    icon_img = make_icon_png()
    icon_img.save(os.path.join(target_dir, "icon.png"), "PNG")
    print("  * icon.png (1024x1024)")

    fg_img = make_adaptive_foreground()
    fg_img.save(os.path.join(target_dir, "android-icon-foreground.png"), "PNG")
    print("  * android-icon-foreground.png (1024x1024)")

    bg_img = make_adaptive_background()
    bg_img.save(os.path.join(target_dir, "android-icon-background.png"), "PNG")
    print("  * android-icon-background.png (1024x1024)")

    mono_img = make_adaptive_monochrome()
    mono_img.save(os.path.join(target_dir, "android-icon-monochrome.png"), "PNG")
    print("  * android-icon-monochrome.png (1024x1024)")

    splash_img = make_splash_icon()
    splash_img.save(os.path.join(target_dir, "splash-icon.png"), "PNG")
    print("  * splash-icon.png (1024x1024)")

    fav_img = make_favicon()
    fav_img.save(os.path.join(target_dir, "favicon.png"), "PNG")
    print("  * favicon.png (48x48)")

    print("All Weiss visual assets generated successfully!")

if __name__ == "__main__":
    main()
