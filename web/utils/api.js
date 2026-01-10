/**
 * API 相关功能模块
 */

import { api } from "../../../scripts/api.js";
import { MODEL_FILE_EXTENSIONS } from "../workflowModelExtractor.js";

// 从 ComfyUI API 获取 extra_model_paths 配置
export async function getExtraModelPaths() {
    try {
        const response = await api.fetchApi("/comfyui-find-models/api/v1/system/extra-model-paths");
        if (!response.ok) {
            // console.warn(`[ComfyUI-find-models] 获取 extra_model_paths 失败: ${response.status}`);
            return null;
        }
        const data = await response.json();
        
        // 优先使用 merged 数据，如果没有则使用 from_folder_paths
        const result = data.merged || data.from_folder_paths || data.from_yaml_file || null;
        
        if (result) {
            // console.log(`[ComfyUI-find-models] 获取到 extra_model_paths 配置，包含类型:`, Object.keys(result));
        }
        
        return result;
    } catch (error) {
        // console.warn("[ComfyUI-find-models] 获取 extra_model_paths 配置失败:", error);
        return null;
    }
}

// 从 ComfyUI API 获取已安装的模型列表
export async function getInstalledModels() {
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
        
        // 存储每个模型对应的节点类型（key: "modelType:modelName", value: [nodeType1, nodeType2, ...]）
        const installedModelNodeTypeMap = {};
        
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
        
        // 辅助函数：记录模型和节点类型的映射
        function recordModelNodeType(modelType, modelName, nodeType) {
            const modelKey = `${modelType}:${modelName}`;
            if (!installedModelNodeTypeMap[modelKey]) {
                installedModelNodeTypeMap[modelKey] = [];
            }
            if (!installedModelNodeTypeMap[modelKey].includes(nodeType)) {
                installedModelNodeTypeMap[modelKey].push(nodeType);
            }
        }
        
        // 从 object_info 中提取模型列表
        // ComfyUI 的 object_info 包含各种节点的输入信息，包括模型选择器
        if (objectInfo.CheckpointLoaderSimple && objectInfo.CheckpointLoaderSimple.input) {
            const required = objectInfo.CheckpointLoaderSimple.input.required || {};
            if (required.ckpt_name) {
                const models = ensureStringArray(required.ckpt_name);
                installed["主模型"] = models;
                models.forEach(modelName => {
                    recordModelNodeType("主模型", modelName, "CheckpointLoaderSimple");
                });
            }
        }
        
        if (objectInfo.VAELoader && objectInfo.VAELoader.input) {
            const required = objectInfo.VAELoader.input.required || {};
            if (required.vae_name) {
                const models = ensureStringArray(required.vae_name);
                installed["VAE"] = models;
                models.forEach(modelName => {
                    recordModelNodeType("VAE", modelName, "VAELoader");
                });
            }
        }
        
        if (objectInfo.CLIPLoader && objectInfo.CLIPLoader.input) {
            const required = objectInfo.CLIPLoader.input.required || {};
            if (required.clip_name) {
                const models = ensureStringArray(required.clip_name);
                installed["CLIP"] = models;
                models.forEach(modelName => {
                    recordModelNodeType("CLIP", modelName, "CLIPLoader");
                });
            }
        }
        
        if (objectInfo.ControlNetLoader && objectInfo.ControlNetLoader.input) {
            const required = objectInfo.ControlNetLoader.input.required || {};
            if (required.control_net_name) {
                const models = ensureStringArray(required.control_net_name);
                installed["ControlNet"] = models;
                models.forEach(modelName => {
                    recordModelNodeType("ControlNet", modelName, "ControlNetLoader");
                });
            }
        }
        
        if (objectInfo.LoraLoader && objectInfo.LoraLoader.input) {
            const required = objectInfo.LoraLoader.input.required || {};
            if (required.lora_name) {
                const models = ensureStringArray(required.lora_name);
                installed["LoRA"] = models;
                models.forEach(modelName => {
                    recordModelNodeType("LoRA", modelName, "LoraLoader");
                });
            }
        }
        
        if (objectInfo.UpscaleModelLoader && objectInfo.UpscaleModelLoader.input) {
            const required = objectInfo.UpscaleModelLoader.input.required || {};
            if (required.model_name) {
                const models = ensureStringArray(required.model_name);
                installed["放大模型"] = [...new Set([...installed["放大模型"], ...models])];
                models.forEach(modelName => {
                    recordModelNodeType("放大模型", modelName, "UpscaleModelLoader");
                });
            }
        }
        
        if (objectInfo.UpscalerLoader && objectInfo.UpscalerLoader.input) {
            const required = objectInfo.UpscalerLoader.input.required || {};
            if (required.model_name) {
                const models = ensureStringArray(required.model_name);
                installed["放大模型"] = [...new Set([...installed["放大模型"], ...models])];
                models.forEach(modelName => {
                    recordModelNodeType("放大模型", modelName, "UpscalerLoader");
                });
            }
        }
        
        // 辅助函数：检查字符串是否包含模型文件后缀
        function hasModelExtension(str) {
            if (typeof str !== "string") return false;
            return MODEL_FILE_EXTENSIONS.some(ext => str.toLowerCase().endsWith(ext.toLowerCase()));
        }
        
        // 辅助函数：递归提取数组中的所有字符串，并过滤出包含模型后缀的
        function extractModelStrings(arr) {
            if (!Array.isArray(arr)) {
                if (typeof arr === "string" && hasModelExtension(arr)) {
                    return [arr];
                }
                return [];
            }
            
            const result = [];
            for (const item of arr) {
                if (typeof item === "string") {
                    if (hasModelExtension(item)) {
                        result.push(item);
                    }
                } else if (Array.isArray(item)) {
                    // 递归处理嵌套数组
                    result.push(...extractModelStrings(item));
                } else if (typeof item === "object" && item !== null) {
                    // 处理对象，尝试获取 name 或 value 属性
                    const str = item.name || item.value || String(item);
                    if (typeof str === "string" && hasModelExtension(str)) {
                        result.push(str);
                    }
                }
            }
            return result;
        }
        
        // 尝试从其他节点获取模型列表
        for (const [nodeType, nodeInfo] of Object.entries(objectInfo)) {
            if (nodeInfo && nodeInfo.input) {
                const required = nodeInfo.input.required || {};
                const optional = nodeInfo.input.optional || {};
                
                // 检查所有字段，通过值中的模型后缀来判断是否为模型
                for (const [field, value] of Object.entries({...required, ...optional})) {
                    if (Array.isArray(value) && value.length > 0) {
                        const modelStrings = extractModelStrings(value);
                        if (modelStrings.length > 0) {
                            // 根据字段名和节点类型分类
                            let modelType = null;
                            if (field.includes("lora") || nodeType.includes("Lora")) {
                                modelType = "LoRA";
                                installed["LoRA"] = [...new Set([...installed["LoRA"], ...modelStrings])];
                            } else if (field.includes("vae") || nodeType.includes("VAE")) {
                                modelType = "VAE";
                                installed["VAE"] = [...new Set([...installed["VAE"], ...modelStrings])];
                            } else if (field.includes("clip") && !field.includes("vision")) {
                                modelType = "CLIP";
                                installed["CLIP"] = [...new Set([...installed["CLIP"], ...modelStrings])];
                            } else if (field.includes("control") || nodeType.includes("Control")) {
                                modelType = "ControlNet";
                                installed["ControlNet"] = [...new Set([...installed["ControlNet"], ...modelStrings])];
                            } else if (field.includes("checkpoint") || field.includes("ckpt") || nodeType.includes("Checkpoint")) {
                                modelType = "主模型";
                                installed["主模型"] = [...new Set([...installed["主模型"], ...modelStrings])];
                            } else if (field.includes("upscale") || field.includes("pixel") || nodeType.includes("Upscale")) {
                                modelType = "放大模型";
                                installed["放大模型"] = [...new Set([...installed["放大模型"], ...modelStrings])];
                            } else {
                                // 其他包含模型后缀的字段，根据后缀或节点类型判断
                                const hasSafetensors = modelStrings.some(s => s.toLowerCase().endsWith(".safetensors") || s.toLowerCase().endsWith(".ckpt"));
                                if (hasSafetensors && (nodeType.includes("Checkpoint") || field.includes("checkpoint") || field.includes("ckpt"))) {
                                    modelType = "主模型";
                                    installed["主模型"] = [...new Set([...installed["主模型"], ...modelStrings])];
                                } else {
                                    modelType = "其他";
                                    installed["其他"] = [...new Set([...installed["其他"], ...modelStrings])];
                                }
                            }
                            
                            // 记录模型和节点类型的映射
                            if (modelType) {
                                modelStrings.forEach(modelName => {
                                    recordModelNodeType(modelType, modelName, nodeType);
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return { models: installed, nodeTypeMap: installedModelNodeTypeMap };
    } catch (error) {
        // console.error("[ComfyUI-find-models] 获取已安装模型列表失败:", error);
        return {
            models: {
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
            },
            nodeTypeMap: {}
        };
    }
}

// 搜索模型链接（通过后端API，带缓存）
export async function searchModelLinks(modelName, modelType, skipCache = false, getCachedResults, setCachedResults) {
    // 先检查缓存（除非跳过缓存）
    if (!skipCache && getCachedResults) {
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
            if (setCachedResults) {
                setCachedResults(modelName, results);
            }
            
            return results;
        }
        
        // 请求失败，返回空数组但不缓存
        return [];
    } catch (error) {
        // console.error(`[ComfyUI-find-models] 搜索模型链接失败: ${error}`);
        return [];
    }
}
