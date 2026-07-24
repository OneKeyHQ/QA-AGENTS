cmake_minimum_required(VERSION 3.21)
project(onekey-sim C)

# 固件 dev 分支用 C23（page_manager.h 的 `enum : uint32_t` 固定底层类型等），sim 对齐
set(CMAKE_C_STANDARD 23)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# 固件仓库位置（只读引用，零改动）——跟随 ../firmware-pro2 的 origin/dev 最新代码
set(FIRMWARE_DIR "${CMAKE_CURRENT_LIST_DIR}/../firmware-pro2" CACHE PATH "firmware-pro2 仓库根目录")
if(NOT EXISTS "${FIRMWARE_DIR}/modules/lvgl/CMakeLists.txt")
    message(FATAL_ERROR "FIRMWARE_DIR 无效或 lvgl submodule 未初始化: ${FIRMWARE_DIR}")
endif()

# ── 资源根目录（lv_fs 'A' 盘）装配 ──
# 真机: .okpkg 包挂载, A:/resource/... 由 resource_manager 路由
# sim : LV_FS_STDIO_PATH="resroot"，把固件资源管线的 output/ 软链成同样的 resource/ 树
#       （i18n ← output/i18n, font ← output/fonts/roobert, 其余 ← output/images/*，
#        对应 pack_config.json 各 bundle 的 dst_prefix）。
# 资源生成（firmware-pro2 下运行, 拉新代码后如资源有变需重跑）:
#   python3 utils/resource/resource_pkg.py font --only json && \
#   python3 utils/resource/resource_pkg.py font --only roobert --no-download && \
#   python3 utils/resource/resource_pkg.py font --only symbol && \
#   python3 utils/resource/resource_pkg.py image
set(RES_OUT ${FIRMWARE_DIR}/utils/resource/output)
if(NOT EXISTS ${RES_OUT}/i18n/en-Latn-US.json OR NOT EXISTS ${RES_OUT}/fonts/roobert OR NOT EXISTS ${RES_OUT}/images)
    message(FATAL_ERROR "固件资源未生成 (${RES_OUT})，先按上方注释运行 resource_pkg.py 各步骤")
endif()
set(RESROOT ${CMAKE_CURRENT_LIST_DIR}/resroot)
file(MAKE_DIRECTORY ${RESROOT}/resource)
file(GLOB _res_img_dirs RELATIVE ${RES_OUT}/images ${RES_OUT}/images/*)
foreach(_d ${_res_img_dirs} i18n font)
    file(REMOVE ${RESROOT}/resource/${_d})
endforeach()
foreach(_d ${_res_img_dirs})
    file(CREATE_LINK ${RES_OUT}/images/${_d} ${RESROOT}/resource/${_d} SYMBOLIC)
endforeach()
file(CREATE_LINK ${RES_OUT}/i18n ${RESROOT}/resource/i18n SYMBOLIC)
# font/ 不能整目录软链 roobert：非拉丁语言的 noto 字体在 output/fonts/noto，
# 真机打包到 resource/font/noto（pack_config.json fonts_noto bundle）。
# 故 font/ 做成真目录：roobert 逐文件软链 + noto 目录软链（未生成 noto 时跳过，
# 仅拉丁语言可用；生成后重新 cmake 即接入）。
file(MAKE_DIRECTORY ${RESROOT}/resource/font)
file(GLOB _res_font_files RELATIVE ${RES_OUT}/fonts/roobert ${RES_OUT}/fonts/roobert/*)
foreach(_f ${_res_font_files})
    file(REMOVE ${RESROOT}/resource/font/${_f})
    file(CREATE_LINK ${RES_OUT}/fonts/roobert/${_f} ${RESROOT}/resource/font/${_f} SYMBOLIC)
endforeach()
file(REMOVE ${RESROOT}/resource/font/noto)
if(EXISTS ${RES_OUT}/fonts/noto)
    file(CREATE_LINK ${RES_OUT}/fonts/noto ${RESROOT}/resource/font/noto SYMBOLIC)
else()
    message(WARNING "output/fonts/noto 未生成 — 非拉丁语言（zh/ja/ko/ru/uk）字形将缺失；"
                    "在固件目录跑 python3 utils/resource/resource_pkg.py font --only noto 后重新 cmake")
endif()

find_package(SDL2 REQUIRED CONFIG)

# ── LVGL：固件 submodule 源码 + 模拟器自己的 lv_conf.h ──
set(LV_BUILD_CONF_PATH "${CMAKE_CURRENT_LIST_DIR}/lv_conf.h" CACHE PATH "sim lv_conf override" FORCE)
option(CONFIG_LV_BUILD_DEMOS "" OFF)
option(CONFIG_LV_BUILD_EXAMPLES "" OFF)
option(CONFIG_LV_USE_THORVG_INTERNAL "" OFF)
add_subdirectory(${FIRMWARE_DIR}/modules/lvgl ${CMAKE_BINARY_DIR}/lvgl)

# lv_sdl_window 需要 SDL 头与库
target_link_libraries(lvgl PUBLIC SDL2::SDL2)

# 同固件 ui/CMakeLists.txt：剔除用不到的平台驱动源码（保留 sdl）
get_target_property(lvgl_sources lvgl SOURCES)
foreach(pat nema_gfx nxp opengles renesas vg_lite glfw wayland x11 qnx nuttx uefi windows gltf thorvg)
    list(FILTER lvgl_sources EXCLUDE REGEX ".*${pat}.*")
endforeach()
set_target_properties(lvgl PROPERTIES SOURCES "${lvgl_sources}")

# 同固件：lv_font_manager_recycle C23 返回值 bug 补丁（clang 下同样需要）
# 注意：不能用 list(REMOVE_ITEM ... ${FIRMWARE_DIR}/...) —— FIRMWARE_DIR 含未规范化的
# "../" 路径段，而 lvgl 注册进 SOURCES 的是规范化绝对路径，字符串不相等会 silent miss。
# 改用 FILTER 正则按文件名尾部匹配，并断言确实剔除了原文件。
get_target_property(lvgl_sources lvgl SOURCES)
list(LENGTH lvgl_sources _lvgl_src_count_before)
list(FILTER lvgl_sources EXCLUDE REGEX "font_manager/lv_font_manager_recycle\\.c$")
list(LENGTH lvgl_sources _lvgl_src_count_after)
if(NOT _lvgl_src_count_after EQUAL _lvgl_src_count_before)
    # 原文件确实被剔除，挂上固件补丁版
    set_target_properties(lvgl PROPERTIES SOURCES "${lvgl_sources}")
    target_sources(lvgl PRIVATE ${FIRMWARE_DIR}/ui/lvgl_port/workarounds/lv_font_manager_recycle.c)
    set_property(
        SOURCE ${FIRMWARE_DIR}/ui/lvgl_port/workarounds/lv_font_manager_recycle.c
        TARGET_DIRECTORY lvgl APPEND
        PROPERTY INCLUDE_DIRECTORIES ${FIRMWARE_DIR}/modules/lvgl/src/font/font_manager
    )
else()
    message(FATAL_ERROR "lv_font_manager_recycle.c 未在 lvgl SOURCES 中匹配到，补丁机制失效，请检查 lvgl 版本")
endif()

# ── Shadow page_manager（Mach-O 适配，固件零改动） ──
# 固件 dev 分支的页面注册走 ELF 自定义段：
#   - page_manager.h 的 PAGE_REGISTER_WITH_FLAGS 宏: section(".page_registry")（ELF 单段语法，macOS clang 报错）
#   - page_manager.c 通过 linkerscript 提供的 __page_registry__start/__end 符号枚举该段
# Mach-O 等价改写（configure 时生成 shadow 拷贝，include 优先级置于固件目录之前）：
#   - 段名换成 "__DATA,__pg_reg"（Mach-O segment,section 语法，section 名 ≤16 字符）
#   - 段边界符号用 ld64 魔法符号 section$start$__DATA$__pg_reg / section$end$...（asm 标签绑定，无需运行时 getsectiondata）
set(SHADOW_DIR ${CMAKE_BINARY_DIR}/shadow)
set(PM_SRC_DIR ${FIRMWARE_DIR}/tasks/task_foreground/page_manager)

file(READ ${PM_SRC_DIR}/page_manager.h _pm_h)
string(FIND "${_pm_h}" "section(\".page_registry\")" _pm_h_pos)
if(_pm_h_pos EQUAL -1)
    message(FATAL_ERROR "page_manager.h 未找到 section(\".page_registry\")，固件结构变了，shadow 机制需要更新")
endif()
string(REPLACE "section(\".page_registry\")" "section(\"__DATA,__pg_reg\")" _pm_h "${_pm_h}")
file(WRITE ${SHADOW_DIR}/page_manager/page_manager.h "${_pm_h}")

file(READ ${PM_SRC_DIR}/page_manager.c _pm_c)
string(FIND "${_pm_c}" "extern const PageDescriptor_t __page_registry__start[];" _pm_c_pos)
if(_pm_c_pos EQUAL -1)
    message(FATAL_ERROR "page_manager.c 未找到 __page_registry__start 声明，固件结构变了，shadow 机制需要更新")
endif()
string(REPLACE
    "extern const PageDescriptor_t __page_registry__start[];"
    "extern const PageDescriptor_t __page_registry__start[] __asm(\"section$start$__DATA$__pg_reg\");"
    _pm_c "${_pm_c}")
string(REPLACE
    "extern const PageDescriptor_t __page_registry__end[];"
    "extern const PageDescriptor_t __page_registry__end[] __asm(\"section$end$__DATA$__pg_reg\");"
    _pm_c "${_pm_c}")
file(WRITE ${SHADOW_DIR}/page_manager/page_manager.c "${_pm_c}")

# page_id.h 原样拷贝进 shadow 目录，保证 shadow page_manager.h 的 #include "page_id.h" 能解析
configure_file(${PM_SRC_DIR}/page_id.h ${SHADOW_DIR}/page_manager/page_id.h COPYONLY)

# 阶段B step2/3 共用: 不支持页面子目录排除清单（正则按路径尾匹配）。空 = 全部尝试编入。
# 逐个排查链接缺符号后，确实无法以薄 stub 覆盖的子目录在此登记并注释原因。
# 必须定义在 step3 生成器调用之前（CMake 顺序求值）+ step2 GLOB 过滤复用同一变量。
set(SIM_PAGES_UNSUPPORTED
    # my_address：依赖生成的 protobuf 头 legacy/messages_uiview.pb.h（源码不存在，
    # 真机由 nanopb 生成）+ sys/ipc/channel/channel.h（IPC 通道），编译期不可解析。
    "pages/my_address/"
    # ui_view（sign/verify tx 审批流）：approval_txconfirm/approval_verify 依赖生成的
    # legacy/messages_uiview.pb.h（nanopb 产物），sign_page/verify_page 又传递依赖它 +
    # ui_msg_queue/IPC，整子树编译期不可解析。注册的 PAGE_ID_SIGN_PAGE/PAGE_ID_VERIFY_PAGE
    # 走真机审批流入口，无独立 UI，sim 无法离线打开。
    "pages/ui_view/"
    # SeedCard 备份/恢复/管理页（d10b3be2 起）：接上真实 BG NFC 触发 API，
    # 依赖 tasks/task_background/manager/background_manager.h → sys.h → hal.h 整条硬件链，
    # 编译期不可解析。
    # portfolio_data（7b39e210 起）：依赖 filesystem.h（vol1: 文件系统），homescreen
    # 引用的三个查询函数在 sim_stubs_pages.c 给"无数据"桩
    "pages/standalone/portfolio_data\\.c$"
    # QR 扫码/连接钱包页（7b39e210 起）：依赖 zbus/camera/qr_transport 整条硬件链
    "pages/connect_app_wallet/"
    "pages/scan/"
    "pages/qr_result/"
    "pages/qr_test/"
    # onboarding SeedCard 备份链（04538b95 批次起）：同样依赖 backup_card_types.h/BG NFC
    "pages/onboarding/onboarding_backup\\.c$"
    "pages/backup/manage_card\\.c$"
    "pages/backup/seedcard_steps\\.c$"
    "pages/backup/seedcard_name_flow\\.c$"
    "pages/backup/seedcard_flow\\.c$"
    "pages/backup/restore_seedcard\\.c$"
)

# ── 阶段B step3: 重建全量页面注册表（configure 时跑 gen_page_list.py）──
# 解析固件 page_id.h + 各 page .c 的 PAGE_REGISTER → build/generated/page_list.inc
# （{id_str, name_zh, PAGE_ID 枚举, supported}），src/page_registry.c #include 它。
# 注意：UNSUPPORTED 正则列表用 ; 转 , 传给 python（CMake list 分隔符是 ;）。
set(PAGE_LIST_INC ${CMAKE_BINARY_DIR}/generated/page_list.inc)
string(REPLACE ";" "," SIM_PAGES_UNSUPPORTED_CSV "${SIM_PAGES_UNSUPPORTED}")
find_program(PYTHON3 NAMES python3 python REQUIRED)
execute_process(
    COMMAND ${PYTHON3} ${CMAKE_CURRENT_LIST_DIR}/tools/gen_page_list.py
            ${FIRMWARE_DIR} ${PAGE_LIST_INC} "${SIM_PAGES_UNSUPPORTED_CSV}"
    RESULT_VARIABLE _genrc
    OUTPUT_VARIABLE _genout
)
if(NOT _genrc EQUAL 0)
    message(FATAL_ERROR "gen_page_list.py 失败: ${_genout}")
endif()
message(STATUS "${_genout}")
# page_id.h / gen 脚本 / 任一 page 源码变更时重新 configure（重生成 page_list.inc）
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_LIST_DIR}/tools/gen_page_list.py)

# 固件 page_manager 源文件变更时自动重新 configure（重新生成 shadow）
# 注：page_id.h 不能再列进来 —— configure_file 已为它注册了重 configure 依赖，
# 重复登记会让 ninja 生成两条同输出 edge 报 "defined as an output multiple times"
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
    ${PM_SRC_DIR}/page_manager.h ${PM_SRC_DIR}/page_manager.c)

# ── 模拟器可执行 ──
add_executable(onekey-sim
    src/main.c src/demo_catalog.c src/sim_stubs.c src/sim_stubs_pages.c src/page_registry.c src/snapshot.c src/sim_demo_args.c
    ${SHADOW_DIR}/page_manager/page_manager.c
)
target_include_directories(onekey-sim PRIVATE src ${CMAKE_BINARY_DIR}/generated)
# snapshot.c 用内存版 lodepng_encode32（见 snapshot.c 注释：_file API 走 lv_fs 需盘符，故避开）
target_include_directories(onekey-sim PRIVATE
    ${FIRMWARE_DIR}/modules/lvgl/src/libs/lodepng
)
target_link_libraries(onekey-sim PRIVATE lvgl SDL2::SDL2 m pthread)

# ── 固件真实 UI 源码（只读引用） ──
# 阶段 A 编译集（策略 b：业务/任务层 .c 不编入，缺符号在 src/sim_stubs.c 给最小假实现）：
#   - ui/components + ui/font：纯 UI 层，外部依赖只有 debug_log.h / bip39.h（均 header-only 可解析）
#   - tasks/task_foreground/pages/standalone/homescreen.c：阶段 A 唯一注册页面
#   - page_manager.c 用上面的 shadow 拷贝
# 阶段B step1: 纳入 ui/page_template + ui/templates（纯 UI 框架层）
file(GLOB_RECURSE FIRMWARE_UI_SOURCES CONFIGURE_DEPENDS
    ${FIRMWARE_DIR}/ui/components/*.c
    ${FIRMWARE_DIR}/ui/font/*.c
    ${FIRMWARE_DIR}/ui/page_template/*.c
    ${FIRMWARE_DIR}/ui/templates/*.c
    ${FIRMWARE_DIR}/ui/language/*.c          # i18n 运行时（lv_translation + JSON fallback）
)

# 阶段B step2: 纳入全量 pages/**（全量页面注册表）。策略 b：业务/任务层 .c
# （task_foreground 根文件、utils/、ui_state_cache 等，依赖 zbus/ipc/SE）不编入，
# pages 链接缺的业务符号在 src/sim_stubs.c 给最小假实现。
# 依赖过深编不过的 page 子目录从下面 EXCLUDE 列表剔除（记入报告 unsupported）。
file(GLOB_RECURSE FIRMWARE_PAGE_SOURCES CONFIGURE_DEPENDS
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/*.c
)
# homescreen 已显式编入（下方），避免重复
list(FILTER FIRMWARE_PAGE_SOURCES EXCLUDE REGEX "pages/standalone/homescreen\\.c$")
# 阶段B 不支持的页面子目录（依赖深到 stub 面爆炸/编不过）——记入报告 unsupported
foreach(_excl ${SIM_PAGES_UNSUPPORTED})
    list(FILTER FIRMWARE_PAGE_SOURCES EXCLUDE REGEX "${_excl}")
endforeach()

target_sources(onekey-sim PRIVATE
    ${FIRMWARE_UI_SOURCES}
    ${FIRMWARE_PAGE_SOURCES}
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/standalone/homescreen.c
    # sign_page.c 单独编入：它只依赖 UI 组件 + SignPageConfig_t（不碰 ui_view 的 protobuf），
    # 是真实交易确认页（PAGE_ID_SIGN_PAGE）。整个 pages/ui_view/ 被排除是因 approval_txconfirm
    # 依赖 messages_uiview.pb.h；sign_page 本身干净，故白名单回来供 --demo-tx 渲染真实结构。
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/ui_view/sign/sign_page.c
    # sign_data_page（PAGE_ID_SIGN_DATA_VIEW，sign_page "View Data" 按钮跳转目标）与
    # view_sign_page_details（Details 卡片分组，纯查表）同为纯 UI，无 protobuf/IPC 依赖
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/ui_view/sign/sign_data_page.c
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/ui_view/sign/view_sign_page_details.c
    # my_address 真实地址展示页（PAGE_ID_ADDRESS_DISPLAY）：分块地址(LIST_ITEM_PRIVATE_KEY 绿/白
    # recolor) + 派生行 + QR Code。整个 pages/my_address/ 被排除是因 my_address_display.h 依赖生成的
    # legacy/messages_uiview.pb.h（用 tools/sim_shims 占位）且 my_address_session.c 依赖 zbus/channel/
    # nanopb（在 sim_stubs_pages.c 给桩）。其余 UI-only 文件白名单回来供 --demo-myaddress 渲染真实页面。
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/my_address/my_address_display.c
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/my_address/addr_format.c
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/my_address/derive_names.c
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/my_address/derive_select.c
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/my_address/address_select_network.c
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/my_address/address_select_account.c
    ${FIRMWARE_DIR}/modules/trezor-crypto/bip39_english.c  # 纯词表数据，keyboard_mnemonic 联想用
    ${FIRMWARE_DIR}/hal/utils/cJSON.c        # i18n 翻译 JSON 解析
    ${FIRMWARE_DIR}/tasks/task_foreground/ui_touch_id_indicator.c  # 纯 UI 组件（指纹图标动效）
)
target_include_directories(onekey-sim PRIVATE
    ${SHADOW_DIR}                              # shadow page_manager/ 必须排在固件 task_foreground 之前
    ${FIRMWARE_DIR}/ui                         # <styles/...> <assets/...> <font/...> <templates/...> <page_template/...>
    ${FIRMWARE_DIR}/ui/components              # <hero_icon/hero_icon.h> 等
    ${FIRMWARE_DIR}/ui/page_template           # "page_sheet/..." 等（page_template.c 内部相对引用）
    ${FIRMWARE_DIR}/ui/templates               # "menu_page.h" "txdetails_keys.h" 等（templates 内部相对引用）
    ${FIRMWARE_DIR}/ui/font                    # <ui_font_manager.h>（src/main.c 直接引）
    ${FIRMWARE_DIR}/ui/language                # <ui_language.h> <i18n_tags.h>（i18n 运行时）
    ${FIRMWARE_DIR}/ui/resource                # <resource_manager.h>（ui_language.c 引，符号在 sim_stubs）
    ${FIRMWARE_DIR}/ui/lvgl_port               # <lv_port_slide_compositor.h>（page_manager/homescreen 引，符号在 sim_stubs）
    ${FIRMWARE_DIR}/sys/payload_package        # resource_manager.h 传递引用（仅取类型/常量）
    ${FIRMWARE_DIR}/tasks/task_foreground      # "ui_state_cache.h" "ui_msg_queue.h" "page_manager/..." 等
    ${FIRMWARE_DIR}/tasks/task_foreground/pages          # "factory/pin/set_pin.h" 等跨目录相对引用根
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/common    # "language_loading.h" 等公共页组件
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/backup    # "seedcard_steps.h" 等同目录引用
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/settings  # "settings_layout.h" 等
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/settings/passphrase
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/onboarding
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/my_address
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/factory
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/factory/pin
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/factory/mnemonic
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/factory/passphrase
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/factory/name
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/security_keys
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/ui_view/sign
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/ui_view/verify
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/standalone
    ${FIRMWARE_DIR}/hal/utils                  # <debug_log.h>（header-only 宏，符号在 sim_stubs）
    ${FIRMWARE_DIR}/sys                        # <ipc/messages/msg_sysctrl.h>
    ${FIRMWARE_DIR}/sys/ipc                    # msg_sysctrl.h 内部 <messages/msg_common.h>
    ${FIRMWARE_DIR}/modules/trezor-crypto      # <bip39.h>（keyboard_mnemonic 仅取常量）
    ${FIRMWARE_DIR}/hal/crypto                  # <crypto.h>（mnemonic 页 include 但不调用，仅取类型/声明）
    ${CMAKE_CURRENT_LIST_DIR}/tools/sim_shims   # <FreeRTOS.h> <task.h> 空头 + latest/messages_device_control.pb.h 占位
)
# 全局 -include（顺序：util_macros 先于 debug_log）：
#  - util_macros.h：固件源码裸用 UNUSED()/MIN()/ARRAY_SIZE() 等宏（真机全局注入），自包含无 ARM 依赖
#  - debug_log.h：固件部分 settings 页面用 LOG_INFO/LOG_DEBUG 宏但未直接 include（真机靠 FreeRTOS.h→...链路传递）
# 注意：两个 -include 必须写在同一个 target_compile_options 调用里并放进 SHELL: 包裹，
# 否则 CMake 会把它们当成可去重选项拆开重排，触发 clang "cannot specify -o when generating
# multiple output files"（误判为多 PCH 输出）。
target_compile_options(onekey-sim PRIVATE
    "SHELL:-include ${FIRMWARE_DIR}/hal/utils/util_macros.h"
    "SHELL:-include ${FIRMWARE_DIR}/hal/utils/debug_log.h"
)
# Pro 2 机型选择：ui_font_manager.c 等用 MODULE_HAL_TYPE 区分 PRO1/PRO2 字号表。
# 真机由 hal_config_pro2_v2.h 定义（含 STM32 依赖，sim 不可 include），此处直接给等价宏。
target_compile_definitions(onekey-sim PRIVATE
    MODULE_HAL_TYPE_PRO1=10
    MODULE_HAL_TYPE_PRO2_V1=21
    MODULE_HAL_TYPE_PRO2_V2=22
    MODULE_HAL_TYPE_PRO2_V3=23
    MODULE_HAL_TYPE=22
)
