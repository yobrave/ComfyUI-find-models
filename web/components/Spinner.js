/**
 * 加载动画组件
 */

export function renderSpinner(message = "加载中...") {
    return `
        <div style="display: flex; align-items: center; gap: 8px;">
            <div class="spinner" style="width: 16px; height: 16px; border: 2px solid #333; border-top: 2px solid #64b5f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span style="color: #999; font-size: 12px;">${message}</span>
        </div>
    `;
}

export function ensureSpinnerStyle() {
    // 添加CSS动画（如果还没有）
    if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}
