# 节点搜索请求流程文档

本文档详细说明 ComfyUI-Manager 项目中搜索节点功能的实现机制和请求流程。

## 概述

ComfyUI-Manager 的节点搜索功能采用**纯前端实现**，用户在搜索框中输入关键词时，系统会在已加载的节点数据中进行实时过滤，**不需要向后端发送搜索请求**。这种设计可以显著提升搜索响应速度，减少网络开销。

## 架构设计

### 数据流图

```
用户输入搜索关键词
    ↓
前端事件监听 (input 事件)
    ↓
更新 keywords 变量
    ↓
调用 updateGrid() 方法
    ↓
rowFilter 函数执行过滤
    ↓
highlightKeywordsFilter 匹配关键词
    ↓
更新网格显示结果
```

## 详细实现

### 1. 搜索输入框初始化

搜索输入框在 `CustomNodesManager` 类的 `init()` 方法中创建：

**文件位置**: `js/custom-nodes-manager.js`

```javascript
const header = $el("div.cn-manager-header.px-2", {}, [
    createSettingsCombo("Filter", $el("select.cn-manager-filter")),
    $el("input.cn-manager-keywords.p-inputtext.p-component", { 
        type: "search", 
        placeholder: "Search" 
    }),
    // ... 其他元素
]);
```

### 2. 搜索事件绑定

搜索功能通过事件监听器实现，当用户在搜索框中输入时触发：

**文件位置**: `js/custom-nodes-manager.js` (第 422-431 行)

```javascript
".cn-manager-keywords": {
    input: (e) => {
        const keywords = `${e.target.value}`.trim();
        if (keywords !== this.keywords) {
            this.keywords = keywords;
            this.updateGrid();
        }
    },
    focus: (e) => e.target.select()
}
```

**关键点**:
- 监听 `input` 事件，实现实时搜索
- 使用 `trim()` 去除首尾空格
- 只有当关键词发生变化时才更新网格，避免不必要的重绘
- 调用 `updateGrid()` 方法触发过滤

### 3. 网格过滤逻辑

搜索过滤通过网格组件的 `rowFilter` 选项实现：

**文件位置**: `js/custom-nodes-manager.js` (第 603-619 行)

```javascript
rowFilter: (rowItem) => {
    // 定义可搜索的列
    const searchableColumns = ["title", "author", "description"];
    if (this.hasAlternatives()) {
        searchableColumns.push("alternatives");
    }

    // 使用 highlightKeywordsFilter 进行关键词匹配
    let shouldShown = grid.highlightKeywordsFilter(
        rowItem, 
        searchableColumns, 
        this.keywords
    );

    // 如果关键词匹配，再检查过滤器
    if (shouldShown) {
        if(this.filter && rowItem.filterTypes) {
            shouldShown = rowItem.filterTypes.includes(this.filter);
        }
    }

    return shouldShown;
}
```

**搜索字段**:
- `title`: 节点标题
- `author`: 作者名称
- `description`: 节点描述
- `alternatives`: 替代方案（仅在显示替代方案模式时）

**过滤逻辑**:
1. 首先使用 `highlightKeywordsFilter` 在指定列中搜索关键词
2. 如果匹配成功，再检查是否满足当前选择的过滤器条件
3. 返回布尔值决定该行是否显示

### 4. 数据加载流程

虽然搜索是前端实现，但节点数据需要从后端加载：

**文件位置**: `js/custom-nodes-manager.js` (第 1924-1946 行)

```javascript
async loadData(show_mode = ShowMode.NORMAL) {
    this.showLoading();
    
    const mode = manager_instance.datasrc_combo.value;
    this.showStatus(`Loading custom nodes (${mode}) ...`);
    
    const skip_update = this.show_mode === ShowMode.UPDATE ? "" : "&skip_update=true";
    
    // 向后端发送请求获取节点列表
    const res = await fetchData(`/customnode/getlist?mode=${mode}${skip_update}`);
    
    if (res.error) {
        this.showError("Failed to get custom node list.");
        this.hideLoading();
        return;
    }
    
    const { channel, node_packs } = res.data;
    this.custom_nodes = node_packs;
    
    // 处理数据并渲染网格
    await this.loadNodes(node_packs);
    this.renderGrid();
    this.hideLoading();
}
```

**API 端点**: `/customnode/getlist`

**请求参数**:
- `mode`: 数据源模式（如 "default", "local" 等）
- `skip_update`: 是否跳过更新检查（"true" 或空字符串）

### 5. 后端 API 实现

后端提供节点列表的 API 端点：

**文件位置**: `glob/manager_server.py` (第 867-906 行)

```python
@routes.get("/customnode/getlist")
async def fetch_customnode_list(request):
    """
    provide unified custom node list
    """
    if request.rel_url.query.get("skip_update", '').lower() == "true":
        skip_update = True
    else:
        skip_update = False

    if request.rel_url.query["mode"] == "local":
        channel = 'local'
    else:
        channel = core.get_config()['channel_url']

    # 获取统一的节点列表
    node_packs = await core.get_unified_total_nodes(
        channel, 
        request.rel_url.query["mode"], 
        'cache'
    )
    
    # 填充 GitHub 统计信息
    json_obj_github = core.get_data_by_mode(
        request.rel_url.query["mode"], 
        'github-stats.json', 
        'default'
    )
    
    # 填充收藏信息
    json_obj_extras = core.get_data_by_mode(
        request.rel_url.query["mode"], 
        'extras.json', 
        'default'
    )

    core.populate_github_stats(node_packs, await json_obj_github)
    core.populate_favorites(node_packs, await json_obj_extras)

    # 检查 Git 节点包的状态
    check_state_of_git_node_pack(
        node_packs, 
        not skip_update, 
        do_update_check=not skip_update
    )

    # 填充 Markdown 内容
    for v in node_packs.values():
        populate_markdown(v)

    # 处理频道信息
    if channel != 'local':
        found = 'custom'
        for name, url in core.get_channel_dict().items():
            if url == channel:
                found = name
                break
        channel = found

    result = dict(channel=channel, node_packs=node_packs.to_dict())
    return web.json_response(result, content_type='application/json')
```

**后端处理流程**:
1. 解析请求参数（mode, skip_update）
2. 获取统一的节点列表数据
3. 填充附加信息（GitHub 统计、收藏状态等）
4. 检查 Git 仓库状态（可选）
5. 处理 Markdown 内容
6. 返回 JSON 格式的节点列表

### 6. 数据获取工具函数

前端使用 `fetchData` 函数发送请求：

**文件位置**: `js/common.js` (第 366-405 行)

```javascript
export async function fetchData(route, options) {
    let err;
    const res = await api.fetchApi(route, options).catch(e => {
        err = e;
    });

    if (!res) {
        return {
            status: 400,
            error: new Error("Unknown Error")
        }
    }

    const { status, statusText } = res;
    if (err) {
        return {
            status,
            error: err
        }
    }

    if (status !== 200) {
        return {
            status,
            error: new Error(statusText || "Unknown Error")
        }
    }

    const data = await res.json();
    if (!data) {
        return {
            status,
            error: new Error(`Failed to load data: ${route}`)
        }
    }
    return {
        status,
        data
    }
}
```

## 关键特性

### 1. 实时搜索
- 用户输入时立即触发过滤
- 无需等待网络请求
- 响应速度极快

### 2. 多字段搜索
- 支持在标题、作者、描述中搜索
- 可扩展到替代方案字段

### 3. 组合过滤
- 搜索关键词与过滤器组合使用
- 先进行关键词匹配，再进行过滤器匹配

### 4. 性能优化
- 只在关键词变化时更新
- 使用高效的过滤算法
- 避免不必要的 DOM 操作

## 使用场景

### 场景 1: 基本搜索
用户输入 "image" 搜索包含该关键词的节点：
1. 在 `title`, `author`, `description` 字段中查找
2. 显示所有匹配的节点

### 场景 2: 组合过滤
用户选择 "Installed" 过滤器并输入 "control"：
1. 先过滤出已安装的节点
2. 再在这些节点中搜索包含 "control" 的节点

### 场景 3: 替代方案搜索
在替代方案模式下，搜索也会包含 `alternatives` 字段：
1. 检查是否处于替代方案模式
2. 将 `alternatives` 添加到可搜索字段列表
3. 在替代方案标签中搜索关键词

## 技术栈

- **前端框架**: 原生 JavaScript (ES6+)
- **UI 组件**: TurboGrid (自定义网格组件)
- **后端框架**: Python aiohttp
- **数据格式**: JSON

## 相关文件

### 前端文件
- `js/custom-nodes-manager.js` - 主要搜索逻辑实现
- `js/common.js` - 数据获取工具函数
- `js/turbogrid.esm.js` - 网格组件（提供过滤功能）

### 后端文件
- `glob/manager_server.py` - API 端点实现
- `glob/manager_core.py` - 核心业务逻辑

## 总结

ComfyUI-Manager 的节点搜索功能采用纯前端实现，具有以下优势：

1. **响应速度快**: 无需网络请求，即时显示结果
2. **用户体验好**: 实时搜索，无需等待
3. **资源消耗低**: 减少服务器负载和网络流量
4. **可扩展性强**: 易于添加新的搜索字段和过滤条件

这种设计在数据量不是特别大的情况下（通常节点列表在几千条以内）是非常合适的，能够提供流畅的用户体验。
