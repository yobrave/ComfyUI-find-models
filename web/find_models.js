/**
 * ComfyUI Find Models - 前端界面主文件
 * 在ComfyUI界面中添加按钮和弹窗显示模型状态
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createDialog } from "./components/Dialog.js";
import { renderLoadingState, renderNoWorkflowState } from "./components/LoadingState.js";
import { t } from "./i18n/i18n.js";

// 从 utils 导入所有功能函数
import { clearExpiredCache } from "./utils/cache.js";
import { analyzeCurrentWorkflow, displayModelStatus } from "./utils/workflowAnalysis.js";
import { addFindModelsButton } from "./utils/ui.js";

// 版本号
let VERSION = "1.0.0";

// 保存当前对话框的结果，用于语言切换时重新渲染
let _currentDialogResult = null;
let _currentDialogContent = null;

// 全局标志：是否跳过缓存（当 r 键刷新节点数据时设置为 true）
let _skipCache = false;

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
    
    // 初始化全局变量，供 workflowAnalysis.js 保存结果
    window._currentDialogContent = content;
    window._currentDialogResult = null;
    
    // 确保使用最新的 workflow（清除旧的缓存，强制从 app.graph 获取）
    // 这样可以确保即使切换了 workflow，第一次搜索也能正确显示
    // 添加延迟机制，确保 workflow 已经完全加载
    const startAnalysis = async () => {
        // 等待一小段时间，确保 workflow 已经完全加载（特别是异步加载的情况）
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 验证 workflow 是否有效，如果不有效则重试
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 200;
        
        const tryAnalyze = async () => {
            try {
                if (!app?.graph) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        return tryAnalyze();
                    }
                    content.innerHTML = renderNoWorkflowState();
                    return;
                }
                
                // 验证 workflow 是否有效
                const currentWorkflow = app.graph.serialize();
                if (!currentWorkflow || !currentWorkflow.nodes || currentWorkflow.nodes.length === 0) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        return tryAnalyze();
                    }
                    content.innerHTML = renderNoWorkflowState();
                    return;
                }
                
                // 更新缓存（辅助作用）
                if (typeof window !== 'undefined') {
                    window._currentWorkflow = currentWorkflow;
                }
                
                // 执行分析（analyzeCurrentWorkflow 会再次从 app.graph 获取最新 workflow）
                // 如果设置了跳过缓存标志，传递 skipCache 参数
                const skipCache = window._skipCacheForFindModels || false;
                analyzeCurrentWorkflow(content, skipCache);
                // 重置标志（只使用一次）
                window._skipCacheForFindModels = false;
            } catch (error) {
                // 如果出错，重试或显示错误
                if (retryCount < maxRetries) {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return tryAnalyze();
                }
                content.innerHTML = renderLoadingState(`错误: ${error.message}`);
            }
        };
        
        await tryAnalyze();
    };
    
    // 启动分析
    startAnalysis();
    
    // 监听语言变更事件，重新渲染内容
    const languageChangeHandler = () => {
        // 如果内容已加载，重新渲染整个内容（包括统计卡片、表格等）
        if (window._currentDialogContent && window._currentDialogResult) {
            displayModelStatus(window._currentDialogContent, window._currentDialogResult);
        }
    };
    window.addEventListener('comfyui-find-models-language-changed', languageChangeHandler);
    
    // 当对话框关闭时，移除事件监听器并清理
    const originalRemove = modal.remove.bind(modal);
    modal.remove = function() {
        window.removeEventListener('comfyui-find-models-language-changed', languageChangeHandler);
        _currentDialogContent = null;
        _currentDialogResult = null;
        window._currentDialogContent = null;
        window._currentDialogResult = null;
        originalRemove();
    };
}

// 初始化
app.registerExtension({
    name: "ComfyUI.FindModels",
    async setup() {
        // 异步清理过期缓存，不阻塞初始化
        setTimeout(() => clearExpiredCache(), 1000);
        
        // 获取版本信息
        try {
            const response = await api.fetchApi("/comfyui-find-models/api/v1/system/version");
            if (response.ok) {
                const data = await response.json();
                VERSION = data.version || VERSION;
            }
        } catch (error) {
            // 忽略错误
        }
        
        // 监听 workflow 切换事件，更新缓存的 workflow
        // 这样即使切换了 workflow，也能感知到变化
        const updateWorkflowCache = () => {
            try {
                if (app?.graph) {
                    const workflow = app.graph.serialize();
                    if (workflow && workflow.nodes) {
                        if (typeof window !== 'undefined') {
                            window._currentWorkflow = workflow;
                        }
                    }
                }
            } catch (error) {
                // 忽略错误
            }
        };
        
        // 监听 workflow 加载事件（ComfyUI 会在加载 workflow 时触发）
        // 使用多种方式来监听 workflow 切换，确保能捕获到所有情况
        const setupWorkflowListener = () => {
            if (!app || !app.graph) {
                // 如果 graph 还没初始化，延迟设置监听器
                setTimeout(setupWorkflowListener, 500);
                return;
            }
            
            // 方法1: 监听 loadGraphData（加载 workflow 文件）
            if (app.graph.loadGraphData) {
                const originalLoadGraphData = app.graph.loadGraphData;
                app.graph.loadGraphData = function(...args) {
                    const result = originalLoadGraphData.apply(this, args);
                    // 延迟更新，确保 graph 已完全加载
                    setTimeout(updateWorkflowCache, 200);
                    return result;
                };
            }
            
            // 方法2: 监听可能的 workflow 变化事件
            // 使用 proxy 或直接监听 graph 的变化
            try {
                if (app.graph.onGraphRebuilt) {
                    const originalOnGraphRebuilt = app.graph.onGraphRebuilt;
                    app.graph.onGraphRebuilt = function(...args) {
                        updateWorkflowCache();
                        if (originalOnGraphRebuilt) {
                            originalOnGraphRebuilt.apply(this, args);
                        }
                    };
                }
            } catch (error) {
                // 如果无法设置监听器，忽略错误
            }
            
            // 方法3: 定期检查 workflow 是否变化（备用方案）
            // 如果 workflow 切换了，定期更新缓存
            let lastWorkflowHash = null;
            setInterval(() => {
                try {
                    if (app?.graph) {
                        const workflow = app.graph.serialize();
                        if (workflow && workflow.nodes) {
                            // 简单的 hash 来检测 workflow 是否变化
                            const currentHash = JSON.stringify(workflow.nodes.map(n => n.id)).substring(0, 100);
                            if (lastWorkflowHash !== null && lastWorkflowHash !== currentHash) {
                                // Workflow 发生了变化，更新缓存
                                updateWorkflowCache();
                            }
                            lastWorkflowHash = currentHash;
                        }
                    }
                } catch (error) {
                    // 忽略错误
                }
            }, 1000); // 每秒检查一次
        };
        
        // 初始化监听器
        setupWorkflowListener();
        
        // 监听 r 键刷新事件（ComfyUI 使用 r 键刷新节点数据）
        const setupRefreshListener = () => {
            // 监听键盘事件
            document.addEventListener('keydown', (e) => {
                // 检查是否按下了 r 键（且不在输入框中）
                if (e.key === 'r' || e.key === 'R') {
                    const target = e.target;
                    // 如果焦点不在输入框、文本区域等可编辑元素上
                    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
                        // 设置跳过缓存标志
                        window._skipCacheForFindModels = true;
                        // 如果对话框已打开，延迟重新分析工作流（等待 object_info 更新）
                        if (window._currentDialogContent) {
                            // 延迟一下，确保 ComfyUI 的 object_info 已更新
                            setTimeout(() => {
                                analyzeCurrentWorkflow(window._currentDialogContent, true);
                            }, 500);
                        }
                    }
                }
            });
        };
        
        // 延迟设置刷新监听器
        setTimeout(setupRefreshListener, 1000);
        
        // 延迟添加按钮，确保 DOM 已加载
        setTimeout(() => {
            addFindModelsButton(showFindModelsDialog);
        }, 500);
        
        // 如果 500ms 后还没添加成功，再试一次
        setTimeout(() => {
            if (!document.getElementById("find-models-button")) {
                addFindModelsButton(showFindModelsDialog);
            }
        }, 2000);
    },
});
