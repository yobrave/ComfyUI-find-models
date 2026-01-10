/**
 * 模型页面链接组件
 */

import { filterLinksBySize, filterNonExactMatches } from './LinkFilter.js';
import { t } from '../i18n/i18n.js';

export function renderModelPageLinks(links, isInstalled) {
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
    
    // 按来源类型分组链接
    const linksBySource = {};
    for (const link of filteredLinks) {
        const source = link.source || "其他";
        if (!linksBySource[source]) {
            linksBySource[source] = [];
        }
        linksBySource[source].push(link);
    }
    
    // 按类型顺序显示（保持原始字符串，因为用于匹配键值）
    const sourceOrder = ["Civitai", "Hugging Face", "Google → Civitai", "Google → Hugging Face", "Google → GitHub", "Google", "其他"];
    let isFirstGroup = true;
    let html = '';
    
    for (const sourceType of sourceOrder) {
        if (linksBySource[sourceType] && linksBySource[sourceType].length > 0) {
            if (!isFirstGroup) {
                html += `<div style="margin: 6px 0; border-top: 1px solid #444;"></div>`;
            }
            isFirstGroup = false;
            
            for (const link of linksBySource[sourceType]) {
                const linkColor = "#64b5f6";
                html += `
                    <div style="margin-bottom: 4px;">
                        <a href="${link.url}" target="_blank" style="color: ${linkColor}; text-decoration: none; font-size: 12px; word-break: break-all;">
                            ${link.source}${link.name ? `: ${link.name}` : ''}
                        </a>
                        ${link.version ? `<span style="color: #999; font-size: 11px;"> (${link.version})</span>` : ''}
                    </div>
                `;
            }
        }
    }
    
    // 显示其他未分类的链接
    for (const [sourceType, sourceLinks] of Object.entries(linksBySource)) {
        if (!sourceOrder.includes(sourceType)) {
            if (!isFirstGroup) {
                html += `<div style="margin: 6px 0; border-top: 1px solid #444;"></div>`;
            }
            isFirstGroup = false;
            
            for (const link of sourceLinks) {
                const linkColor = "#64b5f6";
                html += `
                    <div style="margin-bottom: 4px;">
                        <a href="${link.url}" target="_blank" style="color: ${linkColor}; text-decoration: none; font-size: 12px; word-break: break-all;">
                            ${link.source}${link.name ? `: ${link.name}` : ''}
                        </a>
                        ${link.version ? `<span style="color: #999; font-size: 11px;"> (${link.version})</span>` : ''}
                    </div>
                `;
            }
        }
    }
    
    return html || (isInstalled ? `<span style="color: #666; font-size: 12px;">-</span>` : `<span style="color: #666; font-size: 12px;">${t('notFound')}</span>`);
}
