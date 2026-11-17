#!/usr/bin/env python3
"""从固件 ui/lvgl_port/lv_port_disp.c 抽取 compositor 合成段，生成 sim 的 shadow 源码。

为什么抽取而不是手抄：
  compositor（tasks/task_foreground/compositor/*.c）原样编入 sim，它调用的 14 个
  lv_port_disp_compose_* / transition_* 接口在真机 lv_port_disp.c 里是纯 C 像素合成逻辑
  + 少量 FreeRTOS/DMA2D/LTDC 胶水。合成逻辑决定"滚动时屏幕上到底显示什么"，必须与固件
  逐字一致，否则 sim 上复现的闪烁/残影不可信。configure 时从当前 FIRMWARE_DIR 抽取，
  固件改了合成逻辑 sim 自动跟上；改了结构（标记找不到 / 替换数不对）configure 直接失败，
  逼着维护者来看一眼，而不是悄悄用过期拷贝。

输出 build/generated/lv_port_disp_compose_body.inc，由 src/sim_disp_compose.c #include。
sim_disp_compose.c 的前导段负责提供 host 版替身：扫描池、present、信号量宏、DMA2D 软件版等。

抽取范围（两段，按文本标记定位）：
  A. 合成状态静态变量 + back buffer 选择：
     从 "static bool s_compose_entered = false;" 到 "// The display serialization lock." 之前
  B. 合成接口与全部 compose_* 辅助函数：
     从 "bool lv_port_disp_transition_front_pin(" 到 "static void disp_scan_copy_dead_time_restore(void)" 之前

host 适配替换（每条都断言命中次数在预期区间，命中数变化 = 固件结构变了，需人工核对）：
  - 地址变量 uint32_t xxx_addr → uintptr_t（真机地址是 32 位整数，64 位 host 放不下指针）
  - (uint32_t)patch_p->pixels_p → (uintptr_t)
  - 去掉 __attribute__((optimize("O3")))（clang 不认，只是告警，去掉保持输出干净）
"""
import hashlib
import re
import sys

if len(sys.argv) != 3:
    print("usage: extract_disp_compose.py <firmware_dir> <out_inc>", file=sys.stderr)
    sys.exit(2)

FIRMWARE_DIR, OUT_INC = sys.argv[1], sys.argv[2]
SRC = f"{FIRMWARE_DIR}/ui/lvgl_port/lv_port_disp.c"

with open(SRC, encoding="utf-8") as f:
    text = f.read()


def cut(start_marker, end_marker, label):
    a = text.find(start_marker)
    if a < 0:
        sys.exit(f"[extract_disp_compose] 段 {label} 起始标记未找到: {start_marker!r}（固件 lv_port_disp.c 结构变了）")
    b = text.find(end_marker, a)
    if b < 0:
        sys.exit(f"[extract_disp_compose] 段 {label} 结束标记未找到: {end_marker!r}（固件 lv_port_disp.c 结构变了）")
    return text[a:b].rstrip() + "\n"


seg_a = cut("static bool s_compose_entered = false;", "// The display serialization lock.", "A(state)")
seg_b = cut("bool lv_port_disp_transition_front_pin(", "static void disp_scan_copy_dead_time_restore(void)", "B(compose)")
body = seg_a + "\n" + seg_b

# 每条替换：(正则, 替换, 最少命中, 最多命中)
SUBS = [
    (r"\buint32_t (\w+_addr)\b", r"uintptr_t \1", 15, 40),
    # transition_precompose 的 patch 是 e2aca352 (#232) 才有的，更早的固件（修复前基线）命中 0 次属正常
    (r"\(uint32_t\)(patch_p->pixels_p)", r"(uintptr_t)\1", 0, 2),
    (r"__attribute__\(\(optimize\(\"O3\"\)\)\)\s*", "", 1, 6),
]
for pattern, repl, lo, hi in SUBS:
    body, n = re.subn(pattern, repl, body)
    if not (lo <= n <= hi):
        sys.exit(f"[extract_disp_compose] 替换 {pattern!r} 命中 {n} 次，预期 [{lo}, {hi}]：固件合成段结构变了，请核对 sim_disp_compose.c 前导段是否仍匹配")

# 抽取后不应再残留任何 RTOS/硬件寄存器直接访问（信号量/DMA2D->CR/屏障由前导段宏兜底，这里只做白名单核对）
ALLOWED_HW = {"xSemaphoreTake", "xSemaphoreGive", "pdMS_TO_TICKS", "pdFALSE", "display_request_refresh", "DMA2D->CR", "__DSB", "__builtin_memcpy",
              "disp_present_pending", "disp_present_now", "dwt_get_counter", "dma2d_convert", "dma2d_fill", "dma2d_blend_opa",
              "framebuffer_get_handle", "framebuffer_p", "FRAMEBUFFER_POOL_ADDR", "FRAMEBUFFER_POOL_SIZE_BYTES", "FRAMEBUFFER_CHANNEL_SECONDARY"}
hw_refs = set(re.findall(r"\b(xSemaphore\w+|pd\w+|display_\w+|DMA2D->\w+|__\w+|disp_present_\w+|dwt_\w+|dma2d_\w+|framebuffer_\w+|FRAMEBUFFER_\w+|HAL_\w+|LTDC\w*|vTask\w+|xTask\w+)\b", body))
unknown = sorted(r for r in hw_refs if r not in ALLOWED_HW and not r.startswith("__func__"))
if unknown:
    sys.exit(f"[extract_disp_compose] 合成段出现未知硬件/RTOS 引用 {unknown}：需在 sim_disp_compose.c 前导段补替身后再把名字加入 ALLOWED_HW")

digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
header = (
    "// 由 tools/extract_disp_compose.py 在 configure 时自动从固件 ui/lvgl_port/lv_port_disp.c 抽取，勿手改。\n"
    f"// 来源文件 sha256: {digest}\n"
    "// 段 A: 合成状态 + back buffer 选择；段 B: lv_port_disp_compose_* / transition_* 接口与 compose_* 辅助函数。\n"
    "// host 替换: uint32_t *_addr -> uintptr_t；(uint32_t)pixels_p -> (uintptr_t)；去 optimize(\"O3\") 属性。\n\n"
)
with open(OUT_INC, "w", encoding="utf-8") as f:
    f.write(header + body)
print(f"[extract_disp_compose] {len(body.splitlines())} lines -> {OUT_INC} (lv_port_disp.c sha256 {digest[:12]})")
