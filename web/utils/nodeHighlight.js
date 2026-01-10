/**
 * 节点高亮功能模块
 */

import { app } from "../../../scripts/app.js";

// 高亮节点函数
export function highlightNodes(nodeIds) {
    if (!app || !app.graph) {
        // console.warn("[ComfyUI-find-models] 无法访问 ComfyUI graph");
        return;
    }
    
    try {
        // 清除之前的高亮
        clearNodeHighlights();
        
        // 存储当前高亮的节点ID
        window._highlightedNodeIds = nodeIds;
        
        // 高亮指定的节点
        const nodesToHighlight = [];
        for (const nodeId of nodeIds) {
            // 尝试多种方式获取节点
            let node = app.graph.getNodeById(nodeId);
            if (!node) {
                // 如果直接获取失败，尝试在节点列表中查找
                const allNodes = app.graph._nodes || app.graph.nodes || [];
                node = allNodes.find(n => n.id === nodeId || n.id === String(nodeId));
            }
            
            if (node) {
                nodesToHighlight.push(node);
                // console.log(`[ComfyUI-find-models] 找到节点 ID: ${nodeId}, 类型: ${node.type || node.class_type || 'unknown'}`);
                
                // 保存原始绘制函数
                if (!node.oldDrawNode) {
                    node.oldDrawNode = node.onDrawBackground;
                }
                // 备份原始绘制函数
                
                node.onDrawForeground = function(ctx) {
                    // 在节点前景绘制红色粗外框
                    ctx.save();
                    ctx.strokeStyle = "red";
                    ctx.lineWidth = 10; // 设置粗细
                    const margin = 5;   // 外扩边距
                    // 绘制矩形（根据节点尺寸）
                    ctx.strokeRect(
                        -margin, 
                        -LiteGraph.NODE_TITLE_HEIGHT - margin, 
                        this.size[0] + margin * 2, 
                        this.size[1] + LiteGraph.NODE_TITLE_HEIGHT + margin * 2
                    );
                    ctx.restore();
                };
                
                node.setDirtyCanvas(true, true);
                app.canvas.draw(true, true);
            } else {
                // console.warn(`[ComfyUI-find-models] 未找到节点 ID: ${nodeId} (类型: ${typeof nodeId})`);
                // 列出所有可用的节点ID用于调试
                if (app.graph._nodes) {
                    const availableIds = app.graph._nodes.map(n => n.id).slice(0, 10);
                    // console.log(`[ComfyUI-find-models] 可用的节点ID示例: ${availableIds.join(', ')}`);
                }
            }
        }
        
        if (nodesToHighlight.length > 0) {
            // 定位到第一个节点
            const firstNode = nodesToHighlight[0];

            app.canvas.centerOnNode(firstNode); 

            // 10秒后自动清除高亮
            if (window._highlightTimeout) {
                clearTimeout(window._highlightTimeout);
            }
            window._highlightTimeout = setTimeout(() => {
                clearNodeHighlights();
            }, 10000);
        } else {
            // console.warn("[ComfyUI-find-models] 没有找到任何节点进行高亮");
        }
    } catch (error) {
        // console.error("[ComfyUI-find-models] 高亮节点时出错:", error);
    }
}

// 清除节点高亮
export function clearNodeHighlights() {
    if (!app || !app.graph || !window._highlightedNodeIds) {
        return;
    }
    
    try {
        for (const nodeId of window._highlightedNodeIds) {
            const node = app.graph.getNodeById(nodeId);
            if (node) {
                // 恢复原始颜色
                if (node.oldDrawNode !== undefined) {
                    node.onDrawForeground = node.oldDrawNode;
                }
                node.setDirtyCanvas(true);
            }
        }
        
        window._highlightedNodeIds = null;
        if (window._highlightTimeout) {
            clearTimeout(window._highlightTimeout);
            window._highlightTimeout = null;
        }
    } catch (error) {
        // console.error("[ComfyUI-find-models] 清除高亮时出错:", error);
    }
}

// 绑定高亮按钮事件
export function bindHighlightButtons(contentDiv) {
    const highlightButtons = contentDiv.querySelectorAll('.highlight-node-btn');
    
    highlightButtons.forEach(btn => {
        btn.onclick = () => {
            const nodeIdStr = btn.getAttribute('data-node-id');
            const nodeIndex = btn.getAttribute('data-node-index');
            
            if (nodeIdStr) {
                const nodeId = parseInt(nodeIdStr.trim());
                if (!isNaN(nodeId)) {
                    // console.log(`[ComfyUI-find-models] 点击高亮按钮，节点索引: ${nodeIndex}, 节点ID: ${nodeId}`);
                    // 只高亮单个节点
                    highlightNodes([nodeId]);
                }
            } else {
                // 兼容旧的实现方式（如果还有使用 data-node-ids 的按钮）
                const nodeIdsStr = btn.getAttribute('data-node-ids');
                if (nodeIdsStr) {
                    const nodeIds = nodeIdsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    // console.log(`[ComfyUI-find-models] 点击高亮按钮（旧格式），节点IDs: ${nodeIds.join(', ')}`);
                    if (nodeIds.length > 0) {
                        highlightNodes(nodeIds);
                    }
                }
            }
        };
    });
}
