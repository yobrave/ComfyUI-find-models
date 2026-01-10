/**
 * Workflow 模型提取器
 * 从 ComfyUI workflow 中提取模型信息
 */

// 模型类型映射（用于识别模型派系）
export const MODEL_FAMILIES = {
    "SDXL": ["sdxl", "xl", "stable-diffusion-xl"],
    "SD1.5": ["sd15", "sd-1.5", "stable-diffusion-1.5"],
    "SD2": ["sd2", "sd-2", "stable-diffusion-2"],
    "SD3": ["sd3", "sd-3", "stable-diffusion-3"],
    "Pony": ["pony", "ponydiffusion"],
    "Wan": ["wan", "wan2", "wan2.1", "wan2.2", "wan2.3"],
    "Flux": ["flux", "flux1", "flux-dev"],
    "LTX": ["ltx", "ltx-2", "ltx2"],
    "Hunyuan": ["hunyuan"],
    "ZImage": ["zimage", "z-image"],
    "AnimateDiff": ["animatediff", "animate-diff"],
    "SVD": ["svd", "stable-video-diffusion"],
    "Kandinsky": ["kandinsky"],
    "IF": ["if", "imagen"],
};

// 检测模型所属的派系
export function detectModelFamily(modelName) {
    const modelLower = modelName.toLowerCase();
    const families = [];
    
    for (const [family, keywords] of Object.entries(MODEL_FAMILIES)) {
        for (const keyword of keywords) {
            if (modelLower.includes(keyword)) {
                families.push(family);
                break;
            }
        }
    }
    
    return families.length > 0 ? families : ["未知"];
}

// 模型加载器节点类型及其对应的widgets_values索引（与 get_workflow_models.py 一致）
export const MODEL_LOADER_NODES = {
    // Wan系列模型加载器
    "WanVideoModelLoader": [0, "主模型"],
    "WanVideoVAELoader": [0, "VAE"],
    "LoadWanVideoT5TextEncoder": [0, "文本编码器"],
    "WanVideoLoraSelect": [0, "LoRA"],
    
    // 标准ComfyUI模型加载器
    "CheckpointLoaderSimple": [0, "主模型"],
    "CheckpointLoader": [0, "主模型"],
    "UNETLoader": [0, "主模型"],
    "VAELoader": [0, "VAE"],
    "CLIPLoader": [0, "CLIP"],
    "CLIPVisionLoader": [0, "CLIP Vision"],
    "ControlNetLoader": [0, "ControlNet"],
    "IPAdapterModelLoader": [0, "IP-Adapter"],
    "LoraLoader": [0, "LoRA"],
    "UpscaleModelLoader": [0, "放大模型"],
    "UpscalerLoader": [0, "放大模型"],
    
    // Efficiency Nodes 扩展的 HighRes-Fix Script 节点
    // 模型在 widgets_values 的索引 3 位置
    "HighRes-Fix Script": [3, "放大模型"],
    
    // Impact Pack 和其他扩展的节点
    "SAMLoader": [0, "其他"],  // SAM 模型加载器
    "UltralyticsDetectorProvider": [0, "其他"],  // Ultralytics 检测器（YOLO等）
    
    // 其他可能的加载器
    "ModelLoader": [0, "其他"],
    "VAELoaderSimple": [0, "VAE"],
};

// 常见的模型文件扩展名
const MODEL_FILE_EXTENSIONS = [
    '.safetensors', '.ckpt', '.pt', '.pth', '.bin', 
    '.onnx', '.pb', '.tflite', '.h5', '.pkl', '.pth.tar'
];

// 检查一个值是否看起来像模型文件名
function looksLikeModelFileName(value) {
    if (!value || typeof value !== 'string') {
        return false;
    }
    
    const str = value.trim();
    if (str.length < 3) {
        return false;
    }
    
    // 提取文件名（去除路径）
    const fileName = str.split(/[/\\]/).pop();
    
    // 检查是否有模型文件扩展名
    const hasModelExtension = MODEL_FILE_EXTENSIONS.some(ext => 
        fileName.toLowerCase().endsWith(ext.toLowerCase())
    );
    
    if (hasModelExtension) {
        return true;
    }
    
    // 如果没有扩展名但包含常见模型关键词，也可能是模型名
    const modelKeywords = ['model', 'checkpoint', 'vae', 'lora', 'controlnet', 'clip', 'embedding'];
    const fileNameLower = fileName.toLowerCase();
    return modelKeywords.some(keyword => fileNameLower.includes(keyword));
}

// 检查节点是否被使用
export function isNodeUsed(node) {
    // 检查节点的 mode 值（LiteGraph 的节点活动状态）
    // mode: 0 = 正常（Always），2 = 禁用（Never/Bypass），4 = 静音（Muted）
    // 如果节点被禁用（mode: 2）或静音（mode: 4），视为未使用
    const nodeMode = node.mode !== undefined ? node.mode : 0;
    if (nodeMode === 2 || nodeMode === 4) {
        return false; // 禁用或静音的节点视为未使用
    }
    
    // 对于模型加载器节点，主要检查 outputs：如果 outputs 中任何一个元素的 links 数组有值，说明节点被使用
    if (node.outputs && Array.isArray(node.outputs)) {
        for (const output of node.outputs) {
            if (output.links && Array.isArray(output.links) && output.links.length > 0) {
                return true;
            }
        }
    }
    
    // 检查 inputs 数组：如果 inputs 中任何一个元素的 link 有值，说明节点被使用
    // 注意：对于模型加载器节点，通常没有 inputs 连接，所以主要依赖 outputs 检查
    if (node.inputs && Array.isArray(node.inputs)) {
        for (const input of node.inputs) {
            if (input && input.link !== undefined && input.link !== null) {
                return true;
            }
        }
    }
    
    // 如果既没有 outputs 连接，也没有 inputs 连接，说明节点未被使用
    return false;
}

// 从工作流中提取模型信息（使用与 get_workflow_models.py 相同的逻辑）
export function extractModelsFromWorkflow(workflow) {
    const models = {
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
    
    // 存储每个模型的使用状态（key: "modelType:modelName", value: isUsed）
    const modelUsageMap = {};
    // 存储每个模型对应的节点ID列表（key: "modelType:modelName", value: [nodeId1, nodeId2, ...]）
    const modelNodeMap = {};
    
    if (!workflow || !workflow.nodes) {
        return { models, modelUsageMap, modelNodeMap };
    }
    
    // 使用 widgets_values 提取模型（与 get_workflow_models.py 一致）
    // 方法1: 从预定义的节点类型中提取（优先）
    for (const node of workflow.nodes) {
        const nodeType = node.type || node.class_type || "";
        const widgetsValues = node.widgets_values || [];
        
        if (nodeType in MODEL_LOADER_NODES) {
            const [index, modelType] = MODEL_LOADER_NODES[nodeType];
            if (widgetsValues && widgetsValues.length > index) {
                let modelName = widgetsValues[index];
                
                // 确保 modelName 是字符串
                if (typeof modelName !== "string") {
                    modelName = String(modelName);
                }
                
                if (modelName && modelName.trim()) {
                    // 清理文件名（移除路径，只保留文件名）
                    modelName = modelName.split(/[/\\]/).pop().trim();
                    
                    if (modelName) {
                        // 检查节点是否被使用
                        const isUsed = isNodeUsed(node);
                        const modelKey = `${modelType}:${modelName}`;
                        
                        // 如果模型已存在，更新使用状态（只要有一个节点使用了，就标记为已使用）
                        if (modelUsageMap[modelKey] !== undefined) {
                            // 如果之前标记为已使用，保持已使用；如果之前未使用但现在使用了，改为已使用
                            modelUsageMap[modelKey] = modelUsageMap[modelKey] || isUsed;
                        } else {
                            modelUsageMap[modelKey] = isUsed;
                        }
                        
                        // 保存节点ID到模型映射
                        // 确保节点ID是数字类型
                        const nodeId = typeof node.id === 'number' ? node.id : parseInt(node.id);
                        if (!isNaN(nodeId)) {
                            if (!modelNodeMap[modelKey]) {
                                modelNodeMap[modelKey] = [];
                            }
                            if (!modelNodeMap[modelKey].includes(nodeId)) {
                                modelNodeMap[modelKey].push(nodeId);
                                // 调试日志：记录模型和节点的映射
                                if (modelName.includes('1x-ITF-SkinDiffDetail-Lite-v1')) {
                                    console.log(`[ComfyUI-find-models] 模型 ${modelName} 映射到节点 ID: ${nodeId} (类型: ${nodeType})`);
                                }
                            }
                        }
                        
                        // 调试日志（仅记录未使用的模型）
                        if (!isUsed) {
                            console.log(`[ComfyUI-find-models] 节点 ${node.id} (${nodeType}) 模型 ${modelName} 未使用 - outputs:`, 
                                node.outputs?.map(o => o.links?.length || 0), 
                                `inputs:`, 
                                node.inputs?.map(i => i.link !== undefined && i.link !== null ? '有连接' : '无连接')
                            );
                        }
                        
                        if (modelType in models) {
                            if (!models[modelType].includes(modelName)) {
                                models[modelType].push(modelName);
                            }
                        } else {
                            if (!models["其他"].includes(modelName)) {
                                models["其他"].push(modelName);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 方法2: 通用检测 - 扫描所有节点的 widgets_values，查找可能的模型文件名
    // 这样可以找到不在 MODEL_LOADER_NODES 中的节点类型（如 SAMLoader、UltralyticsDetectorProvider 等）
    for (const node of workflow.nodes) {
        const nodeType = node.type || node.class_type || "";
        const widgetsValues = node.widgets_values || [];
        
        // 如果已经在 MODEL_LOADER_NODES 中，跳过（已在方法1中处理）
        if (nodeType in MODEL_LOADER_NODES) {
            continue;
        }
        
        // 检查节点的 inputs 是否有 model_name, model, ckpt_name, lora_name 等字段
        // 这些通常表示该节点可能加载模型
        const hasModelInput = node.inputs && Array.isArray(node.inputs) && node.inputs.some(input => {
            const inputName = (input.name || '').toLowerCase();
            return inputName.includes('model') || 
                   inputName.includes('ckpt') || 
                   inputName.includes('lora') || 
                   inputName.includes('vae') ||
                   inputName.includes('checkpoint');
        });
        
        // 如果节点有模型相关的输入字段，扫描 widgets_values 查找模型文件名
        if (hasModelInput && widgetsValues && widgetsValues.length > 0) {
            // 找到所有有 widget 的 inputs，并记录它们在 widgets_values 中的对应索引
            // widgets_values 按照 inputs 中有 widget 的字段顺序排列
            const widgetInputMap = []; // [{inputIndex, widgetIndex, inputName}]
            let widgetIndex = 0;
            
            if (node.inputs && Array.isArray(node.inputs)) {
                node.inputs.forEach((input, inputIdx) => {
                    // 如果 input 有 widget 属性且没有 link（表示是 widget 值而不是连接）
                    if (input && input.widget && (input.link === null || input.link === undefined)) {
                        if (widgetIndex < widgetsValues.length) {
                            widgetInputMap.push({
                                inputIndex: inputIdx,
                                widgetIndex: widgetIndex,
                                inputName: input.name || ''
                            });
                            widgetIndex++;
                        }
                    }
                });
            }
            
            // 扫描 widgets_values，查找可能的模型文件名
            for (let i = 0; i < widgetsValues.length; i++) {
                const value = widgetsValues[i];
                
                // 检查值是否看起来像模型文件名
                if (!looksLikeModelFileName(value)) {
                    continue;
                }
                
                let modelName = typeof value === 'string' ? value : String(value);
                
                if (modelName && modelName.trim()) {
                    // 清理文件名（移除路径，只保留文件名）
                    modelName = modelName.split(/[/\\]/).pop().trim();
                    
                    // 确保是有效的文件名（不是空字符串、数字、布尔值等）
                    if (modelName && modelName.length > 2 && !/^\d+(\.\d+)?$/.test(modelName) && 
                        modelName !== 'true' && modelName !== 'false' && modelName !== 'AUTO') {
                        
                        // 尝试推断模型类型（基于节点类型、输入字段名和文件名）
                        let inferredType = "其他";
                        
                        const nodeTypeLower = nodeType.toLowerCase();
                        const valueLower = modelName.toLowerCase();
                        
                        // 查找对应的 input 字段名
                        const widgetMapping = widgetInputMap.find(m => m.widgetIndex === i);
                        if (widgetMapping) {
                            const inputName = widgetMapping.inputName.toLowerCase();
                            
                            if (inputName.includes('lora')) {
                                inferredType = "LoRA";
                            } else if (inputName.includes('vae')) {
                                inferredType = "VAE";
                            } else if (inputName.includes('clip') && !inputName.includes('vision')) {
                                inferredType = "CLIP";
                            } else if (inputName.includes('clip') && inputName.includes('vision')) {
                                inferredType = "CLIP Vision";
                            } else if (inputName.includes('control')) {
                                inferredType = "ControlNet";
                            } else if (inputName.includes('checkpoint') || inputName.includes('ckpt')) {
                                inferredType = "主模型";
                            } else if (inputName.includes('upscale')) {
                                inferredType = "放大模型";
                            } else if (inputName.includes('ip') || inputName.includes('adapter')) {
                                inferredType = "IP-Adapter";
                            } else if (inputName.includes('text') || inputName.includes('t5') || inputName.includes('encoder')) {
                                inferredType = "文本编码器";
                            } else if (inputName.includes('sam')) {
                                inferredType = "其他"; // SAM 模型归类为其他
                            }
                        }
                        
                        // 如果还没推断出类型，尝试从节点类型和文件名推断
                        if (inferredType === "其他") {
                            if (nodeTypeLower.includes('lora')) {
                                inferredType = "LoRA";
                            } else if (nodeTypeLower.includes('vae')) {
                                inferredType = "VAE";
                            } else if (nodeTypeLower.includes('clip')) {
                                inferredType = nodeTypeLower.includes('vision') ? "CLIP Vision" : "CLIP";
                            } else if (nodeTypeLower.includes('control')) {
                                inferredType = "ControlNet";
                            } else if (nodeTypeLower.includes('checkpoint') || nodeTypeLower.includes('ckpt')) {
                                inferredType = "主模型";
                            } else if (nodeTypeLower.includes('upscale')) {
                                inferredType = "放大模型";
                            } else if (nodeTypeLower.includes('sam')) {
                                inferredType = "其他"; // SAM 模型
                            } else if (valueLower.includes('lora') || valueLower.endsWith('.lora')) {
                                inferredType = "LoRA";
                            } else if (valueLower.includes('vae') || valueLower.endsWith('.vae')) {
                                inferredType = "VAE";
                            } else if (valueLower.includes('controlnet') || valueLower.includes('control')) {
                                inferredType = "ControlNet";
                            }
                        }
                        
                        const modelKey = `${inferredType}:${modelName}`;
                        const isUsed = isNodeUsed(node);
                        
                        // 如果模型已存在（可能通过方法1已添加），更新使用状态
                        if (modelUsageMap[modelKey] !== undefined) {
                            modelUsageMap[modelKey] = modelUsageMap[modelKey] || isUsed;
                        } else {
                            modelUsageMap[modelKey] = isUsed;
                        }
                        
                        // 保存节点ID到模型映射
                        const nodeId = typeof node.id === 'number' ? node.id : parseInt(node.id);
                        if (!isNaN(nodeId)) {
                            if (!modelNodeMap[modelKey]) {
                                modelNodeMap[modelKey] = [];
                            }
                            if (!modelNodeMap[modelKey].includes(nodeId)) {
                                modelNodeMap[modelKey].push(nodeId);
                            }
                        }
                        
                        // 添加到模型列表
                        if (inferredType in models) {
                            if (!models[inferredType].includes(modelName)) {
                                models[inferredType].push(modelName);
                                console.log(`[ComfyUI-find-models] 通用检测: 在节点 ${node.id} (${nodeType}, widgets_values[${i}]) 中发现模型 ${modelName}，类型推断为: ${inferredType}`);
                            }
                        } else {
                            if (!models["其他"].includes(modelName)) {
                                models["其他"].push(modelName);
                                console.log(`[ComfyUI-find-models] 通用检测: 在节点 ${node.id} (${nodeType}, widgets_values[${i}]) 中发现模型 ${modelName}，归类为: 其他`);
                            }
                        }
                    }
                }
            }
        }
    }
    
    return { models, modelUsageMap, modelNodeMap };
}

// 模型类型到目录的映射
export const MODEL_TYPE_TO_DIR = {
    "主模型": "checkpoints",
    "Checkpoint": "checkpoints",
    "VAE": "vae",
    "LoRA": "loras",
    "ControlNet": "controlnet",
    "放大模型": "upscale_models",
    "Upscale": "upscale_models",
    "CLIP": "clip",
    "CLIP Vision": "clip_vision",
    "IP-Adapter": "ipadapter",
    "文本编码器": "text_encoders"
};

// 构建本地路径（使用 extra_model_paths 配置）
export function buildLocalPath(modelType, modelName, modelTypeToDir, extraModelPaths = null) {
    // 映射模型类型到 ComfyUI 的目录名称
    const comfyModelTypeMap = {
        "主模型": "checkpoints",
        "Checkpoint": "checkpoints",
        "VAE": "vae",
        "LoRA": "loras",
        "ControlNet": "controlnet",
        "放大模型": "upscale_models",
        "Upscale": "upscale_models",
        "CLIP": "clip",
        "CLIP Vision": "clip_vision",
        "IP-Adapter": "ipadapter",
        "文本编码器": "text_encoders"
    };
    
    const comfyType = comfyModelTypeMap[modelType] || modelType.toLowerCase();
    
    // 检查 extra_model_paths 中是否有该类型的配置
    if (extraModelPaths && typeof extraModelPaths === 'object') {
        // 使用 merged 数据（如果存在），否则直接使用 extraModelPaths
        const pathsData = extraModelPaths.merged || extraModelPaths;
        
        // 检查是否有该模型类型的配置
        if (pathsData && pathsData[comfyType]) {
            const pathConfig = pathsData[comfyType];
            
            // 格式1: { "paths": ["path1", "path2"], "default_path": "path1" }
            if (typeof pathConfig === 'object' && pathConfig.default_path) {
                const relativePath = pathConfig.default_path;
                // 确保 relativePath 是相对路径（相对于 models 目录）
                // 如果包含路径分隔符，只取第一级目录
                if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                    const pathParts = relativePath.replace(/\\/g, '/').split('/');
                    const dirName = pathParts[pathParts.length - 1] || relativePath;
                    return `${dirName}/${modelName}`;
                }
                if (relativePath) {
                    return `${relativePath}/${modelName}`;
                }
            }
            // 格式2: { "paths": ["path1", "path2"] }
            else if (typeof pathConfig === 'object' && pathConfig.paths && Array.isArray(pathConfig.paths) && pathConfig.paths.length > 0) {
                const relativePath = pathConfig.paths[0];
                if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                    const pathParts = relativePath.replace(/\\/g, '/').split('/');
                    const dirName = pathParts[pathParts.length - 1] || relativePath;
                    return `${dirName}/${modelName}`;
                }
                if (relativePath) {
                    return `${relativePath}/${modelName}`;
                }
            }
            // 格式3: ["path1", "path2"] 数组格式
            else if (Array.isArray(pathConfig) && pathConfig.length > 0) {
                const relativePath = pathConfig[0];
                if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                    const pathParts = relativePath.replace(/\\/g, '/').split('/');
                    const dirName = pathParts[pathParts.length - 1] || relativePath;
                    return `${dirName}/${modelName}`;
                }
                if (relativePath) {
                    return `${relativePath}/${modelName}`;
                }
            }
            // 格式4: 字符串路径
            else if (typeof pathConfig === 'string') {
                let relativePath = pathConfig;
                // 如果包含 models，提取 models 后面的部分
                if (relativePath.includes('models')) {
                    const parts = relativePath.replace(/\\/g, '/').split('models/');
                    if (parts.length > 1) {
                        relativePath = parts[parts.length - 1];
                    }
                }
                // 提取目录名（去除路径分隔符）
                if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                    const pathParts = relativePath.replace(/\\/g, '/').split('/');
                    relativePath = pathParts[pathParts.length - 1] || relativePath;
                }
                if (relativePath) {
                    return `${relativePath}/${modelName}`;
                }
            }
        }
    }
    
    // 如果没有找到 extra_model_paths 配置，使用默认的 modelTypeToDir 映射
    const dirName = modelTypeToDir[modelType] || "checkpoints";
    return `${dirName}/${modelName}`;
}

// 检查模型状态
export function checkModelStatus(requiredModels, installedModels, modelUsageMap = {}, modelNodeMap = {}, modelTypeToDir = MODEL_TYPE_TO_DIR, extraModelPaths = null) {
    const installed = [];
    const missing = [];
    const modelInfo = {};
    
    for (const [modelType, models] of Object.entries(requiredModels)) {
        const installedList = installedModels[modelType] || [];
        
        for (const model of models) {
            // 确保 model 是字符串
            if (typeof model !== "string") {
                console.warn(`[ComfyUI-find-models] 警告: 模型名不是字符串类型:`, model);
                continue;
            }
            
            // 尝试匹配模型名（不区分大小写，优先精确匹配）
            const modelLower = model.toLowerCase().trim();
            // 提取文件名（不含路径）
            const modelFileName = model.split(/[/\\]/).pop().toLowerCase().trim();
            let isInstalled = false;
            let matchedName = null;
            let localPath = null;
            
            for (const installedModel of installedList) {
                // 确保 installedModel 是字符串
                let installedModelStr = typeof installedModel === "string" ? installedModel : String(installedModel);
                
                // 如果包含逗号，可能是多个模型名连接在一起，需要分割
                if (installedModelStr.includes(',')) {
                    // 分割并尝试匹配每个模型
                    const modelNames = installedModelStr.split(',').map(m => m.trim()).filter(m => m);
                    for (const singleModelName of modelNames) {
                        const singleModelLower = singleModelName.toLowerCase().trim();
                        const singleModelFileName = singleModelName.split(/[/\\]/).pop().toLowerCase().trim();
                        
                        // 优先精确匹配文件名
                        if (singleModelFileName === modelFileName || singleModelLower === modelLower) {
                            isInstalled = true;
                            matchedName = singleModelName;
                            localPath = buildLocalPath(modelType, singleModelName, modelTypeToDir, extraModelPaths);
                            break;
                        }
                        // 其次尝试文件名包含匹配（但要求文件名部分匹配）
                        else if (singleModelFileName.includes(modelFileName) || modelFileName.includes(singleModelFileName)) {
                            isInstalled = true;
                            matchedName = singleModelName;
                            localPath = buildLocalPath(modelType, singleModelName, modelTypeToDir, extraModelPaths);
                            break;
                        }
                    }
                    if (isInstalled) break;
                } else {
                    // 单个模型名，正常匹配
                    const installedLower = installedModelStr.toLowerCase().trim();
                    const installedFileName = installedModelStr.split(/[/\\]/).pop().toLowerCase().trim();
                    
                    // 优先精确匹配文件名
                    if (installedFileName === modelFileName || installedLower === modelLower) {
                        isInstalled = true;
                        matchedName = installedModelStr;
                        localPath = buildLocalPath(modelType, installedModelStr, modelTypeToDir, extraModelPaths);
                        break;
                    }
                    // 其次尝试文件名包含匹配（但要求文件名部分匹配）
                    else if (installedFileName.includes(modelFileName) || modelFileName.includes(installedFileName)) {
                        isInstalled = true;
                        matchedName = installedModelStr;
                        localPath = buildLocalPath(modelType, installedModelStr, modelTypeToDir, extraModelPaths);
                        break;
                    }
                }
            }
            
            // 获取模型的使用状态
            const modelKey = `${modelType}:${model}`;
            const isUsed = modelUsageMap[modelKey] !== undefined ? modelUsageMap[modelKey] : true; // 默认为 true（已使用）
            
            // 获取模型对应的节点ID列表
            const nodeIds = modelNodeMap[modelKey] || [];
            
            // 调试日志（仅记录未使用的模型或特定模型）
            if (isUsed === false) {
                console.log(`[ComfyUI-find-models] 模型 ${modelKey} 标记为未使用`);
            }
            if (model.includes('1x-ITF-SkinDiffDetail-Lite-v1')) {
                console.log(`[ComfyUI-find-models] 模型 ${modelKey} 对应的节点IDs: [${nodeIds.join(', ')}]`);
            }
            
            const families = detectModelFamily(model);
            const info = {
                name: model,
                type: modelType,
                installed: isInstalled,
                matchedName: matchedName,
                localPath: localPath,
                families: families,
                isUsed: isUsed,  // 添加使用状态
                nodeIds: nodeIds  // 添加节点ID列表
            };
            
            modelInfo[`${modelType}:${model}`] = info;
            
            if (isInstalled) {
                installed.push(info);
            } else {
                missing.push(info);
            }
        }
    }
    
    return {
        installed,
        missing,
        modelInfo
    };
}
