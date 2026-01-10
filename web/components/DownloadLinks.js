/**
 * 下载链接组件
 */

import { filterLinksBySize, filterNonExactMatches } from './LinkFilter.js';
import { renderRefreshButton } from './RefreshButton.js';
import { t } from '../i18n/i18n.js';

export function renderDownloadLinks(links, modelName, modelType, isInstalled) {
    if (links.length === 0) {
        if (!isInstalled) {
            return `<span style="color: #666; font-size: 12px;">${t('notFound')}</span>`;
        } else {
            return `<span style="color: #666; font-size: 12px;">-</span>`;
        }
    }
    
    // 先进行基本过滤：Civitai 和 Hugging Face 必须有 file_size 且 >= 10MB，Google 链接可以没有
    let filteredLinks = filterLinksBySize(links);
    
    // 如果同时有 Civitai 和 Hugging Face 的结果，进行精确匹配检查
    filteredLinks = filterNonExactMatches(filteredLinks);
    
    let html = '';
    
    for (const link of filteredLinks) {
        const linkColor = "#81c784";
        
        if (link.download_url) {
            const fileSize = link.file_size ? ` (${(link.file_size / (1024 * 1024)).toFixed(2)} MB)` : '';
            html += `
                <div style="margin-bottom: 4px;">
                    <a href="${link.download_url}" target="_blank" style="color: ${linkColor}; text-decoration: none; font-size: 12px; word-break: break-all;">
                        ${link.source} ${t('download')}${fileSize}
                    </a>
                </div>
            `;
        } else if (link.url && link.source === "Google") {
            html += `
                <div style="margin-bottom: 4px;">
                    <a href="${link.url}" target="_blank" style="color: #4285f4; text-decoration: none; font-size: 12px; word-break: break-all;">
                        🔍 ${link.source} ${t('search')}
                    </a>
                </div>
            `;
        }
    }
    
    // 添加刷新按钮（如果模型未安装）
    if (!isInstalled) {
        html += renderRefreshButton(modelName, modelType);
    }
    
    return html || (isInstalled ? `<span style="color: #666; font-size: 12px;">-</span>` : `<span style="color: #666; font-size: 12px;">${t('notFound')}</span>`);
}
