/**
 * 对话框组件
 * 用于创建模态对话框容器
 */

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
    `;

    const title = document.createElement("h2");
    title.textContent = "🔍 模型查找器";
    title.style.margin = "0";
    title.style.color = "#e0e0e0";

    const versionSpan = document.createElement("span");
    versionSpan.textContent = `v${version}`;
    versionSpan.style.cssText = `
        font-size: 12px;
        color: #999;
        font-weight: normal;
    `;

    titleContainer.appendChild(title);
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

    return { modal, content };
}
