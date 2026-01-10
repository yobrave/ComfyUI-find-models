"""
ComfyUI Find Models - 模型查找和管理工具
在ComfyUI界面中显示工作流所需的模型状态
"""

import os
import re
from pathlib import Path

# 读取版本号从 pyproject.toml
def get_version():
    """从 pyproject.toml 读取版本号（兼容 Python 3.8+）"""
    try:
        pyproject_path = Path(__file__).parent / "pyproject.toml"
        if pyproject_path.exists():
            with open(pyproject_path, "r", encoding="utf-8") as f:
                content = f.read()
                # 使用正则表达式提取版本号
                match = re.search(r'version\s*=\s*["\']([^"\']+)["\']', content)
                if match:
                    return match.group(1)
    except Exception:
        pass
    return "1.0.0"  # 默认版本号

__version__ = get_version()

# 不再需要节点，所有逻辑在前端完成
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# 服务器扩展（用于搜索模型链接的API）
WEB_DIRECTORY = "./web"

# 导入服务器扩展（ComfyUI会自动调用setup函数）
from . import server

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', '__version__']
