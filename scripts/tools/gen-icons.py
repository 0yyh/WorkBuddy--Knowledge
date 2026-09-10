"""
PKS · 个人知识学习站 · App 图标生成
- 暖陶土橙渐变背景 + 抽象"展开的书/卷轴"图形，匹配 UI 暖色主题
- 输出 Android mipmap-mdpi..xxxhdpi 的 ic_launcher.png、ic_launcher_round.png、ic_launcher_foreground.png
- 同时输出 web favicon (32/180/192/512)
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import os

# 暖陶土橙三段渐变（与 UI 品牌色一致：brand=#cf5f2b，brand-strong=#b74e1e，brand-soft=#fbe7d6）
GRAD_TOP = (224, 122, 54)       # #e07a36 高光
GRAD_MID = (207, 95, 43)        # #cf5f2b
GRAD_BOT = (183, 78, 30)         # #b74e1e

# 暖奶白色（前景 + 书）
CREAM = (251, 246, 240)         # #fbf6f0
CREAM_DIM = (231, 219, 201)     # 略暗的书脊阴影

OUT_ANDROID = r"D:\WorkBuddy--Knowledge\apps\web\android\app\src\main\res"
OUT_WEB = r"D:\WorkBuddy--Knowledge\apps\web\public"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(size, top, mid, bot):
    """垂直三段渐变：0..0.45 top→mid, 0.45..1 mid→bot"""
    img = Image.new("RGB", size, top)
    px = img.load()
    w, h = size
    for y in range(h):
        t = y / max(h - 1, 1)
        if t < 0.45:
            c = lerp(top, mid, t / 0.45)
        else:
            c = lerp(mid, bot, (t - 0.45) / 0.55)
        for x in range(w):
            px[x, y] = c
    return img


def add_glow(img, color, center, radius, strength=0.55):
    """叠加径向高光"""
    w, h = img.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    cx, cy = center
    for r in range(radius, 0, -4):
        a = int(255 * strength * (1 - r / radius))
        od.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, a))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius * 0.45))
    img.rgba = None
    base = img.convert("RGBA")
    base.alpha_composite(overlay)
    return base


def draw_open_book(size, cream=(251, 246, 240), accent=(183, 78, 30), shadow=(120, 60, 20, 70)):
    """画"展开的书/双页"抽象图形，size 是画布 (w,h)"""
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w, h = size

    # 书整体居中略偏上：宽 ≈ 0.78w，高 ≈ 0.55h，中心点 (w/2, h/2 - h*0.05)
    bw = int(w * 0.78)
    bh = int(h * 0.50)
    cx = w / 2
    cy = h / 2 - h * 0.04
    half = bw / 2

    # 弧形展开书：两半页以中心 V 形对称
    # 左半页
    p_left = [
        (cx - half * 0.92, cy - bh * 0.42),    # 左上角
        (cx - half * 0.05, cy - bh * 0.50),    # 上中央（书脊顶部，略高于两侧）
        (cx - half * 0.05, cy + bh * 0.42),    # 下中央（书脊底部）
        (cx - half * 0.92, cy + bh * 0.46),    # 左下角
    ]
    p_right = [
        (cx + half * 0.05, cy - bh * 0.50),
        (cx + half * 0.92, cy - bh * 0.42),
        (cx + half * 0.92, cy + bh * 0.46),
        (cx + half * 0.05, cy + bh * 0.42),
    ]

    # 阴影（略微向下偏移）
    shadow_img = Image.new("RGBA", size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_img)
    sd.polygon([(p[0], p[1] + 6) for p in p_left], fill=shadow)
    sd.polygon([(p[0], p[1] + 6) for p in p_right], fill=shadow)
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(shadow_img)

    # 两半页填充
    d.polygon(p_left, fill=cream)
    d.polygon(p_right, fill=cream)

    # 中央书脊阴影线
    d.polygon(
        [
            (cx - half * 0.05, cy - bh * 0.50),
            (cx + half * 0.05, cy - bh * 0.50),
            (cx + half * 0.05, cy + bh * 0.42),
            (cx - half * 0.05, cy + bh * 0.42),
        ],
        fill=accent,
    )

    # 左页三条横线（文字抽象）
    line_pad_x = w * 0.07
    line_y0 = cy - bh * 0.18
    line_gap = bh * 0.16
    line_thick = max(2, int(h * 0.012))
    for i, ly in enumerate([line_y0, line_y0 + line_gap, line_y0 + line_gap * 2]):
        # 长度递减，模拟文本行尾
        if i == 0:
            x_end = cx - line_pad_x * 1.1
        elif i == 1:
            x_end = cx - line_pad_x * 1.6
        else:
            x_end = cx - line_pad_x * 2.2
        d.rounded_rectangle(
            [cx - half * 0.78, ly, x_end, ly + line_thick],
            radius=line_thick // 2,
            fill=accent,
        )
    # 右页三条横线
    for i, ly in enumerate([line_y0, line_y0 + line_gap, line_y0 + line_gap * 2]):
        if i == 0:
            x_start = cx + line_pad_x * 1.1
        elif i == 1:
            x_start = cx + line_pad_x * 1.6
        else:
            x_start = cx + line_pad_x * 2.2
        d.rounded_rectangle(
            [x_start, ly, cx + half * 0.78, ly + line_thick],
            radius=line_thick // 2,
            fill=accent,
        )

    # 一颗"知识/光"小亮点：书脊顶部一枚暖光小圆，象征阅读的灵光
    glow_r = int(h * 0.06)
    glow_cx = int(cx)
    glow_cy = int(cy - bh * 0.55 - glow_r * 0.4)
    glow_img = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_img)
    for r in range(glow_r, 0, -2):
        a = int(255 * (1 - r / glow_r) * 0.6)
        gd.ellipse([glow_cx - r, glow_cy - r, glow_cx + r, glow_cy + r], fill=(255, 235, 200, a))
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(glow_r * 0.25))
    img.alpha_composite(glow_img)

    return img


def make_full_icon(size_px, rounded=True):
    """完整 legacy/round 图标：渐变背景 + 书图形，圆角剪裁"""
    bg = vgrad(size_px, GRAD_TOP, GRAD_MID, GRAD_BOT).convert("RGBA")
    # 内嵌光斑
    overlay = Image.new("RGBA", size_px, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse(
        [-int(size_px[0] * 0.18), -int(size_px[1] * 0.22),
         int(size_px[0] * 0.55), int(size_px[1] * 0.55)],
        fill=(255, 230, 200, 90),
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(size_px[0] * 0.10))
    bg.alpha_composite(overlay)

    # 书图形（适配正方形）
    book = draw_open_book(size_px)

    out = Image.alpha_composite(bg, book)
    # 圆角遮罩
    if rounded:
        mask = Image.new("L", size_px, 0)
        m = ImageDraw.Draw(mask)
        radius = int(size_px[0] * 0.22)
        m.rounded_rectangle([0, 0, size_px[0] - 1, size_px[1] - 1], radius=radius, fill=255)
        out.putalpha(mask)
    else:
        # 圆形（round icon）
        mask = Image.new("L", size_px, 0)
        m = ImageDraw.Draw(mask)
        m.ellipse([0, 0, size_px[0] - 1, size_px[1] - 1], fill=255)
        out.putalpha(mask)
    return out


def make_foreground(size_px):
    """
    Adaptive icon foreground:
    操作系统会在 108dp 画布里裁出 72dp 可见区域（外 18dp 每边被遮罩）。
    安全区域为中心 66dp（约 61% 画布边长）。所以主体必须落在中间 66dp 范围。
    主图 = 展开的书（自带居中），背景透明。
    """
    img = Image.new("RGBA", size_px, (0, 0, 0, 0))
    book = draw_open_book(size_px)
    img.alpha_composite(book)
    return img


# ===== Android mipmap 密度 =====
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def gen_android():
    for name, base in DENSITIES.items():
        d = os.path.join(OUT_ANDROID, f"mipmap-{name}")
        os.makedirs(d, exist_ok=True)
        full = base
        # legacy full 图标 (square)
        sq = make_full_icon((full, full), rounded=True)
        sq.save(os.path.join(d, "ic_launcher.png"))
        # round 图标
        rd = make_full_icon((full, full), rounded=False)
        rd.save(os.path.join(d, "ic_launcher_round.png"))
        # adaptive foreground: 108dp 画布，但常见用 432px（=192dp@xxxhdpi）
        # foreground 画布基于 base*108/48 = base*2.25
        fg_size = int(base * 108 / 48)
        fg = make_foreground((fg_size, fg_size))
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))
        print(f"  {name}: full={full}px, fg={fg_size}px")


def gen_web():
    # favicon 32/180/192/512
    sizes = [(32, "favicon-32.png"), (180, "apple-touch-icon.png"), (192, "favicon-192.png"), (512, "favicon-512.png")]
    for sz, name in sizes:
        img = make_full_icon((sz, sz), rounded=True)
        img.save(os.path.join(OUT_WEB, name))
    # 多分辨率 ico
    ico_sizes = [(16, "favicon-16.png"), (32, "favicon-32.png"), (48, "favicon-48.png")]
    images = []
    for sz, name in ico_sizes:
        img = make_full_icon((sz, sz), rounded=True)
        images.append(img)
    images[0].save(
        os.path.join(OUT_WEB, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=images[1:],
    )
    print(f"  web: favicon.ico + favicon-32/192/512.png + apple-touch-icon.png")


if __name__ == "__main__":
    print("=== Android icons ===")
    gen_android()
    print("=== Web favicon ===")
    gen_web()
    print("done.")