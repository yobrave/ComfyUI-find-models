# 节点安装与服务器重启流程文档

本文档详细说明 ComfyUI-Manager 项目中如何与服务器交互来安装缺失的节点以及重启服务的完整流程。

## 概述

ComfyUI-Manager 使用**任务队列机制**来管理节点安装、更新、卸载等操作。所有操作通过异步任务队列处理，前端通过 WebSocket 事件监听任务状态，并在完成后提示用户重启服务。

## 架构设计

### 数据流图

```
用户点击安装按钮
    ↓
前端检查队列状态
    ↓
重置队列并添加安装任务
    ↓
启动任务工作线程
    ↓
后端处理安装任务
    ↓
发送 WebSocket 事件更新状态
    ↓
前端监听并更新 UI
    ↓
任务完成，提示重启
    ↓
用户确认重启
    ↓
服务器执行重启
```

## 详细实现

### 1. 前端安装流程

#### 1.1 安装节点入口

**文件位置**: `js/custom-nodes-manager.js` (第 1445-1570 行)

```javascript
async installNodes(list, btn, title, selected_version) {
    // 1. 检查队列状态
    let stats = await api.fetchApi('/manager/queue/status');
    stats = await stats.json();
    if(stats.is_processing) {
        customAlert(`[ComfyUI-Manager] There are already tasks in progress...`);
        return;
    }

    // 2. 确认操作（卸载/重装需要确认）
    if(mode === "uninstall" || mode === "reinstall") {
        const confirmed = await customConfirm(`Are you sure...`);
        if (!confirmed) return;
    }

    // 3. 重置队列
    await api.fetchApi('/manager/queue/reset');

    // 4. 遍历节点列表，添加任务到队列
    for (const hash of list) {
        const item = this.grid.getRowItemBy("hash", hash);
        
        // 准备安装数据
        const data = item.originalData;
        data.selected_version = selected_version;
        data.channel = this.channel;
        data.mode = this.mode;
        data.ui_id = hash;

        // 确定 API 模式
        let api_mode = mode;
        if(mode == 'switch') api_mode = 'install';
        if(mode == 'enable') api_mode = 'install';
        if(mode == 'reinstall') api_mode = 'reinstall';

        // 5. 发送安装请求到后端
        const res = await api.fetchApi(`/manager/queue/${api_mode}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        // 6. 处理错误响应
        if (res.status != 200) {
            // 处理 403, 404 等错误
            break;
        }
    }

    // 7. 启动任务队列
    if(!errorMsg) {
        await api.fetchApi('/manager/queue/start');
        this.showStop();
        showTerminal();
    }
}
```

**关键步骤**:
1. **状态检查**: 确保没有正在进行的任务
2. **用户确认**: 危险操作需要用户确认
3. **队列重置**: 清空之前的任务队列
4. **批量添加**: 将所有节点添加到队列
5. **启动处理**: 启动后台任务处理线程

#### 1.2 队列状态检查 API

**文件位置**: `glob/manager_server.py` (第 1221-1234 行)

```python
@routes.get("/manager/queue/status")
async def queue_count(request):
    global nodepack_result
    global model_result
    global task_queue
    global task_worker_thread

    with task_worker_lock:
        done_count = len(nodepack_result) + len(model_result)
        in_progress_count = len(tasks_in_progress)
        total_count = done_count + in_progress_count + task_queue.qsize()
        is_processing = task_worker_thread is not None and task_worker_thread.is_alive()

    return web.json_response({
        'total_count': total_count,
        'done_count': done_count,
        'is_processing': is_processing
    })
```

**返回信息**:
- `total_count`: 总任务数
- `done_count`: 已完成任务数
- `is_processing`: 是否有任务正在处理

#### 1.3 队列重置 API

**文件位置**: `glob/manager_server.py` (第 1214-1219 行)

```python
@routes.get("/manager/queue/reset")
async def queue_reset(request):
    global task_queue
    global nodepack_result
    global model_result

    task_queue = queue.Queue()
    nodepack_result = {}
    model_result = {}

    return web.Response(status=200)
```

### 2. 后端安装处理

#### 2.1 安装任务 API 端点

**文件位置**: `glob/manager_server.py` (第 1236-1292 行)

```python
@routes.post("/manager/queue/install")
async def install_custom_node(request):
    # 1. 安全检查
    if not is_allowed_security_level('middle'):
        return web.Response(status=403, text="Security error")

    # 2. 解析请求数据
    json_data = await request.json()
    cnr_id = json_data.get('id')
    skip_post_install = json_data.get('skip_post_install')
    selected_version = json_data.get('selected_version')

    # 3. 确定节点规格字符串
    if json_data['version'] != 'unknown' and selected_version != 'unknown':
        if selected_version != 'nightly':
            risky_level = 'low'
            node_spec_str = f"{cnr_id}@{selected_version}"
        else:
            node_spec_str = f"{cnr_id}@nightly"
            git_url = [json_data.get('repository')]
    else:
        # unknown 节点
        unknown_name = os.path.basename(json_data['files'][0])
        node_spec_str = f"{unknown_name}@unknown"
        git_url = json_data.get('files')

    # 4. 风险评估（非 CNR 节点）
    if risky_level is None:
        if git_url is not None:
            risky_level = await get_risky_level(git_url, json_data.get('pip', []))

    # 5. 安全检查
    if not is_allowed_security_level(risky_level):
        return web.Response(status=404, text="Security error")

    # 6. 添加到任务队列
    install_item = (
        json_data.get('ui_id'), 
        node_spec_str, 
        json_data['channel'], 
        json_data['mode'], 
        skip_post_install
    )
    task_queue.put(("install", install_item))

    return web.Response(status=200)
```

**安全机制**:
- **安全级别检查**: 根据节点来源评估风险级别
- **白名单验证**: 验证节点是否在允许列表中
- **版本控制**: 区分稳定版和 nightly 版本

#### 2.2 启动任务队列

**文件位置**: `glob/manager_server.py` (第 1297-1312 行)

```python
@routes.get("/manager/queue/start")
async def queue_start(request):
    global nodepack_result
    global model_result
    global task_worker_thread

    # 检查是否已有工作线程在运行
    if task_worker_thread is not None and task_worker_thread.is_alive():
        return web.Response(status=201)  # already in-progress

    # 重置结果
    nodepack_result = {}
    model_result = {}

    # 启动新的工作线程
    task_worker_thread = threading.Thread(target=lambda: asyncio.run(task_worker()))
    task_worker_thread.start()

    return web.Response(status=200)
```

**关键点**:
- 使用独立线程处理任务，避免阻塞主服务器
- 检查线程状态，防止重复启动
- 重置结果字典，准备接收新任务结果

### 3. 任务工作线程

#### 3.1 任务处理循环

**文件位置**: `glob/manager_server.py` (第 439-702 行)

```python
async def task_worker():
    global task_queue
    global nodepack_result
    global model_result
    global tasks_in_progress

    stats = {}

    while True:
        # 1. 计算任务统计
        done_count = len(nodepack_result) + len(model_result)
        total_count = done_count + task_queue.qsize()

        # 2. 检查队列是否为空
        if task_queue.empty():
            logging.info(f"\n[ComfyUI-Manager] Queued works are completed.\n{stats}")
            logging.info("\nAfter restarting ComfyUI, please refresh the browser.")
            
            # 发送完成事件
            PromptServer.instance.send_sync("cm-queue-status",
                {'status': 'done',
                 'nodepack_result': nodepack_result, 
                 'model_result': model_result,
                 'total_count': total_count, 
                 'done_count': done_count})
            
            # 清理
            nodepack_result = {}
            task_queue = queue.Queue()
            return  # 终止工作线程

        # 3. 从队列获取任务
        with task_worker_lock:
            kind, item = task_queue.get()
            tasks_in_progress.add((kind, item[0]))

        # 4. 执行任务
        try:
            if kind == 'install':
                msg = await do_install(item)
            elif kind == 'update':
                msg = await do_update(item)
            elif kind == 'fix':
                msg = await do_fix(item)
            elif kind == 'uninstall':
                msg = await do_uninstall(item)
            elif kind == 'disable':
                msg = await do_disable(item)
            # ... 其他任务类型
        except Exception:
            traceback.print_exc()
            msg = f"Exception: {(kind, item)}"

        # 5. 更新任务状态
        with task_worker_lock:
            tasks_in_progress.remove((kind, item[0]))
            
            ui_id = item[0]
            if kind == 'install-model':
                model_result[ui_id] = msg
                ui_target = "model_manager"
            else:
                nodepack_result[ui_id] = msg
                ui_target = "nodepack_manager"

        # 6. 发送进度事件
        PromptServer.instance.send_sync("cm-queue-status",
            {'status': 'in_progress', 
             'target': item[0], 
             'ui_target': ui_target,
             'total_count': total_count, 
             'done_count': done_count})
```

**任务类型**:
- `install`: 安装节点
- `update`: 更新节点
- `fix`: 修复节点
- `uninstall`: 卸载节点
- `disable`: 禁用节点
- `install-model`: 安装模型

#### 3.2 安装任务执行

**文件位置**: `glob/manager_server.py` (第 445-469 行)

```python
async def do_install(item) -> str:
    ui_id, node_spec_str, channel, mode, skip_post_install = item

    try:
        # 1. 解析节点规格
        node_spec = core.unified_manager.resolve_node_spec(node_spec_str)
        if node_spec is None:
            return f"Cannot resolve install target: '{node_spec_str}'"

        # 2. 执行安装
        node_name, version_spec, is_specified = node_spec
        res = await core.unified_manager.install_by_id(
            node_name, 
            version_spec, 
            channel, 
            mode, 
            return_postinstall=skip_post_install
        )

        # 3. 检查结果
        if res.action not in ['skip', 'enable', 'install-git', 'install-cnr', 'switch-cnr']:
            logging.error(f"[ComfyUI-Manager] Installation failed:\n{res.msg}")
            return res.msg

        elif not res.result:
            logging.error(f"[ComfyUI-Manager] Installation failed:\n{res.msg}")
            return res.msg

        return 'success'
    except Exception:
        traceback.print_exc()
        return f"Installation failed:\n{node_spec_str}"
```

**安装流程**:
1. 解析节点规格字符串（如 `node_id@version`）
2. 调用统一管理器执行安装
3. 检查安装结果
4. 返回成功或错误消息

### 4. 前端状态监听

#### 4.1 注册事件监听器

**文件位置**: `js/custom-nodes-manager.js` (第 73 行)

```javascript
api.addEventListener("cm-queue-status", this.onQueueStatus);
```

#### 4.2 处理队列状态事件

**文件位置**: `js/custom-nodes-manager.js` (第 1572-1632 行)

```javascript
async onQueueStatus(event) {
    let self = CustomNodesManager.instance;
    
    // 1. 处理进行中的任务
    if(event.detail.status == 'in_progress' && 
       event.detail.ui_target == 'nodepack_manager') {
        const hash = event.detail.target;
        const item = self.grid.getRowItemBy("hash", hash);
        
        // 更新 UI：标记需要重启
        item.restart = true;
        self.restartMap[item.hash] = true;
        self.grid.updateCell(item, "action");
        self.grid.setRowSelected(item, false);
    }
    // 2. 处理完成的任务
    else if(event.detail.status == 'done') {
        self.hideStop();
        self.onQueueCompleted(event.detail);
    }
}

async onQueueCompleted(info) {
    let result = info.nodepack_result;
    
    if(result.length == 0) {
        return;
    }

    let errorMsg = "";
    
    // 检查结果
    for(let hash in result){
        let v = result[hash];
        if(v != 'success' && v != 'skip')
            errorMsg += v+'\n';
    }

    // 更新 UI
    for(let k in self.install_context.targets) {
        let item = self.install_context.targets[k];
        self.grid.updateCell(item, "action");
    }

    // 显示错误或成功消息
    if (errorMsg) {
        self.showError(errorMsg);
        show_message("Installation Error:\n"+errorMsg);
    } else {
        self.showStatus(`${label} ${result.length} custom node(s) successfully`);
    }

    // 提示重启
    self.showRestart();
    self.showMessage(
        `To apply the installed/updated/disabled/enabled custom node, 
         please restart ComfyUI. And refresh browser.`, 
        "red"
    );

    infoToast(`[ComfyUI-Manager] All node pack tasks in the queue have been completed.
                ${info.done_count}/${info.total_count}`);
}
```

**状态更新**:
- **进行中**: 更新对应节点的 UI，显示"需要重启"标记
- **完成**: 检查所有任务结果，显示成功或错误消息，提示重启

### 5. 服务器重启流程

#### 5.1 前端重启请求

**文件位置**: `js/common.js` (第 179-198 行)

```javascript
export async function rebootAPI() {
    // 1. 检查是否为 Electron 环境
    if ('electronAPI' in window) {
        window.electronAPI.restartApp();
        return true;
    }

    // 2. 用户确认
    const isConfirmed = await customConfirm(
        "Are you sure you'd like to reboot the server?"
    );
    if (!isConfirmed) {
        return false;
    }

    // 3. 发送重启请求
    try {
        const response = await api.fetchApi("/manager/reboot");
        if (response.status == 403) {
            await handle403Response(response);
            return false;
        }
    }
    catch(exception) {
        // 处理异常
    }

    return false;
}
```

**重启触发点**:
- 用户点击"Restart"按钮
- 安装/更新完成后自动提示

#### 5.2 后端重启实现

**文件位置**: `glob/manager_server.py` (第 1686-1720 行)

```python
@routes.get("/manager/reboot")
def restart(self):
    # 1. 安全检查
    if not is_allowed_security_level('middle'):
        logging.error(SECURITY_MESSAGE_MIDDLE_OR_BELOW)
        return security_403_response()

    # 2. 关闭日志
    try:
        sys.stdout.close_log()
    except Exception:
        pass

    # 3. CLI 会话模式
    if '__COMFY_CLI_SESSION__' in os.environ:
        # 创建重启标记文件
        with open(os.path.join(
            os.environ['__COMFY_CLI_SESSION__'] + '.reboot'), 'w'):
            pass
        
        print("\nRestarting...\n\n")
        exit(0)

    # 4. 传统模式重启
    print("\nRestarting... [Legacy Mode]\n\n")

    # 5. 准备重启命令
    sys_argv = sys.argv.copy()
    if '--windows-standalone-build' in sys_argv:
        sys_argv.remove('--windows-standalone-build')

    # 6. 构建执行命令
    if sys_argv[0].endswith("__main__.py"):
        # Python 模块模式
        module_name = os.path.basename(os.path.dirname(sys_argv[0]))
        cmds = [sys.executable, '-m', module_name] + sys_argv[1:]
    elif sys.platform.startswith('win32'):
        # Windows 模式
        cmds = ['"' + sys.executable + '"', '"' + sys_argv[0] + '"'] + sys_argv[1:]
    else:
        # Unix 模式
        cmds = [sys.executable] + sys_argv

    print(f"Command: {cmds}", flush=True)

    # 7. 执行重启（替换当前进程）
    return os.execv(sys.executable, cmds)
```

**重启机制**:
- **CLI 会话模式**: 创建标记文件，退出进程，由外部脚本重启
- **传统模式**: 使用 `os.execv` 替换当前进程，保持相同的命令行参数

## 完整流程示例

### 场景：安装缺失的节点

1. **用户操作**: 用户点击"Check Missing"按钮，系统检测到缺失的节点
2. **前端处理**: 
   ```javascript
   // 1. 获取缺失节点列表
   const hashMap = await this.getMissingNodes();
   
   // 2. 用户选择要安装的节点
   // 3. 调用 installNodes
   this.installNodes([hash1, hash2, ...], btn);
   ```
3. **队列管理**:
   ```javascript
   // 1. 检查状态
   GET /manager/queue/status
   
   // 2. 重置队列
   GET /manager/queue/reset
   
   // 3. 添加任务
   POST /manager/queue/install (节点1)
   POST /manager/queue/install (节点2)
   ...
   
   // 4. 启动处理
   GET /manager/queue/start
   ```
4. **后端处理**:
   ```python
   # 1. 工作线程启动
   task_worker_thread.start()
   
   # 2. 循环处理任务
   while not task_queue.empty():
       task = task_queue.get()
       result = await do_install(task)
       send_sync("cm-queue-status", {...})
   
   # 3. 发送完成事件
   send_sync("cm-queue-status", {'status': 'done', ...})
   ```
5. **前端响应**:
   ```javascript
   // 1. 监听状态更新
   onQueueStatus(event) {
       if (status == 'in_progress') {
           // 更新 UI，显示进度
       } else if (status == 'done') {
           // 显示完成消息
           // 提示重启
       }
   }
   ```
6. **用户重启**:
   ```javascript
   // 用户点击 Restart 按钮
   rebootAPI() {
       // 发送重启请求
       GET /manager/reboot
   }
   ```
7. **服务器重启**:
   ```python
   # 执行进程替换
   os.execv(sys.executable, cmds)
   ```

## 安全机制

### 1. 安全级别检查

系统定义了三个安全级别：
- **high**: 允许所有操作（包括未知来源）
- **middle**: 允许 CNR 节点和已知来源
- **low**: 仅允许 CNR 稳定版本

### 2. 风险评估

对于非 CNR 节点，系统会评估：
- Git URL 来源
- PIP 依赖包
- 白名单验证

### 3. 错误处理

- **403**: 安全级别不足
- **404**: 节点不在允许列表中
- **400**: 请求格式错误

## 关键技术点

### 1. 任务队列

使用 Python `queue.Queue` 实现线程安全的任务队列：
- 支持多任务排队
- 线程安全操作
- 状态跟踪

### 2. WebSocket 事件

使用 ComfyUI 的 `PromptServer.send_sync` 发送事件：
- 实时状态更新
- 前端自动接收
- 无需轮询

### 3. 进程重启

使用 `os.execv` 实现进程替换：
- 保持命令行参数
- 无缝重启
- 支持多种运行模式

## 相关文件

### 前端文件
- `js/custom-nodes-manager.js` - 节点管理器主逻辑
- `js/common.js` - 通用工具函数（包括重启）
- `js/model-manager.js` - 模型管理器（类似机制）

### 后端文件
- `glob/manager_server.py` - API 端点和任务处理
- `glob/manager_core.py` - 核心安装逻辑
- `glob/security_check.py` - 安全检查

## 总结

ComfyUI-Manager 的节点安装和重启机制具有以下特点：

1. **异步处理**: 使用任务队列和独立线程，不阻塞主服务器
2. **实时反馈**: 通过 WebSocket 事件实时更新前端状态
3. **安全可靠**: 多层次安全检查，防止恶意代码执行
4. **用户友好**: 清晰的进度提示和错误消息
5. **灵活重启**: 支持多种运行模式的重启机制

这种设计确保了安装过程的可靠性、安全性和用户体验。
