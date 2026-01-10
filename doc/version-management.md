# 版本管理文档

本文档说明如何管理和升级 ComfyUI Find Models 的版本号。

## 版本号格式

版本号采用**语义化版本**（Semantic Versioning）格式：`MAJOR.MINOR.PATCH`

- **MAJOR（主版本号）**：不兼容的 API 修改
- **MINOR（次版本号）**：向下兼容的功能性新增
- **PATCH（修订号）**：向下兼容的问题修正

### 示例

- `1.0.0` - 初始版本
- `1.0.1` - 修复 bug（PATCH）
- `1.1.0` - 新增功能（MINOR）
- `2.0.0` - 重大更新，可能不兼容（MAJOR）

## 版本号位置

版本号采用**单一数据源**原则，只需在一个地方更新：

### 1. 主要版本号文件：`pyproject.toml` ⭐

**这是版本号的唯一来源**，所有其他地方的版本号都从这里读取：

```toml
[project]
name = "comfyui-find-models"
version = "1.0.0"  # ← 只需更新这里
```

**位置**：项目根目录的 `pyproject.toml` 文件

### 2. 自动同步的位置

以下位置的版本号会自动从 `pyproject.toml` 读取，**无需手动更新**：

#### 后端：`__init__.py`
- 自动从 `pyproject.toml` 读取版本号
- 存储在 `__version__` 变量中
- 通过 API `/find_models/version` 提供给前端

#### 前端：`web/find_models.js`
- 页面加载时自动从 API 获取版本号
- 如果 API 失败，使用默认值 `1.0.0`

### 3. 文档文件（可选）

在 README 文件中可以添加版本信息（需要手动更新）：

```markdown
## 版本信息

当前版本：**v1.0.0**
```

## 升级步骤

### 步骤 1：确定版本类型

根据变更内容确定版本类型：

- **PATCH（修订号）**：
  - 修复 bug
  - 修复错误消息
  - 优化性能
  - 改进 UI 样式
  - 示例：`1.0.0` → `1.0.1`

- **MINOR（次版本号）**：
  - 新增功能
  - 新增模型派系识别
  - 新增 API 端点
  - 新增 UI 功能
  - 示例：`1.0.0` → `1.1.0`

- **MAJOR（主版本号）**：
  - 破坏性变更
  - API 不兼容修改
  - 重大架构调整
  - 示例：`1.0.0` → `2.0.0`

### 步骤 2：更新版本号

#### 更新 pyproject.toml（唯一需要更新的地方）

编辑 `pyproject.toml`：

```toml
[project]
version = "1.0.1"  # 更新为新版本号
```

**注意**：只需更新这一个文件，其他地方的版本号会自动同步！

### 步骤 3：更新文档

#### 更新 README.md

在 README 中更新版本信息：

```markdown
## 版本信息

当前版本：**v1.0.1**

### 更新日志

#### v1.0.1 (2024-XX-XX)
- 修复了 API 路由注册问题
- 优化了错误处理

#### v1.0.0 (2024-XX-XX)
- 初始版本发布
```

### 步骤 4：测试

1. **重启 ComfyUI**
   ```bash
   # 关闭 ComfyUI
   # 重新启动 ComfyUI
   ```

2. **验证版本显示**
   - 打开 ComfyUI 界面
   - 点击 "🔍 查找模型" 按钮
   - 检查弹窗标题下方是否显示正确的版本号

3. **功能测试**
   - 测试所有功能是否正常
   - 确保没有引入新的 bug

### 步骤 5：提交更改

```bash
git add web/find_models.js
git add __init__.py  # 如果更新了
git add README.md     # 如果更新了
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1        # 可选：创建版本标签
```

## 版本升级示例

### 示例 1：修复 Bug（PATCH）

**场景**：修复了 API 路由注册问题

**操作**：
```toml
# pyproject.toml
[project]
version = "1.0.0"  # 旧版本
version = "1.0.1"  # 新版本（PATCH +1）
```

### 示例 2：新增功能（MINOR）

**场景**：新增了模型下载链接功能

**操作**：
```toml
# pyproject.toml
[project]
version = "1.0.0"  # 旧版本
version = "1.1.0"  # 新版本（MINOR +1, PATCH 重置为 0）
```

### 示例 3：重大更新（MAJOR）

**场景**：重构了 API，改变了响应格式

**操作**：
```toml
# pyproject.toml
[project]
version = "1.0.0"  # 旧版本
version = "2.0.0"  # 新版本（MAJOR +1, MINOR 和 PATCH 重置为 0）
```

## 版本号检查清单

升级版本号前，请确认：

- [ ] 已确定版本类型（MAJOR/MINOR/PATCH）
- [ ] 已更新 `pyproject.toml` 中的 `version` 字段 ⭐（唯一需要更新的地方）
- [ ] 已更新 README.md 中的版本信息（可选）
- [ ] 已添加更新日志（CHANGELOG）
- [ ] 已测试新版本功能
- [ ] 已重启 ComfyUI 以加载新版本号
- [ ] 已验证版本号在界面中正确显示（通过 API 获取）
- [ ] 已提交代码更改
- [ ] 已创建版本标签（可选）

## 自动化版本管理（可选）

### 使用脚本自动更新版本号

可以创建一个脚本来自动更新版本号：

**`scripts/bump_version.py`**：

```python
#!/usr/bin/env python3
"""
版本号升级脚本
用法: python scripts/bump_version.py [major|minor|patch]
"""

import re
import sys
from pathlib import Path

def bump_version(version_type):
    # 读取 pyproject.toml
    pyproject_file = Path("pyproject.toml")
    if not pyproject_file.exists():
        print("错误：找不到 pyproject.toml 文件")
        return
    
    with open(pyproject_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取当前版本
    match = re.search(r'version\s*=\s*["\'](\d+)\.(\d+)\.(\d+)["\']', content)
    if not match:
        print("错误：无法找到版本号")
        return
    
    major, minor, patch = map(int, match.groups())
    
    # 升级版本号
    if version_type == 'major':
        major += 1
        minor = 0
        patch = 0
    elif version_type == 'minor':
        minor += 1
        patch = 0
    elif version_type == 'patch':
        patch += 1
    else:
        print("错误：版本类型必须是 major、minor 或 patch")
        return
    
    new_version = f"{major}.{minor}.{patch}"
    
    # 更新 pyproject.toml
    new_content = re.sub(
        r'version\s*=\s*["\']\d+\.\d+\.\d+["\']',
        f'version = "{new_version}"',
        content
    )
    
    with open(pyproject_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✓ 版本号已更新为: {new_version}")
    print(f"  文件: pyproject.toml")
    print(f"  注意: 前端版本号会在页面加载时自动从服务器获取")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("用法: python scripts/bump_version.py [major|minor|patch]")
        sys.exit(1)
    
    bump_version(sys.argv[1])
```

**使用方法**：

```bash
# 升级修订号（1.0.0 → 1.0.1）
python scripts/bump_version.py patch

# 升级次版本号（1.0.0 → 1.1.0）
python scripts/bump_version.py minor

# 升级主版本号（1.0.0 → 2.0.0）
python scripts/bump_version.py major
```

## 最佳实践

1. **每次发布前升级版本号**
   - 即使是小的 bug 修复，也应该升级版本号
   - 保持版本号的连续性

2. **记录更新日志**
   - 在 README 或 CHANGELOG 中记录每次更新的内容
   - 帮助用户了解新版本的变化

3. **语义化版本**
   - 遵循语义化版本规范
   - 让用户能够理解版本变更的影响

4. **版本标签**
   - 使用 Git 标签标记发布版本
   - 方便回退和追踪

5. **测试验证**
   - 每次升级版本号后都要测试
   - 确保版本号在界面中正确显示

## 相关资源

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [Git 标签使用](https://git-scm.com/book/zh/v2/Git-%E5%9F%BA%E7%A1%80-%E6%89%93%E6%A0%87%E7%AD%BE)

## 常见问题

### Q: 什么时候应该升级主版本号？

A: 当有破坏性变更时，例如：
- API 响应格式改变
- 必需的参数改变
- 移除了某些功能

### Q: 小改动需要升级版本号吗？

A: 是的，即使是小的 bug 修复也应该升级 PATCH 版本号，这样用户可以知道有新版本可用。

### Q: 版本号可以跳过吗？

A: 不推荐。应该保持版本号的连续性，例如：1.0.0 → 1.0.1 → 1.0.2，而不是 1.0.0 → 1.0.3。

### Q: 如何回退版本号？

A: 如果发布了错误的版本，可以：
1. 修复问题后发布新的版本（推荐）
2. 删除错误的标签，重新发布（不推荐）
