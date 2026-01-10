/**
 * 语言文件 - 中英文文本
 */

export const translations = {
    en: {
        // Dialog
        dialogTitle: "🔍 Model Finder",
        close: "Close",
        
        // Loading
        analyzingWorkflow: "Analyzing workflow...",
        gettingInstalledModels: "Getting installed models list...",
        searchingForMissingModels: "Searching for missing model download links...",
        searching: "Searching...",
        usingCache: "Using cache: {count}",
        totalModels: "Total Models",
        
        // Stats
        statistics: "Statistics",
        installed: "Installed",
        missing: "Missing",
        
        // Table Header
        modelList: "📋 Model List",
        tip: "💡 Tip: Click to open Google search (limited to Civitai, Hugging Face and GitHub) to manually find download links",
        searchModel: "🔍 Search Model:",
        searchPlaceholder: "Enter model name to search...",
        clear: "Clear",
        modelName: "Model Name",
        installedStatus: "Installation Status",
        localPath: "Local Path",
        modelPage: "Model Page",
        downloadLinks: "Download Links",
        
        // Model Row
        type: "Type",
        family: "Family",
        unknown: "Unknown",
        highlightTooltip: "Highlight the {index}th node using this model (Node ID: {nodeId})",
        clearCacheAndRefresh: "🔄 Clear Cache and Re-search",
        
        // Model Types
        modelTypeMain: "Main Model",
        modelTypeVAE: "VAE",
        modelTypeTextEncoder: "Text Encoder",
        modelTypeCLIP: "CLIP",
        modelTypeCLIPVision: "CLIP Vision",
        modelTypeControlNet: "ControlNet",
        modelTypeIPAdapter: "IP-Adapter",
        modelTypeLoRA: "LoRA",
        modelTypeUpscale: "Upscale Model",
        modelTypeOther: "Other",
        
        // Language
        language: "Language",
        switchToChinese: "Switch to Chinese",
        switchToEnglish: "Switch to English",
        
        // Error
        error: "Error",
        pleaseEnsure: "Please ensure:",
        workflowLoaded: "Workflow is loaded",
        serverRunning: "ComfyUI server is running",
        noWorkflowLoaded: "No workflow is currently loaded",
        pleaseLoadWorkflow: "Please load a workflow file first",
        
        // Stats
        statistics: "Statistics",
        
        // Separator
        unusedModelsSeparator: "The models below are not used or their nodes are disabled, but appear in the workflow file",
        
        // Links
        notFound: "Not Found",
        download: "Download",
        search: "Search",
        other: "Other",
        
        // Local Path
        downloadToPath: "Download to this path"
    },
    zh: {
        // Dialog
        dialogTitle: "🔍 模型查找器",
        close: "关闭",
        
        // Loading
        analyzingWorkflow: "正在分析工作流...",
        gettingInstalledModels: "正在获取已安装的模型列表...",
        searchingForMissingModels: "正在搜索缺失模型的下载链接...",
        searching: "搜索中...",
        usingCache: "已使用缓存: {count} 个",
        totalModels: "总模型数",
        
        // Stats
        statistics: "统计信息",
        installed: "已安装",
        missing: "缺失",
        
        // Table Header
        modelList: "📋 模型列表",
        tip: "💡 <strong style=\"color: #64b5f6;\">提示：</strong>点击打开 Google 搜索页面（限制在 Civitai、Hugging Face 和 GitHub），手动查找下载链接",
        searchModel: "🔍 搜索模型：",
        searchPlaceholder: "输入模型名称进行搜索...",
        clear: "清除",
        modelName: "模型名",
        installedStatus: "是否已安装",
        localPath: "本地目录",
        modelPage: "模型页面",
        downloadLinks: "下载链接",
        
        // Model Row
        type: "类型",
        family: "派系",
        unknown: "未知",
        highlightTooltip: "高亮显示第 {index} 个使用此模型的节点 (节点ID: {nodeId})",
        clearCacheAndRefresh: "🔄 清除缓存并重新搜索",
        
        // Model Types
        modelTypeMain: "主模型",
        modelTypeVAE: "VAE",
        modelTypeTextEncoder: "文本编码器",
        modelTypeCLIP: "CLIP",
        modelTypeCLIPVision: "CLIP 视觉",
        modelTypeControlNet: "ControlNet",
        modelTypeIPAdapter: "IP-Adapter",
        modelTypeLoRA: "LoRA",
        modelTypeUpscale: "放大模型",
        modelTypeOther: "其他",
        
        // Language
        language: "语言",
        switchToChinese: "切换到中文",
        switchToEnglish: "切换到英文",
        
        // Error
        error: "错误",
        pleaseEnsure: "请确保：",
        workflowLoaded: "工作流已加载",
        serverRunning: "ComfyUI服务器正在运行",
        noWorkflowLoaded: "当前没有加载工作流",
        pleaseLoadWorkflow: "请先加载一个工作流文件",
        
        // Stats
        statistics: "统计信息",
        
        // Separator
        unusedModelsSeparator: "下方模型没有被使用或是节点被禁用，但出现在工作流程文件中",
        
        // Links
        notFound: "未找到",
        download: "下载",
        search: "搜索",
        other: "其他",
        
        // Local Path
        downloadToPath: "下载到此路径"
    }
};
