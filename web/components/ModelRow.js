/**
 * 模型表格行组件
 */

import { renderModelPageLinks } from './ModelPageLinks.js';
import { renderDownloadLinks } from './DownloadLinks.js';
import { renderLocalPath } from './LocalPath.js';
import { renderSpinner } from './Spinner.js';
import { t } from '../i18n/i18n.js';

export function renderModelRow(model, links, modelTypeToDir, showLoading = false) {
    const statusColor = model.installed ? "#81c784" : "#e57373";
    const statusText = model.installed ? `✓ ${t('installed')}` : `✗ ${t('missing')}`;
    const rowBgColor = model.installed ? "#1e2e1e" : "#2e1e1e";
    const rowId = `model-row-${model.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    // 本地目录
    const localPathHtml = renderLocalPath(model, model.type, modelTypeToDir);
    
    // 模型页面链接（如果需要显示加载状态，显示加载动画）
    const modelPageHtml = showLoading ? renderSpinner(t('searching')) : renderModelPageLinks(links, model.installed);
    
    // 下载链接（如果需要显示加载状态，显示加载动画）
    const downloadLinksHtml = showLoading ? renderSpinner(t('searching')) : renderDownloadLinks(links, model.name, model.type, model.installed);
    
    // 高亮按钮（为每个节点创建一个按钮）
    let highlightButtonsHtml = '';
    if (model.nodeIds && model.nodeIds.length > 0) {
        // 为每个节点ID创建一个单独的按钮
        // 如果只有一个节点，显示 📍；如果有多个节点，显示 📍1, 📍2, 📍3...
        highlightButtonsHtml = model.nodeIds.map((nodeId, index) => `
            <button class="highlight-node-btn" 
                    data-node-id="${nodeId}" 
                    data-node-index="${index}"
                    style="margin-left: 4px; padding: 2px 6px; font-size: 10px; background: #4a5568; color: #e0e0e0; border: 1px solid #666; border-radius: 3px; cursor: pointer; transition: all 0.2s; vertical-align: middle;"
                    onmouseover="this.style.background='#5a6578'; this.style.borderColor='#777';"
                    onmouseout="this.style.background='#4a5568'; this.style.borderColor='#666';"
                    title="${t('highlightTooltip', { index: index + 1, nodeId: nodeId })}">
                📍${model.nodeIds.length > 1 ? (index + 1) : ''}
            </button>
        `).join('');
    }
    
    const familyText = model.families && model.families.length > 0 
        ? ` | ${t('family')}: ${model.families.join(', ')}` 
        : ` | ${t('family')}: ${t('unknown')}`;
    
    return `
        <tr id="${rowId}" style="background: ${rowBgColor}; border-bottom: 1px solid #333;">
            <td style="padding: 12px; border-bottom: 1px solid #333; width: 200px; max-width: 200px; word-wrap: break-word; overflow-wrap: break-word; color: #e0e0e0;">
                <div style="font-weight: bold; color: #e0e0e0;">${model.name}</div>
                <div style="font-size: 11px; color: #999; margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <span>
                        ${t('type')}: ${model.type}${familyText}
                    </span>
                    ${highlightButtonsHtml}
                </div>
            </td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #333; width: 200px; max-width: 200px;">
                <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #333; width: 200px; max-width: 200px; word-wrap: break-word; overflow-wrap: break-word;">
                ${localPathHtml}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #333; width: 200px; max-width: 200px; word-wrap: break-word; overflow-wrap: break-word;">
                ${modelPageHtml}
            </td>
            <td class="download-links-cell" style="padding: 12px; border-bottom: 1px solid #333; width: 200px; max-width: 200px; word-wrap: break-word; overflow-wrap: break-word;">
                ${downloadLinksHtml}
            </td>
        </tr>
    `;
}
