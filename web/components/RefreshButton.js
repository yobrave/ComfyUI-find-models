/**
 * 刷新按钮组件
 */

import { t } from '../i18n/i18n.js';

export function renderRefreshButton(modelName, modelType) {
    return `
        <div style="margin-top: 8px;">
            <button class="refresh-model-btn" data-model-name="${modelName}" data-model-type="${modelType}" style="
                background: #2d2d2d;
                color: #64b5f6;
                border: 1px solid #444;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.2s;
            " onmouseover="this.style.background='#3d3d3d'" onmouseout="this.style.background='#2d2d2d'">
                ${t('clearCacheAndRefresh')}
            </button>
        </div>
    `;
}
