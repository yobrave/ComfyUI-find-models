/**
 * 对话框组件
 * 用于创建模态对话框容器
 */

import { getCurrentLanguage, toggleLanguage, t } from '../i18n/i18n.js';

export function createDialog(version) {
    const modal = document.createElement("div");
    modal.id = "find-models-modal";
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
        background: #2b2b2b;
        border-radius: 8px;
        padding: 20px;
        width: 1200px;
        max-width: 90vw;
        min-width: 800px;
        max-height: 90vh;
        overflow: auto;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5);
        box-sizing: border-box;
        color: #e0e0e0;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #444;
    `;

    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
    `;

    const titleRow = document.createElement("div");
    titleRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
    `;

    const title = document.createElement("h2");
    title.id = "find-models-dialog-title";
    title.textContent = t('dialogTitle');
    title.style.margin = "0";
    title.style.color = "#e0e0e0";
    title.style.flex = "1";

    // 语言切换按钮
    const languageBtn = document.createElement("button");
    languageBtn.id = "find-models-language-btn";
    languageBtn.textContent = getCurrentLanguage() === 'en' ? '中' : 'EN';
    languageBtn.style.cssText = `
        background: #4a5568;
        color: #e0e0e0;
        border: 1px solid #666;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        white-space: nowrap;
    `;
    languageBtn.title = getCurrentLanguage() === 'en' ? t('switchToChinese') : t('switchToEnglish');
    languageBtn.onmouseover = () => {
        languageBtn.style.background = '#5a6578';
        languageBtn.style.borderColor = '#777';
    };
    languageBtn.onmouseout = () => {
        languageBtn.style.background = '#4a5568';
        languageBtn.style.borderColor = '#666';
    };
    
    // 语言切换逻辑
    languageBtn.onclick = () => {
        const newLang = toggleLanguage();
        
        // 立即更新按钮和标题（响应更快）
        languageBtn.textContent = newLang === 'en' ? '中' : 'EN';
        languageBtn.title = newLang === 'en' ? t('switchToChinese') : t('switchToEnglish');
        title.textContent = t('dialogTitle');
        
        // 触发重新渲染事件（让 find_models.js 重新渲染内容）
        window.dispatchEvent(new CustomEvent('comfyui-find-models-language-changed', { detail: { language: newLang } }));
    };

    titleRow.appendChild(title);
    titleRow.appendChild(languageBtn);

    const versionSpan = document.createElement("span");
    versionSpan.textContent = `v${version}`;
    versionSpan.style.cssText = `
        font-size: 12px;
        color: #999;
        font-weight: normal;
    `;

    titleContainer.appendChild(titleRow);
    titleContainer.appendChild(versionSpan);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = `
        background: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 18px;
        margin-left: 12px;
    `;
    closeBtn.onclick = () => modal.remove();

    header.appendChild(titleContainer);
    header.appendChild(closeBtn);

    const content = document.createElement("div");
    content.id = "find-models-content";
    content.style.cssText = `
        min-height: 400px;
        width: 100%;
        box-sizing: border-box;
    `;

    dialog.appendChild(header);
    dialog.appendChild(content);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // 当对话框关闭时，清理引用
    const originalRemove = modal.remove.bind(modal);
    modal.remove = function() {
        originalRemove();
    };

    return { modal, content };
}
