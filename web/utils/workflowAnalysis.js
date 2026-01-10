/**
 * 工作流分析功能模块
 */

import { app } from "../../../scripts/app.js";
import { renderStatsCards } from "../components/StatsCards.js";
import { renderTableHeader, renderTableFooter } from "../components/TableHeader.js";
import { renderModelRow } from "../components/ModelRow.js";
import { renderLoadingState, renderErrorState, renderNoWorkflowState } from "../components/LoadingState.js";
import { renderSpinner, ensureSpinnerStyle } from "../components/Spinner.js";
import { renderModelPageLinks } from "../components/ModelPageLinks.js";
import { renderDownloadLinks } from "../components/DownloadLinks.js";
import { 
    extractModelsFromWorkflow, 
    MODEL_TYPE_TO_DIR, 
    checkModelStatus
} from "../workflowModelExtractor.js";
import { t } from "../i18n/i18n.js";
import { getInstalledModels, getExtraModelPaths, searchModelLinks } from "./api.js";
import { getCachedResults, setCachedResults } from "./cache.js";
import { groupByFamily, groupByType, renderSeparatorRow } from "./helpers.js";
import { bindRefreshButtons, showModelRowLoading, updateModelRow } from "./modelOperations.js";
import { bindHighlightButtons } from "./nodeHighlight.js";
import { saveOriginalRowsOrder, bindSearchFunctionality, searchAndSortModels, restoreOriginalOrder } from "./search.js";

// 分析当前工作流（完全在前端完成）
export async function analyzeCurrentWorkflow(contentDiv) {
    try {
        // 步骤 1: 获取当前工作流数据
        const workflow = app.graph.serialize();
        
        if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
            contentDiv.innerHTML = renderNoWorkflowState();
            return;
        }
        
        // 保存 workflow 到全局状态，供重新搜索时使用
        if (typeof window !== 'undefined') {
            window._currentWorkflow = workflow;
        }
        
        // 步骤 2: 提取工作流中的模型需求
        const { models: requiredModels, modelUsageMap, modelNodeMap, modelNodeTypeMap } = extractModelsFromWorkflow(workflow);
        const totalRequired = Object.values(requiredModels).reduce((sum, models) => sum + models.length, 0);
        
        // 步骤 3: 获取已安装的模型列表和 extra_model_paths 配置
        contentDiv.innerHTML = renderLoadingState(t('gettingInstalledModels'));
        
        const [installedModelsData, extraModelPaths] = await Promise.all([
            getInstalledModels(),
            getExtraModelPaths()
        ]);
        
        // 适配新的数据结构：getInstalledModels 现在返回 { models, nodeTypeMap }
        const installedModels = installedModelsData.models || installedModelsData;
        const installedNodeTypeMap = installedModelsData.nodeTypeMap || {};
        
        const totalInstalled = Object.values(installedModels).reduce((sum, models) => sum + models.length, 0);
        
        // 步骤 4: 检查模型状态（传入使用状态映射、节点映射、节点类型映射和 extra_model_paths 配置）
        const status = checkModelStatus(requiredModels, installedModels, modelUsageMap, modelNodeMap, MODEL_TYPE_TO_DIR, extraModelPaths, modelNodeTypeMap, installedNodeTypeMap);
        
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
            installed_models: installedModels,
            extra_model_paths: extraModelPaths // 保存 extraModelPaths 用于显示路径
        };
        
        // 先显示表格（保存结果到全局变量，供语言切换时使用）
        displayModelStatus(contentDiv, initialResult, (result) => {
            window._currentDialogResult = result;
        });
        
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
                        const links = await searchModelLinks(model.name, model.type, false, getCachedResults, setCachedResults);
                        if (links.length > 0) {
                            modelLinks[model.name] = links;
                        }
                        // 实时更新该行的显示（updateModelRow 内部会处理 refreshModelSearch 的绑定）
                        updateModelRow(contentDiv, model, links);
                        return { model: model.name, success: true };
                    } catch (error) {
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
            installed_models: installedModels,
            extra_model_paths: extraModelPaths, // 保存 extraModelPaths 用于显示路径
            installed_node_type_map: installedNodeTypeMap // 保存已安装模型的节点类型映射
        };
        
        // 步骤 8: 最终显示结果（更新表格，按使用状态分组，并保存结果）
        displayModelStatus(contentDiv, result, (result) => {
            window._currentDialogResult = result;
        });
        
    } catch (error) {
        contentDiv.innerHTML = renderErrorState(error.message);
    }
}

// 显示模型状态（表格形式）
export function displayModelStatus(contentDiv, result, saveResultCallback = null) {
    // 如果提供了保存回调，保存结果（用于语言切换时重新渲染）
    if (saveResultCallback && typeof saveResultCallback === 'function') {
        saveResultCallback(result);
    }
    
    // 同时也保存到全局变量（兼容旧代码）
    if (typeof window !== 'undefined') {
        window._currentDialogResult = result;
    }
    
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
        // 使用组件生成表格行（传递 extraModelPaths）
        html += renderModelRow(model, links, MODEL_TYPE_TO_DIR, needsLoading, result.extra_model_paths);
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
            // 使用组件生成表格行（传递 extraModelPaths）
            html += renderModelRow(model, links, MODEL_TYPE_TO_DIR, needsLoading, result.extra_model_paths);
        }
    }
    
    html += renderTableFooter();
    
    contentDiv.innerHTML = html;
    
    // 绑定刷新按钮事件
    bindRefreshButtons(contentDiv);
    
    // 绑定高亮节点按钮事件
    bindHighlightButtons(contentDiv);
    
    // 绑定搜索功能
    bindSearchFunctionality(contentDiv, searchAndSortModels, restoreOriginalOrder, bindRefreshButtons, bindHighlightButtons);
    
    // 保存原始行顺序（用于恢复排序）
    saveOriginalRowsOrder(contentDiv);
}
