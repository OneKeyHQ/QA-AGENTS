#pragma once
// sim shim：遮蔽固件 hal/soc/soc_cache.h（Cortex-M7 D-cache 维护）。
// host 无 dcache，全部空实现（sim_hw_shims.c）。compositor_memory.c / asset_progress_bar.c
// 等在写完像素 buffer 后 clean/invalidate dcache，调用保留、无副作用。
#include <stdint.h>
#include <stdbool.h>

void soc_dcache_clean_aligned(uint8_t* data, uint32_t len);
void soc_dcache_invalidate_aligned(uint8_t* data, uint32_t len);
void soc_dcache_clean_invalidate_aligned(uint8_t* data, uint32_t len);
void soc_dcache_clean_all(void);
void soc_dcache_invalidate_all(void);
void soc_dcache_clean_invalidate_all(void);
