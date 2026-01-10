/**
 * 辅助函数模块
 */

import { t } from '../i18n/i18n.js';

// 按派系分组
export function groupByFamily(modelInfo) {
    const byFamily = {};
    
    for (const info of Object.values(modelInfo)) {
        for (const family of info.families) {
            if (!byFamily[family]) {
                byFamily[family] = [];
            }
            byFamily[family].push(info);
        }
    }
    
    return byFamily;
}

// 按类型分组
export function groupByType(modelInfo) {
    const byType = {};
    
    for (const info of Object.values(modelInfo)) {
        if (!byType[info.type]) {
            byType[info.type] = [];
        }
        byType[info.type].push(info);
    }
    
    return byType;
}

// 渲染分隔行（用于区分已使用和未使用的模型）
export function renderSeparatorRow() {
    return `
        <tr class="model-separator-row" style="background: #2d2d2d; border-top: 2px solid #555; border-bottom: 2px solid #555;">
            <td colspan="5" style="padding: 16px; text-align: center; color: #999; font-size: 13px; font-style: italic;">
                ${t('unusedModelsSeparator')}
            </td>
        </tr>
    `;
}
