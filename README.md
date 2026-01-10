# ComfyUI Find Models

在 ComfyUI 界面中查找和管理工作流所需的模型。

**当前版本：v1.0.0**

## 功能特点

- ✅ **一键查找**：点击按钮即可分析当前工作流
- ✅ **模型状态**：显示哪些模型已安装，哪些缺失
- ✅ **派系识别**：自动识别模型所属派系（SDXL、Pony、Wan、Flux等）
- ✅ **分类显示**：按模型类型和派系分类显示
- ✅ **可视化界面**：美观的弹窗界面，清晰展示模型状态

## 安装

1. 将 `comfyUI-find-models` 文件夹复制到 ComfyUI 的 `custom_nodes` 目录
2. 重启 ComfyUI

## 使用方法

1. 在 ComfyUI 界面中加载你的工作流
2. 点击工具栏上的 **"🔍 查找模型"** 按钮
3. 在弹出的对话框中查看模型状态

## 界面说明

### 统计信息
- **总模型数**：工作流中需要的所有模型数量
- **已安装**：已经下载并安装的模型数量
- **缺失**：尚未安装的模型数量

### 模型派系
自动识别模型所属的派系：
- **SDXL** - Stable Diffusion XL
- **SD1.5** - Stable Diffusion 1.5
- **SD2** - Stable Diffusion 2
- **SD3** - Stable Diffusion 3
- **Pony** - Pony Diffusion
- **Wan** - Wan2.1/Wan2.2/Wan2.3
- **Flux** - Flux 系列
- **LTX** - LTX-2
- **Hunyuan** - Hunyuan
- **ZImage** - ZImage
- **AnimateDiff** - AnimateDiff
- **SVD** - Stable Video Diffusion
- 等等...

### 模型状态
- **✓ 已安装**：绿色背景，表示模型已存在
- **✗ 缺失**：红色背景，表示模型尚未安装

## 支持的模型类型

- 主模型（Checkpoint）
- VAE
- LoRA
- ControlNet
- IP-Adapter
- CLIP
- CLIP Vision
- 上采样模型
- 文本编码器

## 技术说明

- 前端使用 JavaScript 实现界面
- 后端使用 Python 分析工作流
- 自动检测 ComfyUI 的模型目录
- 支持多种模型文件格式（.safetensors, .ckpt, .pt, .pth, .bin）

## 注意事项

- 需要先加载工作流才能分析
- 模型检测基于文件名匹配
- 确保 ComfyUI 的模型目录配置正确

## 文档

- [安装说明](安装说明.md)
- [项目说明](项目说明.md)
- [版本管理文档](doc/version-management.md) - 如何升级版本号

## 更新日志

### v1.0.0 (2024-XX-XX)
- 初始版本发布
- 支持工作流模型查找
- 支持模型派系识别
- 支持模型状态显示
