#!/usr/bin/env python3
"""阶段B step3: 从固件 page_id.h + 各 page .c 的 PAGE_REGISTER 重建 sim 页面注册表。

输出 build/generated/page_list.inc —— 一张 C 表初始化器列表，每行：
    { "<id_str>", PAGE_ID_<ENUM>, <SUPPORTED|NEEDS_ARG> },

判定逻辑：
  - id_str：PAGE_ID_HOMESCREEN → "homescreen"（去前缀 + 小写）
  - 只收录"已编译进 sim"的页面：注册它的 .c 文件不在 UNSUPPORTED_DIRS 下
    （my_address / ui_view 等被 CMake 排除的子目录，其 PAGE_REGISTER 不会进段，
    sim 段里根本没有这些描述符，open 会 push 失败）
  - supported vs needs_arg：看 create 回调函数体是否真正使用第二参数 arg。
      * 函数体里只有 `UNUSED(arg)` / 完全不出现 arg 标识符 → SUPPORTED（NULL 可开）
      * 出现 arg 的解引用/强转（如 (int)(intptr_t)arg、((T*)arg)->x）→ NEEDS_ARG
        （保守：不硬塞 NULL 试爆，snapshot 跳过 + 列表标注，除非人工确认 NULL 安全）

CMake configure 时运行，固件零改动（纯解析，输出落 sim build 目录）。
"""
import os
import re
import sys

# CMake 传入：固件根目录、输出 .inc 路径、被 CMake 排除的页面子目录正则（逗号分隔）
FIRMWARE_DIR = sys.argv[1]
OUT_INC = sys.argv[2]
UNSUPPORTED_PATTERNS = [p for p in (sys.argv[3].split(",") if len(sys.argv) > 3 else []) if p]

PAGES_DIR = os.path.join(FIRMWARE_DIR, "tasks", "task_foreground", "pages")
PAGE_ID_H = os.path.join(FIRMWARE_DIR, "tasks", "task_foreground", "page_manager", "page_id.h")

# ── 1. 解析 page_id.h 的枚举顺序（用于稳定排序 + 校验注册的 id 存在）──
enum_order = {}
with open(PAGE_ID_H, encoding="utf-8") as f:
    txt = f.read()
# 取 PageId_t enum body
m = re.search(r"\benum\b[^{]*\{(.*?)\}\s*PageId_t", txt, re.S)
body = m.group(1) if m else txt
idx = 0
for line in body.splitlines():
    line = re.sub(r"//.*", "", line)
    line = re.sub(r"/\*.*?\*/", "", line)
    mm = re.match(r"\s*(PAGE_ID_[A-Z0-9_]+)\s*(=\s*([0-9]+))?\s*,?", line)
    if not mm:
        continue
    name = mm.group(1)
    if mm.group(3) is not None:
        idx = int(mm.group(3))
    enum_order[name] = idx
    idx += 1

# ── 2. 扫描所有 page .c 的 PAGE_REGISTER*，记录 (page_id_enum, create_cb, src_path) ──
register_re = re.compile(
    r"PAGE_REGISTER(?:_WITH_FLAGS|_WITH_REFRESH)?\s*\(\s*"
    r"(PAGE_ID_[A-Z0-9_]+)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)"
)

def is_unsupported_path(relpath):
    norm = relpath.replace(os.sep, "/")
    return any(re.search(pat, norm) for pat in UNSUPPORTED_PATTERNS)

def create_uses_arg(src_text, create_cb):
    """启发式判断 create_cb 函数体是否真正使用第二参数 arg（NEEDS_ARG）。
    匹配 `... create_cb(lv_obj_t* container, void* arg)` 后的 {...} 体，
    去掉 UNUSED(arg)/(void)arg 后还出现 arg 标识符 → 使用了 arg。"""
    # 找函数定义起点
    sig = re.search(
        r"\b" + re.escape(create_cb) + r"\s*\(\s*lv_obj_t\s*\*\s*\w+\s*,\s*void\s*\*\s*(\w+)\s*\)\s*\{",
        src_text,
    )
    if not sig:
        # 没找到标准签名（可能 arg 命名不同或跨文件），保守当作 needs_arg
        return None
    arg_name = sig.group(1)
    # 从 { 开始做花括号配平，取函数体
    start = sig.end() - 1
    depth = 0
    i = start
    while i < len(src_text):
        c = src_text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    bodytxt = src_text[start : i + 1]
    # 去掉无害的 UNUSED(arg) / (void)arg
    cleaned = re.sub(r"UNUSED\s*\(\s*" + re.escape(arg_name) + r"\s*\)", "", bodytxt)
    cleaned = re.sub(r"\(\s*void\s*\)\s*" + re.escape(arg_name) + r"\b", "", cleaned)
    # 还有 arg 作为独立标识符出现？
    return re.search(r"\b" + re.escape(arg_name) + r"\b", cleaned) is not None

entries = []  # (enum_name, id_str, supported_bool, note)
seen = set()
for root, _dirs, files in os.walk(PAGES_DIR):
    for fn in files:
        if not fn.endswith(".c"):
            continue
        path = os.path.join(root, fn)
        rel = os.path.relpath(path, PAGES_DIR)
        if is_unsupported_path("pages/" + rel):
            continue  # 该 .c 不编进 sim，跳过其注册
        with open(path, encoding="utf-8", errors="replace") as f:
            src = f.read()
        for mreg in register_re.finditer(src):
            enum_name, create_cb = mreg.group(1), mreg.group(2)
            if enum_name in seen:
                continue
            if enum_name not in enum_order:
                # 注册了一个 page_id.h 里没有的枚举（如 PAGE_ID_NFT_GALLERY_EMPTY）→ 仍收录，排到末尾
                pass
            uses = create_uses_arg(src, create_cb)
            if uses is True:
                supported, note = False, "arg deref"
            elif uses is None:
                supported, note = False, "create sig unmatched (conservative)"
            else:
                supported, note = True, ""
            id_str = enum_name[len("PAGE_ID_") :].lower()
            entries.append((enum_name, id_str, supported, note))
            seen.add(enum_name)

entries.sort(key=lambda e: enum_order.get(e[0], 1 << 30))

os.makedirs(os.path.dirname(OUT_INC), exist_ok=True)
n_sup = sum(1 for e in entries if e[2])
n_arg = sum(1 for e in entries if not e[2])
with open(OUT_INC, "w", encoding="utf-8") as f:
    f.write("// 自动生成 by tools/gen_page_list.py —— 请勿手改（CMake configure 时重建）\n")
    f.write("// sim_page_t 字段序: { id_str, name_zh, PAGE_ID 枚举, supported(1=NULL 可开,0=needs_arg) }\n")
    f.write(f"// 统计: 注册页 {len(entries)} | supported {n_sup} | needs_arg {n_arg}\n")
    for enum_name, id_str, supported, note in entries:
        sup = "1" if supported else "0"
        # name_zh：暂用 id_str；needs_arg 时附 note（snapshot 跳过/列表标注时可见原因）
        if supported:
            name = id_str
        else:
            name = f"{id_str} [needs_arg: {note}]"
        name_c = name.replace('"', "'")
        f.write(f'    {{ "{id_str}", "{name_c}", {enum_name}, {sup} }},\n')

print(f"[gen_page_list] {len(entries)} pages | supported={n_sup} needs_arg={n_arg} -> {OUT_INC}")
