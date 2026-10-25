import os
from PIL import Image, ImageDraw

REPO_ROOT = r"H:\HoroshoVLesu\Repo\horosho-v-lesu"
PUBLIC_DIR = os.path.join(REPO_ROOT, "public")
ANDROID_RES = os.path.join(REPO_ROOT, "android", "app", "src", "main", "res")

# Target densities and dimensions
# (folder_name, legacy_size, adaptive_fg_size)
DENSITIES = [
    ("mipmap-mdpi", 48, 108),
    ("mipmap-hdpi", 72, 162),
    ("mipmap-xhdpi", 96, 216),
    ("mipmap-xxhdpi", 144, 324),
    ("mipmap-xxxhdpi", 192, 432),
]

def make_round(img: Image.Image) -> Image.Image:
    """Mask image with an antialiased circle"""
    size = img.size
    mask = Image.new("L", (size[0] * 2, size[1] * 2), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size[0] * 2 - 1, size[1] * 2 - 1), fill=255)
    mask = mask.resize(size, Image.Resampling.LANCZOS)
    
    res = img.copy()
    res.putalpha(mask)
    return res

def make_adaptive_fg(src_img: Image.Image, fg_size: int) -> Image.Image:
    """Create adaptive foreground with avatar nicely centered inside safe zone (approx 72%)"""
    fg = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    # Safe zone size
    inner_size = int(fg_size * 0.72)
    resized_src = src_img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    # Circle mask the inner avatar
    round_avatar = make_round(resized_src)
    
    offset = (fg_size - inner_size) // 2
    fg.paste(round_avatar, (offset, offset), round_avatar)
    return fg

def generate_pack(source_png_path: str, output_res_dir: str):
    src = Image.open(source_png_path).convert("RGBA")
    
    for folder, legacy_size, fg_size in DENSITIES:
        target_dir = os.path.join(output_res_dir, folder)
        os.makedirs(target_dir, exist_ok=True)
        
        # 1. ic_launcher.png (square / rounded)
        launcher_sq = src.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
        launcher_sq.save(os.path.join(target_dir, "ic_launcher.png"), "PNG")
        
        # 2. ic_launcher_round.png
        launcher_round = make_round(launcher_sq)
        launcher_round.save(os.path.join(target_dir, "ic_launcher_round.png"), "PNG")
        
        # 3. ic_launcher_foreground.png (for adaptive icons)
        launcher_fg = make_adaptive_fg(src, fg_size)
        launcher_fg.save(os.path.join(target_dir, "ic_launcher_foreground.png"), "PNG")

if __name__ == "__main__":
    # Artem's APK uses Irina's picture on desktop
    irina_src = os.path.join(PUBLIC_DIR, "icon-irina-512.png")
    artem_res_dir = os.path.join(REPO_ROOT, "android", "res_artem")
    generate_pack(irina_src, artem_res_dir)
    print("Generated res_artem (icon is Irina)")

    # Irina's APK uses Artem's picture on desktop
    artem_src = os.path.join(PUBLIC_DIR, "icon-artem-512.png")
    irina_res_dir = os.path.join(REPO_ROOT, "android", "res_irina")
    generate_pack(artem_src, irina_res_dir)
    print("Generated res_irina (icon is Artem)")

    # Also update default res with Irina (for main APK)
    generate_pack(irina_src, ANDROID_RES)
    print("Updated android/app/src/main/res")
