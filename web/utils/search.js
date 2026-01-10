/**
 * 搜索和排序功能模块
 */

// 存储原始行顺序和分隔行索引
let _originalRowsOrder = null;
let _originalSeparatorIndex = -1;

// 保存原始行顺序
export function saveOriginalRowsOrder(contentDiv) {
    const tbody = contentDiv.querySelector('#models-table-body');
    if (!tbody) {
        return;
    }
    // 保存原始行的克隆（深拷贝）
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    _originalSeparatorIndex = allRows.findIndex(row => row.classList.contains('model-separator-row'));
    _originalRowsOrder = allRows.map((row, index) => ({
        row: row.cloneNode(true),
        isSeparator: row.classList.contains('model-separator-row'),
        originalIndex: index
    }));
}

// 恢复原始排序
export function restoreOriginalOrder(contentDiv, bindRefreshButtons, bindHighlightButtons) {
    const tbody = contentDiv.querySelector('#models-table-body');
    if (!tbody || !_originalRowsOrder) {
        return;
    }
    
    // 清空 tbody
    tbody.innerHTML = '';
    
    // 恢复原始顺序
    _originalRowsOrder.forEach(item => {
        tbody.appendChild(item.row.cloneNode(true));
    });
    
    // 重新绑定事件
    bindRefreshButtons(contentDiv);
    bindHighlightButtons(contentDiv);
}

// 搜索并排序模型列表
export function searchAndSortModels(contentDiv, searchTerm, bindRefreshButtons, bindHighlightButtons) {
    if (!searchTerm || searchTerm.trim() === '') {
        restoreOriginalOrder(contentDiv, bindRefreshButtons, bindHighlightButtons);
        return;
    }
    
    const tbody = contentDiv.querySelector('#models-table-body');
    if (!tbody) {
        return;
    }
    
    // 如果没有保存原始顺序，先保存
    if (!_originalRowsOrder) {
        saveOriginalRowsOrder(contentDiv);
    }
    
    // 从原始顺序开始搜索（使用保存的原始行）
    if (!_originalRowsOrder || _originalRowsOrder.length === 0) {
        return;
    }
    
    // 使用保存的原始行
    const modelRows = _originalRowsOrder.filter(item => !item.isSeparator);
    const separatorRowItem = _originalRowsOrder.find(item => item.isSeparator);
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    // 为每个模型行计算匹配度和使用状态
    const rowsWithScore = modelRows.map((item) => {
        const row = item.row;
        const modelNameCell = row.querySelector('td:first-child');
        if (!modelNameCell) {
            return { row: row.cloneNode(true), score: 0, modelName: '', isUsed: true };
        }
        
        // 获取模型名称（排除按钮和额外信息）
        const nameDiv = modelNameCell.querySelector('div:first-child > div:first-child');
        const modelName = nameDiv ? nameDiv.textContent.trim() : modelNameCell.textContent.trim();
        const modelNameLower = modelName.toLowerCase();
        
        // 判断是否已使用：在原始顺序中，如果分隔行存在，分隔行之前的为已使用，之后的为未使用
        const isUsed = _originalSeparatorIndex === -1 || item.originalIndex < _originalSeparatorIndex;
        
        let score = 0;
        
        // 完全匹配
        if (modelNameLower === searchLower) {
            score = 1000;
        }
        // 开头匹配
        else if (modelNameLower.startsWith(searchLower)) {
            score = 500;
        }
        // 包含匹配
        else if (modelNameLower.includes(searchLower)) {
            score = 100;
        }
        // 部分匹配（单词匹配）
        else {
            const words = modelNameLower.split(/[_\-\s\.]+/);
            const searchWords = searchLower.split(/[_\-\s\.]+/);
            let wordMatchCount = 0;
            for (const searchWord of searchWords) {
                if (words.some(word => word.includes(searchWord))) {
                    wordMatchCount++;
                }
            }
            score = wordMatchCount * 10;
        }
        
        return { row: row.cloneNode(true), score, modelName: modelName, isUsed: isUsed };
    });
    
    // 按使用状态和匹配度排序
    // 排序优先级：1. 使用状态（已使用 > 未使用） 2. 匹配度（匹配 > 不匹配） 3. 匹配分数 4. 名称
    rowsWithScore.sort((a, b) => {
        // 先按使用状态分组：已使用的在前
        if (a.isUsed !== b.isUsed) {
            return a.isUsed ? -1 : 1;
        }
        
        // 如果使用状态相同，按是否匹配分组：匹配的在前
        const aMatched = a.score > 0;
        const bMatched = b.score > 0;
        if (aMatched !== bMatched) {
            return aMatched ? -1 : 1;
        }
        
        // 如果匹配状态也相同，按匹配分数排序
        if (a.score !== b.score) {
            return b.score - a.score; // 分数高的在前
        }
        
        // 分数相同，按名称排序
        return a.modelName.localeCompare(b.modelName);
    });
    
    // 分离已使用和未使用的行
    const usedRows = [];
    const unusedRows = [];
    
    for (const item of rowsWithScore) {
        if (item.isUsed) {
            usedRows.push(item);
        } else {
            unusedRows.push(item);
        }
    }
    
    // 在已使用的行中，匹配的在前，不匹配的在后
    const usedMatchedRows = usedRows.filter(item => item.score > 0).map(item => item.row);
    const usedUnmatchedRows = usedRows.filter(item => item.score === 0).map(item => item.row);
    
    // 在未使用的行中，匹配的在前，不匹配的在后
    const unusedMatchedRows = unusedRows.filter(item => item.score > 0).map(item => item.row);
    const unusedUnmatchedRows = unusedRows.filter(item => item.score === 0).map(item => item.row);
    
    // 清空 tbody
    tbody.innerHTML = '';
    
    // 1. 先添加所有已使用的行（匹配的在前，不匹配的在后）
    if (usedMatchedRows.length > 0 || usedUnmatchedRows.length > 0) {
        usedMatchedRows.forEach(row => tbody.appendChild(row));
        usedUnmatchedRows.forEach(row => tbody.appendChild(row));
    }
    
    // 2. 如果有已使用的行和未使用的行，添加分隔行
    if (usedRows.length > 0 && unusedRows.length > 0 && separatorRowItem) {
        tbody.appendChild(separatorRowItem.row.cloneNode(true));
    }
    
    // 3. 再添加所有未使用的行（匹配的在前，不匹配的在后）
    if (unusedMatchedRows.length > 0 || unusedUnmatchedRows.length > 0) {
        unusedMatchedRows.forEach(row => tbody.appendChild(row));
        unusedUnmatchedRows.forEach(row => tbody.appendChild(row));
    }
    
    // 重新绑定事件（因为 DOM 重新排列了）
    bindRefreshButtons(contentDiv);
    bindHighlightButtons(contentDiv);
}

// 绑定搜索功能
export function bindSearchFunctionality(contentDiv, searchAndSortModels, restoreOriginalOrder, bindRefreshButtons, bindHighlightButtons) {
    const searchInput = contentDiv.querySelector('#model-search-input');
    const clearBtn = contentDiv.querySelector('#clear-search-btn');
    
    if (!searchInput) {
        return;
    }
    
    // 搜索输入事件
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        
        if (searchTerm) {
            // 显示清除按钮
            if (clearBtn) {
                clearBtn.style.display = 'block';
            }
            // 执行搜索排序
            searchAndSortModels(contentDiv, searchTerm, bindRefreshButtons, bindHighlightButtons);
        } else {
            // 隐藏清除按钮
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }
            // 恢复原始顺序
            restoreOriginalOrder(contentDiv, bindRefreshButtons, bindHighlightButtons);
        }
    });
    
    // 清除按钮事件
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            restoreOriginalOrder(contentDiv, bindRefreshButtons, bindHighlightButtons);
        });
    }
}
