/**
 * 模型操作功能模块
 */

import { renderLocalPath } from '../components/LocalPath.js';
import { renderModelPageLinks } from '../components/ModelPageLinks.js';
import { renderDownloadLinks } from '../components/DownloadLinks.js';
import { renderSpinner, ensureSpinnerStyle } from '../components/Spinner.js';
import { getInstalledModels, getExtraModelPaths, searchModelLinks } from './api.js';
import { clearModelCache, getCachedResults, setCachedResults } from './cache.js';
import { checkModelStatus, MODEL_TYPE_TO_DIR, buildLocalPath, extractModelsFromWorkflow } from '../workflowModelExtractor.js';
import { t } from '../i18n/i18n.js';
import { bindHighlightButtons } from './nodeHighlight.js';
import { app } from '../../../scripts/app.js';

// 重新搜索单个模型并更新表格行
export async function refreshModelSearch(modelName, modelType, rowElement) {
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
    statusCell.innerHTML = renderSpinner(t('searching'));
    localPathCell.innerHTML = renderSpinner(t('searching'));
    modelPageCell.innerHTML = renderSpinner(t('searching'));
    downloadCell.innerHTML = renderSpinner(t('searching'));
    
    try {
        // 1. 重新获取已安装模型列表和 extra_model_paths 配置
        const [installedModelsData, extraModelPaths] = await Promise.all([
            getInstalledModels(),
            getExtraModelPaths()
        ]);
        
        // 适配新的数据结构：getInstalledModels 现在返回 { models, nodeTypeMap }
        const installedModels = installedModelsData.models || installedModelsData;
        const installedNodeTypeMap = installedModelsData.nodeTypeMap || {};
        
        // 2. 重新提取 workflow 中的模型需求（获取节点类型映射）
        let modelUsageMap = {};
        let modelNodeMap = {};
        let modelNodeTypeMap = {};
        
        try {
            // 从全局状态获取 workflow（如果存在）
            const workflow = window._currentWorkflow || (app?.graph ? app.graph.serialize() : null);
            if (workflow && workflow.nodes) {
                const extracted = extractModelsFromWorkflow(workflow);
                modelUsageMap = extracted.modelUsageMap || {};
                modelNodeMap = extracted.modelNodeMap || {};
                modelNodeTypeMap = extracted.modelNodeTypeMap || {};
            }
        } catch (error) {
            // 如果无法获取 workflow，使用空对象（向后兼容）
            // console.warn("[ComfyUI-find-models] 无法获取 workflow 信息:", error);
        }
        
        // 3. 重新检查模型状态（使用与第一次搜索相同的逻辑）
        const requiredModels = {
            [modelType]: [modelName]
        };
        const status = checkModelStatus(
            requiredModels, 
            installedModels, 
            modelUsageMap, 
            modelNodeMap, 
            MODEL_TYPE_TO_DIR, 
            extraModelPaths,
            modelNodeTypeMap,
            installedNodeTypeMap
        );
        
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
        
        // 如果还是找不到，创建一个默认的模型信息（使用重新获取的已安装模型列表）
        if (!modelInfo) {
            // 检查是否在已安装列表中（使用重新获取的 installedModels）
            const installedList = installedModels[modelType] || [];
            const modelNameLower = modelName.toLowerCase().trim();
            const modelFileName = modelName.split(/[/\\]/).pop().toLowerCase().trim();
            let isInstalled = false;
            let localPath = null;
            
            for (const installedModel of installedList) {
                const installedModelStr = typeof installedModel === "string" ? installedModel : String(installedModel);
                const installedLower = installedModelStr.toLowerCase().trim();
                const installedFileName = installedModelStr.split(/[/\\]/).pop().toLowerCase().trim();
                
                if (installedFileName === modelFileName || installedLower === modelNameLower) {
                    isInstalled = true;
                    // 使用 buildLocalPath 函数构建路径（使用重新获取的 extraModelPaths）
                    localPath = buildLocalPath(modelType, installedModelStr, MODEL_TYPE_TO_DIR, extraModelPaths);
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
        
        // 3. 更新"是否已安装"单元格（使用重新检查后的状态）
        const statusColor = modelInfo.installed ? "#81c784" : "#e57373";
        const statusText = modelInfo.installed ? `✓ ${t('installed')}` : `✗ ${t('missing')}`;
        statusCell.innerHTML = `<span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>`;
        
        // 4. 更新"本地目录"单元格（传入重新获取的 extraModelPaths）
        localPathCell.innerHTML = renderLocalPath(modelInfo, modelType, MODEL_TYPE_TO_DIR, extraModelPaths);
        
        // 5. 重新搜索下载链接（跳过缓存）
        const links = await searchModelLinks(modelName, modelType, true, getCachedResults, setCachedResults);
        
        // 6. 更新"模型页面"单元格（使用重新检查后的安装状态）
        modelPageCell.innerHTML = renderModelPageLinks(links, modelInfo.installed);
        
        // 7. 更新"下载链接"单元格（使用重新检查后的安装状态）
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
        // 恢复原始内容
        statusCell.innerHTML = originalStatus;
        localPathCell.innerHTML = originalLocalPath;
        modelPageCell.innerHTML = originalModelPage;
        downloadCell.innerHTML = originalDownload;
    }
}

// 显示模型行的加载状态
export function showModelRowLoading(contentDiv, model) {
    const rowId = `model-row-${model.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const row = contentDiv.querySelector(`#${rowId}`);
    
    if (!row) {
        return;
    }
    
    // 确保加载动画样式已添加
    ensureSpinnerStyle();
    
    // 获取行中的单元格
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) {
        return;
    }
    
    // 更新"模型页面"单元格（第4列，索引3）显示加载状态
    const modelPageCell = cells[3];
    if (modelPageCell) {
        modelPageCell.innerHTML = renderSpinner(t('searching'));
    }
    
    // 更新"下载链接"单元格（第5列，索引4）显示加载状态
    const downloadCell = cells[4];
    if (downloadCell) {
        downloadCell.innerHTML = renderSpinner(t('searching'));
    }
}

// 更新单个模型行的显示
export function updateModelRow(contentDiv, model, links) {
    const rowId = `model-row-${model.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const row = contentDiv.querySelector(`#${rowId}`);
    
    if (!row) {
        return;
    }
    
    // 获取行中的单元格
    const cells = row.querySelectorAll('td');
    if (cells.length < 5) {
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
                // refreshModelSearch 在同一文件中定义，可以直接调用
                refreshModelSearch(modelName, modelType, row);
            };
        }
    }
}

// 绑定刷新按钮事件（辅助函数）
export function bindRefreshButtons(contentDiv) {
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
