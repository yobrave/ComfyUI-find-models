/**
 * 加载状态组件
 */

import { t } from '../i18n/i18n.js';

export function renderLoadingState(message = null) {
    if (!message) {
        message = t('analyzingWorkflow');
    }
    return `
        <div style="text-align: center; padding: 40px; color: #999; width: 100%; box-sizing: border-box;">
            <p>${message}</p>
        </div>
    `;
}

export function renderSearchProgress(current, total, cachedCount = 0, modelName = "") {
    const cachedText = cachedCount > 0 ? `<p style="font-size: 11px; margin-top: 5px; color: #666;">${t('usingCache', { count: cachedCount })}</p>` : '';
    return `
        <div style="text-align: center; padding: 40px; color: #999; width: 100%; box-sizing: border-box;">
            <p>${t('searchingForMissingModels')}</p>
            <p style="font-size: 12px; margin-top: 10px;">${current}/${total}: ${modelName}</p>
            ${cachedText}
        </div>
    `;
}

export function renderErrorState(errorMessage) {
    return `
        <div style="color: #f44336; padding: 20px; width: 100%; box-sizing: border-box;">
            <p><strong>${t('error', { default: 'Error' })}:</strong> ${errorMessage}</p>
            <p style="margin-top: 10px;">${t('pleaseEnsure', { default: 'Please ensure:' })}</p>
            <ul>
                <li>${t('workflowLoaded', { default: 'Workflow is loaded' })}</li>
                <li>${t('serverRunning', { default: 'ComfyUI server is running' })}</li>
            </ul>
        </div>
    `;
}

export function renderNoWorkflowState() {
    return `
        <div style="color: #ff9800; padding: 20px; text-align: center; width: 100%; box-sizing: border-box;">
            <p>⚠️ ${t('noWorkflowLoaded', { default: 'No workflow is currently loaded' })}</p>
            <p>${t('pleaseLoadWorkflow', { default: 'Please load a workflow file first' })}</p>
        </div>
    `;
}
