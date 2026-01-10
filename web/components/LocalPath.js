/**
 * 本地路径组件
 */

import { buildLocalPath } from '../workflowModelExtractor.js';
import { t } from '../i18n/i18n.js';

export function renderLocalPath(modelInfo, modelType, modelTypeToDir, extraModelPaths = null) {
    if (modelInfo.installed && modelInfo.localPath) {
        // 已安装且已知路径
        return `
            <div style="font-size: 12px; color: #81c784; font-family: monospace;">
                models/${modelInfo.localPath}
            </div>
        `;
    } else if (modelInfo.installed) {
        // 已安装但路径未知，使用默认路径
        const dirName = modelTypeToDir[modelType] || "checkpoints";
        return `
            <div style="font-size: 12px; color: #81c784; font-family: monospace;">
                models/${dirName}/
            </div>
        `;
    } else {
        // 未安装：显示应该下载到的目录路径（只显示目录，不包含文件名）
        let dirPath = '';
        
        // 尝试从 extraModelPaths 或 modelTypeToDir 获取目录名
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
        
        // 优先使用 extraModelPaths 配置
        if (extraModelPaths && typeof extraModelPaths === 'object') {
            const pathsData = extraModelPaths.merged || extraModelPaths;
            
            if (pathsData && pathsData[comfyType]) {
                const pathConfig = pathsData[comfyType];
                
                // 提取目录名
                if (typeof pathConfig === 'object' && pathConfig.default_path) {
                    let relativePath = pathConfig.default_path;
                    if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                        const pathParts = relativePath.replace(/\\/g, '/').split('/');
                        dirPath = pathParts[pathParts.length - 1] || relativePath;
                    } else if (relativePath) {
                        dirPath = relativePath;
                    }
                } else if (typeof pathConfig === 'object' && pathConfig.paths && Array.isArray(pathConfig.paths) && pathConfig.paths.length > 0) {
                    let relativePath = pathConfig.paths[0];
                    if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                        const pathParts = relativePath.replace(/\\/g, '/').split('/');
                        dirPath = pathParts[pathParts.length - 1] || relativePath;
                    } else if (relativePath) {
                        dirPath = relativePath;
                    }
                } else if (Array.isArray(pathConfig) && pathConfig.length > 0) {
                    let relativePath = pathConfig[0];
                    if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                        const pathParts = relativePath.replace(/\\/g, '/').split('/');
                        dirPath = pathParts[pathParts.length - 1] || relativePath;
                    } else if (relativePath) {
                        dirPath = relativePath;
                    }
                } else if (typeof pathConfig === 'string') {
                    let relativePath = pathConfig;
                    if (relativePath.includes('models')) {
                        const parts = relativePath.replace(/\\/g, '/').split('models/');
                        if (parts.length > 1) {
                            relativePath = parts[parts.length - 1];
                        }
                    }
                    if (relativePath && (relativePath.includes('/') || relativePath.includes('\\'))) {
                        const pathParts = relativePath.replace(/\\/g, '/').split('/');
                        dirPath = pathParts[pathParts.length - 1] || relativePath;
                    } else if (relativePath) {
                        dirPath = relativePath;
                    }
                }
            }
        }
        
        // 如果从 extraModelPaths 没有获取到，使用 modelTypeToDir 或默认值
        if (!dirPath) {
            dirPath = modelTypeToDir[modelType] || comfyType || "checkpoints";
        }
        
        // 确保目录路径以 / 结尾
        if (dirPath && !dirPath.endsWith('/')) {
            dirPath = dirPath + '/';
        }
        
        return `
            <div style="font-size: 12px; color: #999; font-family: monospace;" title="${t('downloadToPath')}">
                models/${dirPath}
            </div>
        `;
    }
}
