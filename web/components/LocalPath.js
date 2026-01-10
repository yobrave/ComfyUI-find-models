/**
 * 本地路径组件
 */

export function renderLocalPath(modelInfo, modelType, modelTypeToDir) {
    if (modelInfo.installed && modelInfo.localPath) {
        return `
            <div style="font-size: 12px; color: #81c784; font-family: monospace;">
                models/${modelInfo.localPath}
            </div>
        `;
    } else if (modelInfo.installed) {
        const dirName = modelTypeToDir[modelType] || "checkpoints";
        return `
            <div style="font-size: 12px; color: #81c784; font-family: monospace;">
                models/${dirName}/
            </div>
        `;
    } else {
        return `<span style="color: #666; font-size: 12px;">-</span>`;
    }
}
