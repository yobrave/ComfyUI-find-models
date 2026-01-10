/**
 * ComfyUI Find Models - 前端界面主文件
 * 在ComfyUI界面中添加按钮和弹窗显示模型状态
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createDialog } from "./components/Dialog.js";
import { renderLoadingState } from "./components/LoadingState.js";
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
    
    // 获取当前工作流并分析
    analyzeCurrentWorkflow(content);
    
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
