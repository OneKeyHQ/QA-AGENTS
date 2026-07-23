#!/usr/bin/env python3
"""扫描固件源码中的 A:/**.png 引用，为每个生成灰色占位 PNG。

真机资产不在固件仓库中（运行时由 EMMC 提供）；占位图保证页面结构可渲染。
后续拿到真实资产时直接覆盖 assets/ 目录即可。

dev 分支资产路径不再带 assets/ 前缀（A:/graphics、A:/hero_icons、A:/icons、
A:/illustrations、A:/others、A:/token_icons、A:/wallpapers/...，见
ui/assets/asset_paths.h），sim 的 lv_conf.h 把盘符 A: 映射到 ./assets/，
因此本脚本统一输出到 <SIM_ROOT>/assets/<ref> 下。
用法: python3 tools/gen_placeholder_images.py [FIRMWARE_DIR]
"""
import os
import re
import struct
import sys
import zlib

SIM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRMWARE_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SIM_ROOT, "..", "firmware-pro2")

# 任意 A:/ 开头的 png 路径；(?:\.png)? 额外匹配固件源码中偶发的 .png.png 双后缀引用
PAT = re.compile(r'A:(/[\w./-]+?\.png(?:\.png)?)')

# 校验 FIRMWARE_DIR 必须是已存在的目录
if not os.path.isdir(FIRMWARE_DIR):
    print(
        f"ERROR: FIRMWARE_DIR 不是有效目录: {FIRMWARE_DIR}\n"
        f"期望目录布局：\n"
        f"  <workspace>/\n"
        f"    firmware-pro2/        ← 固件仓库根目录（含 ui/ tasks/ 等子目录）\n"
        f"    firmware-pro2-sim/    ← 当前仓库\n"
        f"用法: python3 tools/gen_placeholder_images.py [FIRMWARE_DIR]",
        file=sys.stderr,
    )
    sys.exit(1)

refs = set()
for root, dirs, files in os.walk(FIRMWARE_DIR):
    dirs[:] = [d for d in dirs if d not in ("modules", ".git", ".build", "build")]
    for f in files:
        if f.endswith((".c", ".h")):
            with open(os.path.join(root, f), encoding="utf-8", errors="ignore") as fp:
                refs.update(PAT.findall(fp.read()))

# 扫描完毕但 0 个引用 → 很可能 FIRMWARE_DIR 指错了
if len(refs) == 0:
    print(
        f"ERROR: 在 {FIRMWARE_DIR} 中未找到任何 'A:/**.png' 引用。\n"
        f"请检查 FIRMWARE_DIR 是否指向正确的固件仓库根目录（应包含 .c/.h 源文件）。",
        file=sys.stderr,
    )
    sys.exit(1)


def make_png(path, w, h):
    """无第三方依赖生成 w×h 半透明灰色 RGBA PNG。"""
    raw = b"".join(b"\x00" + b"\x80\x80\x80\xc0" * w for _ in range(h))
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw))
           + chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fp:
        fp.write(png)


def guess_size(ref):
    """按引用路径猜占位图尺寸 (w, h)。"""
    if "/wallpapers/" in ref:
        # 固件壁纸按 604x1024 原生像素铺底（homescreen.c 注释）
        return 604, 1024
    m = re.search(r"_(\d+)(?:\.png)+$", ref)
    if m and int(m.group(1)) >= 8:
        # 旧命名习惯：尾缀 _NN 即边长；<8 的多半是序号（如 wallpapers_01_1）非尺寸
        s = int(m.group(1))
        return s, s
    return 64, 64


generated = 0
skipped = 0
for ref in sorted(refs):
    w, h = guess_size(ref)
    out = os.path.join(SIM_ROOT, "assets", ref.lstrip("/"))
    if os.path.exists(out):
        print(f"SKIP {ref} (已存在，可能是真机资产)")
        skipped += 1
        continue
    make_png(out, w, h)
    print(f"{ref}  ->  {w}x{h}")
    generated += 1

print(f"共生成 {generated} 个占位图，跳过 {skipped} 个（已存在）")
