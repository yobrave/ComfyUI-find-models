/**
 * 加载状态组件
 */

export function renderLoadingState(message = "正在分析工作流...") {
    return `
        <div style="text-align: center; padding: 40px; color: #999; width: 100%; box-sizing: border-box;">
            <p>${message}</p>
        </div>
    `;
}

export function renderSearchProgress(current, total, cachedCount = 0, modelName = "") {
    return `
        <div style="text-align: center; padding: 40px; color: #999; width: 100%; box-sizing: border-box;">
            <p>正在搜索缺失模型的下载链接...</p>
            <p style="font-size: 12px; margin-top: 10px;">${current}/${total}: ${modelName}</p>
            ${cachedCount > 0 ? `<p style="font-size: 11px; margin-top: 5px; color: #666;">已使用缓存: ${cachedCount} 个</p>` : ''}
        </div>
    `;
}

export function renderErrorState(errorMessage) {
    return `
        <div style="color: #f44336; padding: 20px; width: 100%; box-sizing: border-box;">
            <p><strong>错误:</strong> ${errorMessage}</p>
            <p style="margin-top: 10px;">请确保：</p>
            <ul>
                <li>工作流已加载</li>
                <li>ComfyUI服务器正在运行</li>
            </ul>
        </div>
    `;
}

export function renderNoWorkflowState() {
    return `
        <div style="color: #ff9800; padding: 20px; text-align: center; width: 100%; box-sizing: border-box;">
            <p>⚠️ 当前没有加载工作流</p>
            <p>请先加载一个工作流文件</p>
        </div>
    `;
}
