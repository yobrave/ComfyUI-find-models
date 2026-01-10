/**
 * 统计信息卡片组件
 */

import { t } from '../i18n/i18n.js';

export function renderStatsCards(totalRequired, installedCount, missingCount) {
    return `
        <div style="margin-bottom: 20px;">
            <h3 style="color: #e0e0e0;">📊 ${t('statistics')}</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                <div style="background: #1e3a5f; padding: 15px; border-radius: 4px; border: 1px solid #2d4a6b;">
                    <div style="font-size: 24px; font-weight: bold; color: #64b5f6;">${totalRequired}</div>
                    <div style="color: #b0b0b0;">${t('totalModels')}</div>
                </div>
                <div style="background: #1e3d1e; padding: 15px; border-radius: 4px; border: 1px solid #2d5a2d;">
                    <div style="font-size: 24px; font-weight: bold; color: #81c784;">${installedCount}</div>
                    <div style="color: #b0b0b0;">${t('installed')}</div>
                </div>
                <div style="background: #3d1e1e; padding: 15px; border-radius: 4px; border: 1px solid #5a2d2d;">
                    <div style="font-size: 24px; font-weight: bold; color: #e57373;">${missingCount}</div>
                    <div style="color: #b0b0b0;">${t('missing')}</div>
                </div>
            </div>
        </div>
    `;
}
