#!/bin/bash
# 生成固件 ui_font_manager 需要的 LVGL bin 字体
# 格式与 ui/font/ui_binfont_loader.c 解析的一致（lv_font_conv --format bin）
#
# dev 分支字体表（ui/font/ui_font_manager.c，PRO2 = PRO1 × 1.25）：
#   RoobertRegular      20 25 30 40        → A:/font/font_roobert_regular_<sz>.bin
#   RoobertSemibold     20 30 40 50 60     → A:/font/font_roobert_semibold_<sz>.bin
#   RoobertMonoRegular  35 45              → A:/font/font_roobertmono_regular_<sz>.bin
#   RoobertMonoSemibold 48 60              → A:/font/font_roobertmono_semibold_<sz>.bin
#   Symbol              40 45 60           → A:/font/font_symbol_<sz>.bin
#   BaseMultilingual    40                 → A:/font/base-multilingual-40.bin
# 真机 Roobert 字体非开源；sim 全部用 Montserrat（OFL）占位，缺失字号
# ui_font_manager 会回退 LV_FONT_DEFAULT，但有占位 bin 渲染效果更接近真机。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/font

TTF=tools/Montserrat-Regular.ttf
if [ ! -f "$TTF" ]; then
    echo "下载 Montserrat-Regular.ttf (OFL 开源字体)..."
    curl -fsSL -o "$TTF" \
        "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Regular.ttf"
fi

gen() { # gen <输出文件名（不含目录）> <字号>
    local name="$1" size="$2"
    # Pin 版本以确保可复现性，防止 npx 自动拉取最新版引入供应链风险
    npx --yes lv_font_conv@1.5.3 \
        --font "$TTF" --size "$size" --bpp 4 --format bin --no-compress \
        --range 0x20-0x7E \
        -o "assets/font/${name}"
    echo "OK assets/font/${name}"
}

for size in 20 25 30 40; do gen "font_roobert_regular_${size}.bin" "$size"; done
for size in 20 30 40 50 60; do gen "font_roobert_semibold_${size}.bin" "$size"; done
for size in 35 45; do gen "font_roobertmono_regular_${size}.bin" "$size"; done
for size in 48 60; do gen "font_roobertmono_semibold_${size}.bin" "$size"; done
for size in 40 45 60; do gen "font_symbol_${size}.bin" "$size"; done
gen "base-multilingual-40.bin" 40
