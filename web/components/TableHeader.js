/**
 * 表格头部组件
 */

export function renderTableHeader() {
    return `
        <h3 style="color: #e0e0e0;">📋 模型列表</h3>
        <div style="background: #2d2d2d; border: 1px solid #444; border-radius: 4px; padding: 12px; margin-bottom: 16px; color: #999; font-size: 12px;">
            💡 <strong style="color: #64b5f6;">提示：</strong>点击打开 Google 搜索页面（限制在 Civitai、Hugging Face 和 GitHub），手动查找下载链接
        </div>
        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <label for="model-search-input" style="color: #e0e0e0; font-size: 14px; white-space: nowrap;">🔍 搜索模型：</label>
            <input type="text" 
                   id="model-search-input" 
                   placeholder="输入模型名称进行搜索..." 
                   style="flex: 1; max-width: 400px; padding: 8px 12px; background: #2d2d2d; border: 1px solid #555; border-radius: 4px; color: #e0e0e0; font-size: 14px; outline: none; transition: border-color 0.2s;"
                   onfocus="this.style.borderColor='#64b5f6';"
                   onblur="this.style.borderColor='#555';">
            <button id="clear-search-btn" 
                    style="padding: 8px 16px; background: #4a5568; color: #e0e0e0; border: 1px solid #666; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s; display: none;"
                    onmouseover="this.style.background='#5a6578';"
                    onmouseout="this.style.background='#4a5568';">
                清除
            </button>
        </div>
        <div style="overflow-x: auto; margin-bottom: 20px; width: 100%; box-sizing: border-box;">
            <table style="width: 100%; min-width: 1000px; border-collapse: collapse; background: #1e1e1e; box-shadow: 0 2px 4px rgba(0,0,0,0.3); table-layout: fixed;">
                <thead>
                    <tr style="background: #2d2d2d; border-bottom: 2px solid #444;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-weight: bold; width: 200px; max-width: 200px; color: #e0e0e0;">模型名</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-weight: bold; width: 200px; max-width: 200px; color: #e0e0e0;">是否已安装</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-weight: bold; width: 200px; max-width: 200px; color: #e0e0e0;">本地目录</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-weight: bold; width: 200px; max-width: 200px; color: #e0e0e0;">模型页面</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-weight: bold; width: 200px; max-width: 200px; color: #e0e0e0;">下载链接</th>
                    </tr>
                </thead>
                <tbody id="models-table-body">
    `;
}

export function renderTableFooter() {
    return `
                </tbody>
            </table>
        </div>
    `;
}
