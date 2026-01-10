/**
 * ComfyUI Find Models - 前端界面
 * 在ComfyUI界面中添加按钮和弹窗显示模型状态
 * 所有逻辑在前端完成，不依赖后端API
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createDialog } from "./components/Dialog.js";
import { renderStatsCards } from "./components/StatsCards.js";
import { renderTableHeader, renderTableFooter } from "./components/TableHeader.js";
import { renderModelRow } from "./components/ModelRow.js";
import { renderLoadingState, renderSearchProgress, renderErrorState, renderNoWorkflowState } from "./components/LoadingState.js";
import { renderSpinner, ensureSpinnerStyle } from "./components/Spinner.js";
import { renderLocalPath } from "./components/LocalPath.js";
import { renderModelPageLinks } from "./components/ModelPageLinks.js";
import { renderDownloadLinks } from "./components/DownloadLinks.js";
import { 
    extractModelsFromWorkflow, 
    MODEL_TYPE_TO_DIR, 
    checkModelStatus,
    buildLocalPath
} from "./workflowModelExtractor.js";
import { t, getCurrentLanguage } from "./i18n/i18n.js";

// 版本号
let VERSION = "1.0.0";

// 从 ComfyUI API 获取 extra_model_paths 配置
async function getExtraModelPaths() {
    try {
        const response = await api.fetchApi("/comfyui-find-models/api/v1/system/extra-model-paths");
        if (!response.ok) {
            console.warn(`[ComfyUI-find-models] 获取 extra_model_paths 失败: ${response.status}`);
            return null;
        }
        const data = await response.json();
        
        // 优先使用 merged 数据，如果没有则使用 from_folder_paths
        const result = data.merged || data.from_folder_paths || data.from_yaml_file || null;
        
        if (result) {
            console.log(`[ComfyUI-find-models] 获取到 extra_model_paths 配置，包含类型:`, Object.keys(result));
        }
        
        return result;
    } catch (error) {
        console.warn("[ComfyUI-find-models] 获取 extra_model_paths 配置失败:", error);
        return null;
    }
}

// 从 ComfyUI API 获取已安装的模型列表
async function getInstalledModels() {
    try {
        // 使用 ComfyUI 的 object_info API 获取模型列表
        const response = await api.fetchApi("/object_info");
        if (!response.ok) {
            throw new Error(`获取模型列表失败: ${response.status}`);
        }
        
        const objectInfo = await response.json();
        const installed = {
            "主模型": [],
            "VAE": [],
            "文本编码器": [],
            "CLIP": [],
            "CLIP Vision": [],
            "ControlNet": [],
            "IP-Adapter": [],
            "LoRA": [],
            "放大模型": [],
            "其他": []
        };
        
        // 辅助函数：确保值是字符串数组
        function ensureStringArray(arr) {
            if (!Array.isArray(arr)) {
                return [];
            }
            return arr.map(item => {
                if (typeof item === "string") {
                    return item;
                } else if (typeof item === "object" && item !== null) {
                    // 如果是对象，尝试获取 name 或 value 属性
                    return item.name || item.value || String(item);
                } else {
                    return String(item);
                }
            }).filter(item => item && typeof item === "string");
        }
        
        // 从 object_info 中提取模型列表
        // ComfyUI 的 object_info 包含各种节点的输入信息，包括模型选择器
        if (objectInfo.CheckpointLoaderSimple && objectInfo.CheckpointLoaderSimple.input) {
            const required = objectInfo.CheckpointLoaderSimple.input.required || {};
            if (required.ckpt_name) {
                installed["主模型"] = ensureStringArray(required.ckpt_name);
            }
        }
        
        if (objectInfo.VAELoader && objectInfo.VAELoader.input) {
            const required = objectInfo.VAELoader.input.required || {};
            if (required.vae_name) {
                installed["VAE"] = ensureStringArray(required.vae_name);
            }
        }
        
        if (objectInfo.CLIPLoader && objectInfo.CLIPLoader.input) {
            const required = objectInfo.CLIPLoader.input.required || {};
            if (required.clip_name) {
                installed["CLIP"] = ensureStringArray(required.clip_name);
            }
        }
        
        if (objectInfo.ControlNetLoader && objectInfo.ControlNetLoader.input) {
            const required = objectInfo.ControlNetLoader.input.required || {};
            if (required.control_net_name) {
                installed["ControlNet"] = ensureStringArray(required.control_net_name);
            }
        }
        
        if (objectInfo.LoraLoader && objectInfo.LoraLoader.input) {
            const required = objectInfo.LoraLoader.input.required || {};
            if (required.lora_name) {
                installed["LoRA"] = ensureStringArray(required.lora_name);
            }
        }
        
        // 尝试从其他节点获取模型列表
        for (const [nodeType, nodeInfo] of Object.entries(objectInfo)) {
            if (nodeInfo && nodeInfo.input) {
                const required = nodeInfo.input.required || {};
                const optional = nodeInfo.input.optional || {};
                
                // 检查所有可能的模型字段
                for (const [field, value] of Object.entries({...required, ...optional})) {
                    if ((field.includes("model") || field.includes("name") || field.includes("lora") || field.includes("vae") || field.includes("clip")) 
                        && Array.isArray(value) && value.length > 0) {
                        const stringArray = ensureStringArray(value);
                        if (stringArray.length > 0) {
                            // 根据字段名和节点类型分类
                            if (field.includes("lora") || nodeType.includes("Lora")) {
                                installed["LoRA"] = [...new Set([...installed["LoRA"], ...stringArray])];
                            } else if (field.includes("vae") || nodeType.includes("VAE")) {
                                installed["VAE"] = [...new Set([...installed["VAE"], ...stringArray])];
                            } else if (field.includes("clip") && !field.includes("vision")) {
                                installed["CLIP"] = [...new Set([...installed["CLIP"], ...stringArray])];
                            } else if (field.includes("control") || nodeType.includes("Control")) {
                                installed["ControlNet"] = [...new Set([...installed["ControlNet"], ...stringArray])];
                            } else if (field.includes("checkpoint") || field.includes("ckpt") || nodeType.includes("Checkpoint")) {
                                installed["主模型"] = [...new Set([...installed["主模型"], ...stringArray])];
                            }
                        }
                    }
                }
            }
        }
        
        return installed;
    } catch (error) {
        console.error("[ComfyUI-find-models] 获取已安装模型列表失败:", error);
        return {
            "主模型": [],
            "VAE": [],
            "文本编码器": [],
            "CLIP": [],
            "CLIP Vision": [],
            "ControlNet": [],
            "IP-Adapter": [],
            "LoRA": [],
            "放大模型": [],
            "其他": []
        };
    }
}


// 按派系分组
function groupByFamily(modelInfo) {
    const byFamily = {};
    
    for (const info of Object.values(modelInfo)) {
        for (const family of info.families) {
            if (!byFamily[family]) {
                byFamily[family] = [];
            }
            byFamily[family].push(info);
        }
    }
    
    return byFamily;
}

// 按类型分组
function groupByType(modelInfo) {
    const byType = {};
    
    for (const info of Object.values(modelInfo)) {
        if (!byType[info.type]) {
            byType[info.type] = [];
        }
        byType[info.type].push(info);
    }
    
    return byType;
}

// 保存当前对话框的结果，用于语言切换时重新渲染
let _currentDialogResult = null;
let _currentDialogContent = null;

// 显示查找模型对话框
function showFindModelsDialog() {
    // 使用组件创建对话框
    const { modal, content } = createDialog(VERSION);
    _currentDialogContent = content;
    _currentDialogResult = null; // 重置结果
    
    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
            _currentDialogContent = null;
            _currentDialogResult = null;
        }
    };
    
    // 初始加载状态
    content.innerHTML = renderLoadingState(t('analyzingWorkflow'));
    
    // 获取当前工作流并分析
    analyzeCurrentWorkflow(content);
    
    // 监听语言变更事件，重新渲染内容
    const languageChangeHandler = () => {
        // 如果内容已加载，重新渲染整个内容（包括统计卡片、表格等）
        if (_currentDialogContent && _currentDialogResult) {
            displayModelStatus(_currentDialogContent, _currentDialogResult);
        }
    };
    window.addEventListener('comfyui-find-models-language-changed', languageChangeHandler);
    
    // 当对话框关闭时，移除事件监听器
    const originalRemove = modal.remove.bind(modal);
    modal.remove = function() {
        window.removeEventListener('comfyui-find-models-language-changed', languageChangeHandler);
        _currentDialogContent = null;
        _currentDialogResult = null;
        originalRemove();
    };
}

// 缓存管理函数
const CACHE_PREFIX = "comfyui-find-models-cache-";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 一周（毫秒）

// 获取缓存键
function getCacheKey(modelName) {
    return CACHE_PREFIX + modelName.toLowerCase().trim();
}

// 从缓存获取搜索结果（优化性能）
function getCachedResults(modelName) {
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
        
        // 减少日志输出，提升性能
        // console.log(`[ComfyUI-find-models] 使用缓存结果: ${modelName}`);
        return cacheData.results;
    } catch (error) {
        console.error(`[ComfyUI-find-models] 读取缓存失败: ${error}`);
        return null;
    }
}

// 保存搜索结果到缓存（优化性能）
function setCachedResults(modelName, results) {
    try {
        const cacheKey = getCacheKey(modelName);
        const cacheData = {
            timestamp: Date.now(),
            results: results
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        // 减少日志输出，提升性能
        // console.log(`[ComfyUI-find-models] 缓存搜索结果: ${modelName}`);
    } catch (error) {
        console.error(`[ComfyUI-find-models] 保存缓存失败: ${error}`);
        // 如果存储空间不足，异步清理过期缓存（不阻塞）
        if (error.name === 'QuotaExceededError') {
            setTimeout(() => clearExpiredCache(), 0);
        }
    }
}

// 清理过期的缓存（优化性能，异步执行）
function clearExpiredCache() {
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
                console.log(`[ComfyUI-find-models] 清理了 ${keysToRemove.length} 个过期缓存`);
            }
            
            // 如果还有更多缓存项需要检查，继续异步检查
            if (checked >= maxCheck && localStorage.length > checked) {
                setTimeout(executeCleanup, 100);
            }
        } catch (error) {
            console.error(`[ComfyUI-find-models] 清理过期缓存失败: ${error}`);
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
function clearModelCache(modelName) {
    try {
        const cacheKey = getCacheKey(modelName);
        localStorage.removeItem(cacheKey);
        // 减少日志输出
        // console.log(`[ComfyUI-find-models] 已清除模型缓存: ${modelName}`);
        return true;
    } catch (error) {
        console.error(`[ComfyUI-find-models] 清除模型缓存失败: ${error}`);
        return false;
    }
}

// 重新搜索单个模型并更新表格行
async function refreshModelSearch(modelName, modelType, rowElement) {
    // 清除缓存
    clearModelCache(modelName);
    
    // 找到该行的所有单元格
    const cells = rowElement.querySelectorAll('td');
    if (cells.length < 5) return; // 确保有足够的单元格
    
    const statusCell = cells[1]; // 是否已安装
    const localPathCell = cells[2]; // 本地目录
    const modelPageCell = cells[3]; // 模型页面
    const downloadCell = cells[4]; // 下载链接
    
    // 保存原始内容（用于恢复）
    const originalStatus = statusCell.innerHTML;
    const originalLocalPath = localPathCell.innerHTML;
    const originalModelPage = modelPageCell.innerHTML;
    const originalDownload = downloadCell.innerHTML;
    
    // 显示加载状态（转圈圈）
    ensureSpinnerStyle();
    statusCell.innerHTML = renderSpinner("检查中...");
    localPathCell.innerHTML = renderSpinner("检查中...");
    modelPageCell.innerHTML = renderSpinner("搜索中...");
    downloadCell.innerHTML = renderSpinner("搜索中...");
    
    try {
        // 1. 重新获取已安装模型列表和 extra_model_paths 配置
        const [installedModels, extraModelPaths] = await Promise.all([
            getInstalledModels(),
            getExtraModelPaths()
        ]);
        
        // 2. 重新检查模型状态
        const requiredModels = {
            [modelType]: [modelName]
        };
        const status = checkModelStatus(requiredModels, installedModels, {}, {}, MODEL_TYPE_TO_DIR, extraModelPaths);
        
        // 查找模型信息（checkModelStatus 使用的键格式是 "modelType:modelName"）
        const modelInfoKey = `${modelType}:${modelName}`;
        let modelInfo = status.modelInfo[modelInfoKey];
        
        // 如果找不到，尝试遍历所有键（处理可能的格式差异）
        if (!modelInfo) {
            const modelNameLower = modelName.toLowerCase().trim();
            for (const [key, info] of Object.entries(status.modelInfo)) {
                // 检查键是否匹配（支持 "type:name" 格式或仅 "name" 格式）
                if (key === modelInfoKey || 
                    key.toLowerCase() === modelNameLower ||
                    key.endsWith(`:${modelName}`) ||
                    key.endsWith(`:${modelNameLower}`)) {
                    modelInfo = info;
                    break;
                }
            }
        }
        
        // 如果还是找不到，创建一个默认的模型信息
        if (!modelInfo) {
            console.warn(`[ComfyUI-find-models] 无法找到模型信息: ${modelName} (键: ${modelInfoKey})，使用默认值`);
            // 检查是否在已安装列表中
            const installedList = installedModels[modelType] || [];
            const modelNameLower = modelName.toLowerCase().trim();
            const modelFileName = modelName.split(/[/\\]/).pop().toLowerCase().trim();
            let isInstalled = false;
            let localPath = null;
            
            // 获取 extra_model_paths 配置（如果还没有获取）
            const extraModelPathsForRefresh = await getExtraModelPaths();
            
            for (const installedModel of installedList) {
                const installedModelStr = typeof installedModel === "string" ? installedModel : String(installedModel);
                const installedLower = installedModelStr.toLowerCase().trim();
                const installedFileName = installedModelStr.split(/[/\\]/).pop().toLowerCase().trim();
                
                if (installedFileName === modelFileName || installedLower === modelNameLower) {
                    isInstalled = true;
                    // 使用 buildLocalPath 函数构建路径
                    localPath = buildLocalPath(modelType, installedModelStr, MODEL_TYPE_TO_DIR, extraModelPathsForRefresh);
                    break;
                }
            }
            
            modelInfo = {
                name: modelName,
                type: modelType,
                installed: isInstalled,
                localPath: localPath,
                matchedName: null,
                families: []
            };
        }
        
        // 3. 更新"是否已安装"单元格
        const statusColor = modelInfo.installed ? "#81c784" : "#e57373";
        const statusText = modelInfo.installed ? `✓ ${t('installed')}` : `✗ ${t('missing')}`;
        statusCell.innerHTML = `<span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>`;
        
        // 4. 更新"本地目录"单元格
        localPathCell.innerHTML = renderLocalPath(modelInfo, modelType, MODEL_TYPE_TO_DIR);
        
        // 5. 重新搜索下载链接（跳过缓存）
        const links = await searchModelLinks(modelName, modelType, true);
        
        // 6. 更新"模型页面"单元格
        modelPageCell.innerHTML = renderModelPageLinks(links, modelInfo.installed);
        
        // 7. 更新"下载链接"单元格
        downloadCell.innerHTML = renderDownloadLinks(links, modelName, modelType, modelInfo.installed);

        // 重新绑定事件
        const refreshBtn = downloadCell.querySelector('.refresh-model-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => {
                refreshModelSearch(modelName, modelType, rowElement);
            };
        }
        
        // 更新行背景色
        const rowBgColor = modelInfo.installed ? "#1e2e1e" : "#2e1e1e";
        rowElement.style.background = rowBgColor;

    } catch (error) {
        console.error(`[ComfyUI-find-models] 重新搜索失败: ${error}`);
        // 恢复原始内容
        statusCell.innerHTML = originalStatus;
        localPathCell.innerHTML = originalLocalPath;
        modelPageCell.innerHTML = originalModelPage;
        downloadCell.innerHTML = originalDownload;
    }
}

// 搜索模型链接（通过后端API，带缓存）
async function searchModelLinks(modelName, modelType, skipCache = false) {
    // 先检查缓存（除非跳过缓存）
    if (!skipCache) {
        const cachedResults = getCachedResults(modelName);
        if (cachedResults !== null) {
            return cachedResults;
        }
    }
    
    // 缓存未命中或跳过缓存，进行搜索
    try {
        const response = await api.fetchApi("/comfyui-find-models/api/v1/models/search", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_name: modelName,
                model_type: modelType,
                search_civitai: true,
                search_hf: true,
                search_google: false  // 默认不搜索 Google，只在其他搜索失败时手动添加
            }),
        });
        
        if (response.ok) {
            const data = await response.json();
            const results = data.results || [];
            
            // 保存到缓存（即使结果为空也缓存，避免重复搜索）
            setCachedResults(modelName, results);
            
            return results;
        }
        
        // 请求失败，返回空数组但不缓存
        return [];
    } catch (error) {
        console.error(`[ComfyUI-find-models] 搜索模型链接失败: ${error}`);
        return [];
    }
}

// 分析当前工作流（完全在前端完成）
async function analyzeCurrentWorkflow(contentDiv) {
    try {
        // 步骤 1: 获取当前工作流数据
        const workflow = app.graph.serialize();
        
        if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
            contentDiv.innerHTML = renderNoWorkflowState();
            return;
        }
        
        console.log("[ComfyUI-find-models] 开始分析工作流...");
        
        // 步骤 2: 提取工作流中的模型需求
        const { models: requiredModels, modelUsageMap, modelNodeMap } = extractModelsFromWorkflow(workflow);
        const totalRequired = Object.values(requiredModels).reduce((sum, models) => sum + models.length, 0);
        console.log(`[ComfyUI-find-models] 提取到 ${totalRequired} 个模型需求`);
        
        // 步骤 3: 获取已安装的模型列表和 extra_model_paths 配置
        contentDiv.innerHTML = renderLoadingState(t('gettingInstalledModels'));
        
        const [installedModels, extraModelPaths] = await Promise.all([
            getInstalledModels(),
            getExtraModelPaths()
        ]);
        
        const totalInstalled = Object.values(installedModels).reduce((sum, models) => sum + models.length, 0);
        console.log(`[ComfyUI-find-models] 获取到 ${totalInstalled} 个已安装模型`);
        
        if (extraModelPaths) {
            console.log(`[ComfyUI-find-models] 获取到 extra_model_paths 配置:`, extraModelPaths);
        } else {
            console.log(`[ComfyUI-find-models] 未获取到 extra_model_paths 配置，将使用默认路径`);
        }
        
        // 步骤 4: 检查模型状态（传入使用状态映射、节点映射和 extra_model_paths 配置）
        const status = checkModelStatus(requiredModels, installedModels, modelUsageMap, modelNodeMap, MODEL_TYPE_TO_DIR, extraModelPaths);
        console.log(`[ComfyUI-find-models] 已安装: ${status.installed.length}, 缺失: ${status.missing.length}`);
        
        // 步骤 5: 先显示表格框架（所有模型，缺失的显示加载状态）
        const modelLinks = {};
        const missingModels = Object.values(status.modelInfo).filter(m => !m.installed);
        
        // 批量检查缓存，优先使用缓存的结果（同步执行，快速）
        const modelsToSearch = [];
        for (const model of missingModels) {
            const cached = getCachedResults(model.name);
            if (cached !== null) {
                modelLinks[model.name] = cached;
            } else {
                modelsToSearch.push(model);
            }
        }
        
        // 先显示表格，缺失且没有缓存的模型显示加载状态
        const initialResult = {
            total_required: totalRequired,
            installed_count: status.installed.length,
            missing_count: status.missing.length,
            models: status.modelInfo,
            model_links: modelLinks,
            models_to_search: modelsToSearch.map(m => m.name), // 标记需要搜索的模型
            by_family: groupByFamily(status.modelInfo),
            by_type: groupByType(status.modelInfo),
            required_models: requiredModels,
            installed_models: installedModels
        };
        
        // 先显示表格
        displayModelStatus(contentDiv, initialResult);
        
        // 步骤 6: 为缺失的模型搜索下载链接（每3个一组并行）
        // 只搜索没有缓存的模型，每3个一组并行处理
        if (modelsToSearch.length > 0) {
            const BATCH_SIZE = 3; // 每批处理3个
            
            for (let i = 0; i < modelsToSearch.length; i += BATCH_SIZE) {
                const batch = modelsToSearch.slice(i, i + BATCH_SIZE);
                
                // 在开始搜索前，先显示加载状态
                batch.forEach(model => {
                    showModelRowLoading(contentDiv, model);
                });
                
                // 并行搜索这一批的模型
                const searchPromises = batch.map(async (model) => {
                    try {
                        const links = await searchModelLinks(model.name, model.type);
                        if (links.length > 0) {
                            modelLinks[model.name] = links;
                        }
                        // 实时更新该行的显示
                        updateModelRow(contentDiv, model, links);
                        return { model: model.name, success: true };
                    } catch (error) {
                        console.error(`[ComfyUI-find-models] 搜索模型 ${model.name} 失败:`, error);
                        updateModelRow(contentDiv, model, []);
                        return { model: model.name, success: false };
                    }
                });
                
                // 等待这一批完成
                await Promise.all(searchPromises);
                
                // 批次之间稍作延迟，避免请求过快
                if (i + BATCH_SIZE < modelsToSearch.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }
        
        // 步骤 7: 最终结果（用于统计等）
        const result = {
            total_required: totalRequired,
            installed_count: status.installed.length,
            missing_count: status.missing.length,
            models: status.modelInfo,
            model_links: modelLinks,
            models_to_search: modelsToSearch.map(m => m.name), // 标记需要搜索的模型
            by_family: groupByFamily(status.modelInfo),
            by_type: groupByType(status.modelInfo),
            required_models: requiredModels,
            installed_models: installedModels
        };
        
        // 步骤 8: 最终显示结果（更新表格，按使用状态分组）
        displayModelStatus(contentDiv, result);
        
    } catch (error) {
        contentDiv.innerHTML = renderErrorState(error.message);
        console.error("Find Models Error:", error);
    }
}

// 渲染分隔行（用于区分已使用和未使用的模型）
function renderSeparatorRow() {
    return `
        <tr class="model-separator-row" style="background: #2d2d2d; border-top: 2px solid #555; border-bottom: 2px solid #555;">
            <td colspan="5" style="padding: 16px; text-align: center; color: #999; font-size: 13px; font-style: italic;">
                ${t('unusedModelsSeparator')}
            </td>
        </tr>
    `;
}

// 显示模型状态（表格形式）
function displayModelStatus(contentDiv, result) {
    // 保存当前结果，用于语言切换时重新渲染
    _currentDialogResult = result;
    
    // 确保加载动画样式已添加
    ensureSpinnerStyle();
    
    // 使用组件生成 HTML
    let html = renderStatsCards(result.total_required, result.installed_count, result.missing_count);
    html += renderTableHeader();
    
    // 获取所有模型并按使用状态和安装状态排序
    const allModels = Object.values(result.models);
    
    // 分离已使用和未使用的模型
    // 注意：isUsed 为 undefined 时也视为已使用（默认行为）
    const usedModels = allModels.filter(m => m.isUsed !== false);
    const unusedModels = allModels.filter(m => m.isUsed === false);
    
    console.log(`[ComfyUI-find-models] 模型分组: 已使用=${usedModels.length}, 未使用=${unusedModels.length}`);
    if (unusedModels.length > 0) {
        console.log(`[ComfyUI-find-models] 未使用的模型:`, unusedModels.map(m => m.name));
    }
    
    // 对已使用的模型排序：缺失的在前，然后按名称排序
    usedModels.sort((a, b) => {
        if (a.installed !== b.installed) {
            return a.installed ? 1 : -1; // 缺失的在前
        }
        return a.name.localeCompare(b.name);
    });
    
    // 对未使用的模型排序：缺失的在前，然后按名称排序
    unusedModels.sort((a, b) => {
        if (a.installed !== b.installed) {
            return a.installed ? 1 : -1; // 缺失的在前
        }
        return a.name.localeCompare(b.name);
    });
    
    // 先显示已使用的模型
    for (const model of usedModels) {
        // 获取模型链接
        const links = result.model_links && result.model_links[model.name] ? result.model_links[model.name] : [];
        // 检查是否需要显示加载状态（缺失且没有缓存且需要搜索）
        const needsLoading = !model.installed && 
                            !links.length && 
                            result.models_to_search && 
                            result.models_to_search.includes(model.name);
        // 使用组件生成表格行
        html += renderModelRow(model, links, MODEL_TYPE_TO_DIR, needsLoading);
    }
    
    // 如果有未使用的模型，添加分隔行
    if (unusedModels.length > 0) {
        html += renderSeparatorRow();
        
        // 显示未使用的模型
        for (const model of unusedModels) {
            // 获取模型链接
            const links = result.model_links && result.model_links[model.name] ? result.model_links[model.name] : [];
            // 检查是否需要显示加载状态（缺失且没有缓存且需要搜索）
            const needsLoading = !model.installed && 
                                !links.length && 
                                result.models_to_search && 
                                result.models_to_search.includes(model.name);
            // 使用组件生成表格行
            html += renderModelRow(model, links, MODEL_TYPE_TO_DIR, needsLoading);
        }
    }
    
    html += renderTableFooter();
    
    contentDiv.innerHTML = html;
    
    // 绑定刷新按钮事件
    bindRefreshButtons(contentDiv);
    
    // 绑定高亮节点按钮事件
    bindHighlightButtons(contentDiv);
    
    // 绑定搜索功能
    bindSearchFunctionality(contentDiv);
    
    // 保存原始行顺序（用于恢复排序）
    saveOriginalRowsOrder(contentDiv);
}

// 绑定搜索功能
function bindSearchFunctionality(contentDiv) {
    const searchInput = contentDiv.querySelector('#model-search-input');
    const clearBtn = contentDiv.querySelector('#clear-search-btn');
    
    if (!searchInput) {
        return;
    }
    
    // 搜索输入事件
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        
        if (searchTerm) {
            // 显示清除按钮
            if (clearBtn) {
                clearBtn.style.display = 'block';
            }
            // 执行搜索排序
            searchAndSortModels(contentDiv, searchTerm);
        } else {
            // 隐藏清除按钮
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }
            // 恢复原始顺序
            restoreOriginalOrder(contentDiv);
        }
    });
    
    // 清除按钮事件
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            restoreOriginalOrder(contentDiv);
        });
    }
}

// 存储原始行顺序和分隔行索引
let _originalRowsOrder = null;
let _originalSeparatorIndex = -1;

// 保存原始行顺序
function saveOriginalRowsOrder(contentDiv) {
    const tbody = contentDiv.querySelector('#models-table-body');
    if (!tbody) {
        return;
    }
    // 保存原始行的克隆（深拷贝）
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    _originalSeparatorIndex = allRows.findIndex(row => row.classList.contains('model-separator-row'));
    _originalRowsOrder = allRows.map((row, index) => ({
        row: row.cloneNode(true),
        isSeparator: row.classList.contains('model-separator-row'),
        originalIndex: index
    }));
}

// 恢复原始排序
function restoreOriginalOrder(contentDiv) {
    const tbody = contentDiv.querySelector('#models-table-body');
    if (!tbody || !_originalRowsOrder) {
        return;
    }
    
    // 清空 tbody
    tbody.innerHTML = '';
    
    // 恢复原始顺序
    _originalRowsOrder.forEach(item => {
        tbody.appendChild(item.row.cloneNode(true));
    });
    
    // 重新绑定事件
    bindRefreshButtons(contentDiv);
    bindHighlightButtons(contentDiv);
}

// 搜索并排序模型列表
function searchAndSortModels(contentDiv, searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        restoreOriginalOrder(contentDiv);
        return;
    }
    
    const tbody = contentDiv.querySelector('#models-table-body');
    if (!tbody) {
        return;
    }
    
    // 如果没有保存原始顺序，先保存
    if (!_originalRowsOrder) {
        saveOriginalRowsOrder(contentDiv);
    }
    
    // 从原始顺序开始搜索（使用保存的原始行）
    if (!_originalRowsOrder || _originalRowsOrder.length === 0) {
        return;
    }
    
    // 使用保存的原始行
    const modelRows = _originalRowsOrder.filter(item => !item.isSeparator);
    const separatorRowItem = _originalRowsOrder.find(item => item.isSeparator);
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    // 为每个模型行计算匹配度和使用状态
    const rowsWithScore = modelRows.map((item) => {
        const row = item.row;
        const modelNameCell = row.querySelector('td:first-child');
        if (!modelNameCell) {
            return { row: row.cloneNode(true), score: 0, modelName: '', isUsed: true };
        }
        
        // 获取模型名称（排除按钮和额外信息）
        const nameDiv = modelNameCell.querySelector('div:first-child > div:first-child');
        const modelName = nameDiv ? nameDiv.textContent.trim() : modelNameCell.textContent.trim();
        const modelNameLower = modelName.toLowerCase();
        
        // 判断是否已使用：在原始顺序中，如果分隔行存在，分隔行之前的为已使用，之后的为未使用
        const isUsed = _originalSeparatorIndex === -1 || item.originalIndex < _originalSeparatorIndex;
        
        let score = 0;
        
        // 完全匹配
        if (modelNameLower === searchLower) {
            score = 1000;
        }
        // 开头匹配
        else if (modelNameLower.startsWith(searchLower)) {
            score = 500;
        }
        // 包含匹配
        else if (modelNameLower.includes(searchLower)) {
            score = 100;
        }
        // 部分匹配（单词匹配）
        else {
            const words = modelNameLower.split(/[_\-\s\.]+/);
            const searchWords = searchLower.split(/[_\-\s\.]+/);
            let wordMatchCount = 0;
            for (const searchWord of searchWords) {
                if (words.some(word => word.includes(searchWord))) {
                    wordMatchCount++;
                }
            }
            score = wordMatchCount * 10;
        }
        
        return { row: row.cloneNode(true), score, modelName: modelName, isUsed: isUsed };
    });
    
    // 按使用状态和匹配度排序
    // 排序优先级：1. 使用状态（已使用 > 未使用） 2. 匹配度（匹配 > 不匹配） 3. 匹配分数 4. 名称
    rowsWithScore.sort((a, b) => {
        // 先按使用状态分组：已使用的在前
        if (a.isUsed !== b.isUsed) {
            // 如果 a 是已使用的，b 是未使用的，a 应该在前（返回负数）
            // 如果 a 是未使用的，b 是已使用的，a 应该在后（返回正数）
            return a.isUsed ? -1 : 1;
        }
        
        // 如果使用状态相同，按是否匹配分组：匹配的在前
        const aMatched = a.score > 0;
        const bMatched = b.score > 0;
        if (aMatched !== bMatched) {
            // 如果 a 是匹配的，b 是不匹配的，a 应该在前（返回负数）
            // 如果 a 是不匹配的，b 是匹配的，a 应该在后（返回正数）
            return aMatched ? -1 : 1;
        }
        
        // 如果匹配状态也相同，按匹配分数排序
        if (a.score !== b.score) {
            return b.score - a.score; // 分数高的在前
        }
        
        // 分数相同，按名称排序
        return a.modelName.localeCompare(b.modelName);
    });
    
    // 分离已使用和未使用的行
    // 由于已经按使用状态排序，usedRows 应该在数组前面，unusedRows 在后面
    const usedRows = [];
    const unusedRows = [];
    
    for (const item of rowsWithScore) {
        if (item.isUsed) {
            usedRows.push(item);
        } else {
            unusedRows.push(item);
        }
    }
    
    // 在已使用的行中，匹配的在前，不匹配的在后
    const usedMatchedRows = usedRows.filter(item => item.score > 0).map(item => item.row);
    const usedUnmatchedRows = usedRows.filter(item => item.score === 0).map(item => item.row);
    
    // 在未使用的行中，匹配的在前，不匹配的在后
    const unusedMatchedRows = unusedRows.filter(item => item.score > 0).map(item => item.row);
    const unusedUnmatchedRows = unusedRows.filter(item => item.score === 0).map(item => item.row);
    
    // 清空 tbody
    tbody.innerHTML = '';
    
    // 1. 先添加所有已使用的行（匹配的在前，不匹配的在后）
    if (usedMatchedRows.length > 0 || usedUnmatchedRows.length > 0) {
        usedMatchedRows.forEach(row => tbody.appendChild(row));
        usedUnmatchedRows.forEach(row => tbody.appendChild(row));
    }
    
    // 2. 如果有已使用的行和未使用的行，添加分隔行
    if (usedRows.length > 0 && unusedRows.length > 0 && separatorRowItem) {
        tbody.appendChild(separatorRowItem.row.cloneNode(true));
    }
    
    // 3. 再添加所有未使用的行（匹配的在前，不匹配的在后）
    if (unusedMatchedRows.length > 0 || unusedUnmatchedRows.length > 0) {
        unusedMatchedRows.forEach(row => tbody.appendChild(row));
        unusedUnmatchedRows.forEach(row => tbody.appendChild(row));
    }
    
    // 重新绑定事件（因为 DOM 重新排列了）
    bindRefreshButtons(contentDiv);
    bindHighlightButtons(contentDiv);
}

// 显示模型行的加载状态
function showModelRowLoading(contentDiv, model) {
    const rowId = `model-row-${model.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const row = contentDiv.querySelector(`#${rowId}`);
    
    if (!row) {
        console.warn(`[ComfyUI-find-models] 未找到行元素: ${rowId}`);
        return;
    }
    
    // 确保加载动画样式已添加
    ensureSpinnerStyle();
    
    // 获取行中的单元格
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) {
        console.warn(`[ComfyUI-find-models] 行单元格数量不正确: ${cells.length}`);
        return;
    }
    
    // 更新"模型页面"单元格（第4列，索引3）显示加载状态
    const modelPageCell = cells[3];
    if (modelPageCell) {
        modelPageCell.innerHTML = renderSpinner("搜索中...");
    }
    
    // 更新"下载链接"单元格（第5列，索引4）显示加载状态
    const downloadCell = cells[4];
    if (downloadCell) {
        downloadCell.innerHTML = renderSpinner("搜索中...");
    }
}

// 更新单个模型行的显示
function updateModelRow(contentDiv, model, links) {
    const rowId = `model-row-${model.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const row = contentDiv.querySelector(`#${rowId}`);
    
    if (!row) {
        console.warn(`[ComfyUI-find-models] 未找到行元素: ${rowId}`);
        return;
    }
    
    // 获取行中的单元格
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) {
        console.warn(`[ComfyUI-find-models] 行单元格数量不正确: ${cells.length}`);
        return;
    }
    
    // 更新"模型页面"单元格（第4列，索引3）
    const modelPageCell = cells[3];
    if (modelPageCell) {
        modelPageCell.innerHTML = renderModelPageLinks(links, model.installed);
    }
    
    // 更新"下载链接"单元格（第5列，索引4）
    const downloadCell = cells[4];
    if (downloadCell) {
        downloadCell.innerHTML = renderDownloadLinks(links, model.name, model.type, model.installed);
        // 重新绑定该行的刷新按钮事件
        const refreshBtn = downloadCell.querySelector('.refresh-model-btn');
        if (refreshBtn) {
            refreshBtn.onclick = () => {
                const modelName = refreshBtn.getAttribute('data-model-name');
                const modelType = refreshBtn.getAttribute('data-model-type');
                refreshModelSearch(modelName, modelType, row);
            };
        }
    }
}

// 绑定刷新按钮事件（辅助函数）
function bindRefreshButtons(contentDiv) {
    const refreshButtons = contentDiv.querySelectorAll('.refresh-model-btn');
    refreshButtons.forEach(btn => {
        btn.onclick = () => {
            const modelName = btn.getAttribute('data-model-name');
            const modelType = btn.getAttribute('data-model-type');
            const rowElement = btn.closest('tr');
            if (rowElement && modelName) {
                refreshModelSearch(modelName, modelType, rowElement);
            }
        };
    });
}

// 绑定高亮节点按钮事件
function bindHighlightButtons(contentDiv) {
    const highlightButtons = contentDiv.querySelectorAll('.highlight-node-btn');
    highlightButtons.forEach(btn => {
        btn.onclick = () => {
            // 获取单个节点ID（新的实现方式）
            const nodeIdStr = btn.getAttribute('data-node-id');
            const nodeIndex = btn.getAttribute('data-node-index');
            
            if (nodeIdStr) {
                const nodeId = parseInt(nodeIdStr.trim());
                if (!isNaN(nodeId)) {
                    console.log(`[ComfyUI-find-models] 点击高亮按钮，节点索引: ${nodeIndex}, 节点ID: ${nodeId}`);
                    // 只高亮单个节点
                    highlightNodes([nodeId]);
                }
            } else {
                // 兼容旧的实现方式（如果还有使用 data-node-ids 的按钮）
                const nodeIdsStr = btn.getAttribute('data-node-ids');
                if (nodeIdsStr) {
                    const nodeIds = nodeIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    console.log(`[ComfyUI-find-models] 点击高亮按钮（旧格式），节点IDs: ${nodeIds.join(', ')}`);
                    if (nodeIds.length > 0) {
                        highlightNodes(nodeIds);
                    }
                }
            }
        };
    });
}

// 高亮节点函数
function highlightNodes(nodeIds) {
    if (!app || !app.graph) {
        console.warn("[ComfyUI-find-models] 无法访问 ComfyUI graph");
        return;
    }
    
    try {
        // 清除之前的高亮
        clearNodeHighlights();
        
        // 存储当前高亮的节点ID
        window._highlightedNodeIds = nodeIds;
        
        // 高亮指定的节点
        const nodesToHighlight = [];
        for (const nodeId of nodeIds) {
            // 尝试多种方式获取节点
            let node = app.graph.getNodeById(nodeId);
            if (!node) {
                // 如果直接获取失败，尝试在节点列表中查找
                const allNodes = app.graph._nodes || app.graph.nodes || [];
                node = allNodes.find(n => n.id === nodeId || n.id === String(nodeId));
            }
            
            if (node) {
                nodesToHighlight.push(node);
                console.log(`[ComfyUI-find-models] 找到节点 ID: ${nodeId}, 类型: ${node.type || node.class_type || 'unknown'}`);
                
                // 保存原始绘制函数
                if (!node.oldDrawNode) {
                    node.oldDrawNode = node.onDrawBackground;
                }
                // 备份原始绘制函数
                
                node.onDrawForeground = function(ctx) {
                    // 在节点前景绘制红色粗外框
                    ctx.save();
                    ctx.strokeStyle = "red";
                    ctx.lineWidth = 10; // 设置粗细
                    const margin = 5;   // 外扩边距
                    // 绘制矩形（根据节点尺寸）
                    ctx.strokeRect(
                        -margin, 
                        -LiteGraph.NODE_TITLE_HEIGHT - margin, 
                        this.size[0] + margin * 2, 
                        this.size[1] + LiteGraph.NODE_TITLE_HEIGHT + margin * 2
                    );
                    ctx.restore();
                };
                
                node.setDirtyCanvas(true, true);
                app.canvas.draw(true, true);
            } else {
                console.warn(`[ComfyUI-find-models] 未找到节点 ID: ${nodeId} (类型: ${typeof nodeId})`);
                // 列出所有可用的节点ID用于调试
                if (app.graph._nodes) {
                    const availableIds = app.graph._nodes.map(n => n.id).slice(0, 10);
                    console.log(`[ComfyUI-find-models] 可用的节点ID示例: ${availableIds.join(', ')}`);
                }
            }
        }
        
        if (nodesToHighlight.length > 0) {
            // 定位到第一个节点
            const firstNode = nodesToHighlight[0];

            app.canvas.centerOnNode(firstNode); 

            // 10秒后自动清除高亮
            if (window._highlightTimeout) {
                clearTimeout(window._highlightTimeout);
            }
            window._highlightTimeout = setTimeout(() => {
                clearNodeHighlights();
            }, 10000);
        } else {
            console.warn("[ComfyUI-find-models] 没有找到任何节点进行高亮");
        }
    } catch (error) {
        console.error("[ComfyUI-find-models] 高亮节点时出错:", error);
    }
}

// 清除节点高亮
function clearNodeHighlights() {
    if (!app || !app.graph || !window._highlightedNodeIds) {
        return;
    }
    
    try {
        for (const nodeId of window._highlightedNodeIds) {
            const node = app.graph.getNodeById(nodeId);
            if (node) {
                // 恢复原始颜色
                if (node.oldDrawNode !== undefined) {
                    node.onDrawForeground = node.oldDrawNode;
                }
                node.setDirtyCanvas(true);
            }
        }
        
        window._highlightedNodeIds = null;
        if (window._highlightTimeout) {
            clearTimeout(window._highlightTimeout);
            window._highlightTimeout = null;
        }
    } catch (error) {
        console.error("[ComfyUI-find-models] 清除高亮时出错:", error);
    }
}

// 添加工具栏按钮
function addFindModelsButton() {
    // 尝试多个可能的选择器
    let actionbar = document.querySelector(".actionbar-container");
    if (!actionbar) {
        actionbar = document.querySelector(".comfy-menu");
    }
    if (!actionbar) {
        actionbar = document.querySelector("#comfyui-header");
    }
    if (!actionbar) {
        // 如果都找不到，尝试查找包含按钮的容器
        const header = document.querySelector("header");
        if (header) {
            actionbar = header;
        }
    }
    
    if (!actionbar) {
        console.log("[ComfyUI-find-models] 未找到 actionbar，100ms 后重试...");
        setTimeout(addFindModelsButton, 100);
        return;
    }

    // 检查按钮是否已存在，避免重复添加
    if (document.getElementById("find-models-button")) {
        console.log("[ComfyUI-find-models] 按钮已存在，跳过添加");
        return;
    }

    // 创建按钮
    const button = document.createElement("button");
    button.id = "find-models-button";
    button.textContent = "🔍 find-models";
    button.className = "comfy-menu-button";
    button.style.cssText = `
        margin-left: 10px;
        padding: 8px 16px;
        cursor: pointer;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        z-index: 1000;
        position: relative;
    `;

    button.onclick = () => {
        showFindModelsDialog();
    };

    try {
        actionbar.appendChild(button);
        console.log("[ComfyUI-find-models] 按钮添加成功");
    } catch (error) {
        console.error("[ComfyUI-find-models] 按钮添加失败:", error);
        // 如果添加失败，尝试在 body 中添加
        setTimeout(() => {
            const body = document.body;
            if (body) {
                button.style.position = "fixed";
                button.style.top = "10px";
                button.style.right = "10px";
                button.style.zIndex = "10000";
                body.appendChild(button);
                console.log("[ComfyUI-find-models] 按钮已添加到 body");
            }
        }, 500);
    }
}

// 创建鼠标位置提示工具
function createMousePosTooltip() {
    // 创建 tooltip 元素
    const tooltip = document.createElement("div");
    tooltip.id = "comfyui-find-models-pos-tooltip";
    tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        pointer-events: none;
        z-index: 10000;
        display: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(tooltip);
    
    return tooltip;
}

// 设置鼠标位置提示
function setupMousePosTooltip() {
    if (!app || !app.canvas) {
        console.warn("[ComfyUI-find-models] Canvas 未就绪，延迟设置鼠标位置提示");
        setTimeout(setupMousePosTooltip, 500);
        return;
    }
    
    const tooltip = createMousePosTooltip();
    const canvas = app.canvas;
    
    // 尝试多种方式获取 canvas DOM 元素
    let canvasElement = null;
    if (canvas.canvas) {
        canvasElement = canvas.canvas;
    } else if (canvas.domElement) {
        canvasElement = canvas.domElement;
    } else if (canvas.node && canvas.node.nodeName === 'CANVAS') {
        canvasElement = canvas.node;
    } else if (canvas instanceof HTMLElement) {
        canvasElement = canvas;
    } else {
        // 尝试从 document 中查找 canvas 元素
        canvasElement = document.querySelector('canvas.lgraphcanvas, canvas[data-litegraph]');
    }
    
    if (!canvasElement) {
        console.warn("[ComfyUI-find-models] 无法找到 canvas 元素，延迟重试");
        setTimeout(setupMousePosTooltip, 500);
        return;
    }
    
    // 监听鼠标移动事件
    canvasElement.addEventListener("mousemove", (e) => {
        try {
            // 获取鼠标在 canvas 中的位置
            let pos = null;
            
            // 方法1: 使用 LiteGraph 的内置方法
            if (canvas.convertEventToCanvasOffset) {
                pos = canvas.convertEventToCanvasOffset(e);
            } 
            // 方法2: 使用 graph_mouse 属性（如果可用）
            else if (canvas.graph_mouse && Array.isArray(canvas.graph_mouse)) {
                pos = canvas.graph_mouse;
            } 
            // 方法3: 使用 getCanvasMenuPos 方法
            else if (canvas.getCanvasMenuPos && typeof canvas.getCanvasMenuPos === 'function') {
                pos = canvas.getCanvasMenuPos(e);
            } 
            // 方法4: 手动计算位置（考虑缩放和偏移）
            else {
                const rect = canvasElement.getBoundingClientRect();
                const clientX = e.clientX - rect.left;
                const clientY = e.clientY - rect.top;
                
                // 获取画布的缩放和偏移信息
                // LiteGraph 中通常使用 ds.offset 和 ds.scale
                let scale = 1;
                let offset = [0, 0];
                
                if (canvas.ds) {
                    scale = canvas.ds.scale || 1;
                    offset = canvas.ds.offset || [0, 0];
                } else if (canvas.offset) {
                    offset = Array.isArray(canvas.offset) ? canvas.offset : [canvas.offset[0] || 0, canvas.offset[1] || 0];
                    scale = canvas.scale || 1;
                }
                
                // 计算在画布坐标系统中的位置
                // 先转换到画布坐标系，然后应用缩放和偏移
                pos = [
                    (clientX - offset[0]) / scale,
                    (clientY - offset[1]) / scale
                ];
            }
            
            if (pos && Array.isArray(pos) && pos.length >= 2) {
                const posX = Math.round(pos[0]);
                const posY = Math.round(pos[1]);
                
                // 更新 tooltip 内容
                tooltip.textContent = `Pos: [${posX}, ${posY}]`;
                
                // 显示 tooltip 并定位到鼠标附近
                tooltip.style.display = "block";
                tooltip.style.left = (e.clientX + 15) + "px";
                tooltip.style.top = (e.clientY + 15) + "px";
            } else {
                // 如果无法获取位置，隐藏 tooltip
                tooltip.style.display = "none";
            }
        } catch (error) {
            // 静默处理错误，避免干扰正常使用
            console.debug("[ComfyUI-find-models] 获取鼠标位置失败:", error);
            tooltip.style.display = "none";
        }
    });
    
    // 鼠标离开 canvas 时隐藏 tooltip
    canvasElement.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
    
    console.log("[ComfyUI-find-models] 鼠标位置提示已启用");
}

// 初始化
app.registerExtension({
    name: "ComfyUI.FindModels",
    async setup() {
        console.log("[ComfyUI-find-models] 扩展初始化开始");
        
        // 异步清理过期缓存，不阻塞初始化
        setTimeout(() => clearExpiredCache(), 1000);
        
        // 获取版本信息
        try {
            const response = await api.fetchApi("/comfyui-find-models/api/v1/system/version");
            if (response.ok) {
                const data = await response.json();
                VERSION = data.version || VERSION;
                console.log(`[ComfyUI-find-models] 版本: ${VERSION}`);
            }
        } catch (error) {
            console.warn("[ComfyUI-find-models] 获取版本信息失败:", error);
        }
        
        // 延迟添加按钮，确保 DOM 已加载
        setTimeout(() => {
            addFindModelsButton();
        }, 500);
        
        // 设置鼠标位置提示
        // setTimeout(() => {
        //     setupMousePosTooltip();
        // }, 500);
        
        // 如果 500ms 后还没添加成功，再试一次
        setTimeout(() => {
            if (!document.getElementById("find-models-button")) {
                console.log("[ComfyUI-find-models] 按钮仍未添加，再次尝试...");
                addFindModelsButton();
            }
        }, 2000);
        
        // 如果 canvas 还没准备好，再试一次设置鼠标位置提示
        // setTimeout(() => {
        //     if (!document.getElementById("comfyui-find-models-pos-tooltip")) {
        //         setupMousePosTooltip();
        //     }
        // }, 2000);
    },
});
