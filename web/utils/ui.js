/**
 * UI 相关功能模块
 */

import { app } from "../../../scripts/app.js";

// 添加工具栏按钮
export function addFindModelsButton(showFindModelsDialog) {
    // 尝试多个可能的选择器
    let actionbar = document.querySelector(".actionbar-container");
    if (!actionbar) {
        actionbar = document.querySelector(".comfy-menu");
    }
    if (!actionbar) {
        actionbar = document.querySelector("#comfyui-header");
    }
    if (!actionbar) {
        // 如果都找不到，尝试查找包含按钮的容器
        const header = document.querySelector("header");
        if (header) {
            actionbar = header;
        }
    }
    
    if (!actionbar) {
        setTimeout(() => addFindModelsButton(showFindModelsDialog), 100);
        return;
    }

    // 检查按钮是否已存在，避免重复添加
    if (document.getElementById("find-models-button")) {
        return;
    }

    // 创建按钮
    const button = document.createElement("button");
    button.id = "find-models-button";
    button.textContent = "🔍 find-models";
    button.className = "comfy-menu-button";
    button.style.cssText = `
        margin-left: 10px;
        padding: 8px 16px;
        cursor: pointer;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        z-index: 1000;
        position: relative;
    `;

    button.onclick = () => {
        showFindModelsDialog();
    };

    try {
        actionbar.appendChild(button);
    } catch (error) {
        // 如果添加失败，尝试在 body 中添加
        setTimeout(() => {
            const body = document.body;
            if (body) {
                button.style.position = "fixed";
                button.style.top = "10px";
                button.style.right = "10px";
                button.style.zIndex = "10000";
                body.appendChild(button);
            }
        }, 500);
    }
}

// 创建鼠标位置提示工具
export function createMousePosTooltip() {
    // 创建 tooltip 元素
    const tooltip = document.createElement("div");
    tooltip.id = "comfyui-find-models-pos-tooltip";
    tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        pointer-events: none;
        z-index: 10000;
        display: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(tooltip);
    
    return tooltip;
}

// 设置鼠标位置提示
export function setupMousePosTooltip() {
    if (!app || !app.canvas) {
        setTimeout(setupMousePosTooltip, 500);
        return;
    }
    
    const tooltip = createMousePosTooltip();
    const canvas = app.canvas;
    
    // 尝试多种方式获取 canvas DOM 元素
    let canvasElement = null;
    if (canvas.canvas) {
        canvasElement = canvas.canvas;
    } else if (canvas.domElement) {
        canvasElement = canvas.domElement;
    } else if (canvas.node && canvas.node.nodeName === 'CANVAS') {
        canvasElement = canvas.node;
    } else if (canvas instanceof HTMLElement) {
        canvasElement = canvas;
    } else {
        // 尝试从 document 中查找 canvas 元素
        canvasElement = document.querySelector('canvas.lgraphcanvas, canvas[data-litegraph]');
    }
    
    if (!canvasElement) {
        setTimeout(setupMousePosTooltip, 500);
        return;
    }
    
    // 监听鼠标移动事件
    canvasElement.addEventListener("mousemove", (e) => {
        try {
            // 获取鼠标在 canvas 中的位置
            let pos = null;
            
            // 方法1: 使用 LiteGraph 的内置方法
            if (canvas.convertEventToCanvasOffset) {
                pos = canvas.convertEventToCanvasOffset(e);
            } 
            // 方法2: 使用 graph_mouse 属性（如果可用）
            else if (canvas.graph_mouse && Array.isArray(canvas.graph_mouse)) {
                pos = canvas.graph_mouse;
            } 
            // 方法3: 手动计算（如果 canvas 有 getBoundingClientRect）
            else if (canvasElement.getBoundingClientRect) {
                const rect = canvasElement.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                // 需要转换为 canvas 坐标（考虑缩放和平移）
                if (canvas.canvas && canvas.canvas.canvas) {
                    const transform = canvas.canvas.canvas.getTransform ? canvas.canvas.canvas.getTransform() : null;
                    if (transform) {
                        pos = [
                            (x - transform.e) / transform.a,
                            (y - transform.f) / transform.d
                        ];
                    } else {
                        pos = [x, y];
                    }
                } else {
                    pos = [x, y];
                }
            }
            
            // 显示 tooltip
            if (pos && Array.isArray(pos) && pos.length >= 2) {
                tooltip.textContent = `pos: [${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}]`;
                tooltip.style.display = "block";
                tooltip.style.left = (e.clientX + 10) + "px";
                tooltip.style.top = (e.clientY + 10) + "px";
            } else {
                tooltip.style.display = "none";
            }
        } catch (error) {
            tooltip.style.display = "none";
        }
    });
    
    // 鼠标离开 canvas 时隐藏 tooltip
    canvasElement.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
}
