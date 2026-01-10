/**
 * 缓存管理功能模块
 */

const CACHE_PREFIX = "comfyui-find-models-cache-";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 一周

// 获取缓存键
export function getCacheKey(modelName) {
    return CACHE_PREFIX + modelName.toLowerCase().trim();
}

// 从缓存获取搜索结果
export function getCachedResults(modelName) {
    try {
        const cacheKey = getCacheKey(modelName);
        const cached = localStorage.getItem(cacheKey);
        
        if (!cached) {
            return null;
        }
        
        // 快速检查：先检查前几个字符是否包含时间戳信息
        // 使用 try-catch 包裹 JSON.parse，避免解析大对象时的阻塞
        let cacheData;
        try {
            cacheData = JSON.parse(cached);
        } catch (e) {
            // 如果解析失败，删除损坏的缓存
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        const now = Date.now();
        
        // 检查是否过期（一周）
        if (now - cacheData.timestamp > CACHE_DURATION) {
            // 缓存已过期，异步删除（不阻塞）
            setTimeout(() => localStorage.removeItem(cacheKey), 0);
            return null;
        }
        
        // console.log(`[ComfyUI-find-models] 使用缓存结果: ${modelName}`);
        return cacheData.results;
    } catch (error) {
        // console.error(`[ComfyUI-find-models] 读取缓存失败: ${error}`);
        return null;
    }
}

// 保存搜索结果到缓存
export function setCachedResults(modelName, results) {
    try {
        const cacheKey = getCacheKey(modelName);
        const cacheData = {
            timestamp: Date.now(),
            results: results
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        // console.log(`[ComfyUI-find-models] 缓存搜索结果: ${modelName}`);
    } catch (error) {
        // console.error(`[ComfyUI-find-models] 保存缓存失败: ${error}`);
        // 如果存储空间不足，异步清理过期缓存（不阻塞）
        if (error.name === 'QuotaExceededError') {
            setTimeout(() => clearExpiredCache(), 0);
        }
    }
}

// 清理过期的缓存（优化性能，异步执行）
export function clearExpiredCache() {
    // 使用 requestIdleCallback 或 setTimeout 异步执行，不阻塞主线程
    const executeCleanup = () => {
        try {
            const now = Date.now();
            const keysToRemove = [];
            const maxCheck = 100; // 限制每次检查的数量，避免阻塞
            
            // 只检查前 maxCheck 个缓存项
            let checked = 0;
            for (let i = 0; i < localStorage.length && checked < maxCheck; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    checked++;
                    try {
                        const cached = localStorage.getItem(key);
                        if (cached) {
                            // 快速检查：只解析时间戳部分
                            const cacheData = JSON.parse(cached);
                            if (now - cacheData.timestamp > CACHE_DURATION) {
                                keysToRemove.push(key);
                            }
                        }
                    } catch (e) {
                        // 如果解析失败，也删除
                        keysToRemove.push(key);
                    }
                }
            }
            
            // 批量删除
            keysToRemove.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    // 忽略删除错误
                }
            });
            
            if (keysToRemove.length > 0) {
                // console.log(`[ComfyUI-find-models] 清理了 ${keysToRemove.length} 个过期缓存`);
            }
            
            // 如果还有更多缓存项需要检查，继续异步检查
            if (checked >= maxCheck && localStorage.length > checked) {
                setTimeout(executeCleanup, 100);
            }
        } catch (error) {
            // console.error(`[ComfyUI-find-models] 清理过期缓存失败: ${error}`);
        }
    };
    
    // 使用 requestIdleCallback 如果可用，否则使用 setTimeout
    if (window.requestIdleCallback) {
        requestIdleCallback(executeCleanup, { timeout: 1000 });
    } else {
        setTimeout(executeCleanup, 0);
    }
}

// 清除指定模型的缓存
export function clearModelCache(modelName) {
    try {
        const cacheKey = getCacheKey(modelName);
        localStorage.removeItem(cacheKey);
        // console.log(`[ComfyUI-find-models] 已清除模型缓存: ${modelName}`);
    } catch (error) {
        // console.error(`[ComfyUI-find-models] 清除模型缓存失败: ${error}`);
    }
}
