"""
ComfyUI Find Models - 服务器扩展
添加API端点来处理模型查找请求
"""

import os
import json
import hashlib
import folder_paths
import logging
import aiohttp
import asyncio
from urllib.parse import quote
from server import PromptServer
from aiohttp import web
from .name_matcher import normalize_name, calculate_name_similarity
from .google_search import search_google_model

# 配置日志
# logger = logging.getLogger("ComfyUI-find-models")
# logger.setLevel(logging.DEBUG)

# 如果没有处理器，添加一个
# if not logger.handlers:
#     handler = logging.StreamHandler()
#     handler.setLevel(logging.DEBUG)
#     formatter = logging.Formatter('[ComfyUI-find-models] %(levelname)s: %(message)s')
#     handler.setFormatter(formatter)
#     logger.addHandler(handler)
logger = None  # 禁用 logger

# logger.info("=" * 60)
# logger.info("开始加载 ComfyUI Find Models 服务器扩展")
# logger.info("=" * 60)

# 检查并记录代理设置
http_proxy = os.environ.get('HTTP_PROXY') or os.environ.get('http_proxy')
https_proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
if http_proxy or https_proxy:
    # logger.info(f"检测到代理设置 - HTTP_PROXY: {http_proxy}, HTTPS_PROXY: {https_proxy}")
    pass
else:
    # logger.info("未检测到代理设置，将直接连接")
    pass

# 搜索 Civitai 模型
async def search_civitai_model(model_name):
    """在 Civitai 上搜索模型"""
    try:
        # 移除文件扩展名进行搜索
        search_query = os.path.splitext(model_name)[0]
        url = "https://civitai.com/api/v1/models"
        params = {"query": search_query, "limit": 5}
        
        # 使用环境变量中的代理设置（HTTP_PROXY 和 HTTPS_PROXY）
        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    items = data.get("items", [])
                    
                    # 尝试精确匹配文件名
                    for item in items:
                        model_versions = item.get("modelVersions", [])
                        for version in model_versions:
                            files = version.get("files", [])
                            for file_info in files:
                                if file_info.get("name") == model_name:
                                    return {
                                        "source": "Civitai",
                                        "name": item.get("name"),
                                        "url": f"https://civitai.com/models/{item.get('id')}",
                                        "download_url": file_info.get("downloadUrl"),
                                        "version": version.get("name"),
                                        "file_size": file_info.get("sizeKB", 0) * 1024 if file_info.get("sizeKB") else None
                                    }
                    
                    # 如果没有精确匹配，尝试使用名称相似度匹配
                    # 支持多种命名格式：snake_case, camelCase, kebab-case, PascalCase 等
                    if items:
                        best_match = None
                        best_score = 0.0
                        
                        for item in items:
                            model_versions = item.get("modelVersions", [])
                            model_item_name = item.get("name", "")
                            
                            for version in model_versions:
                                files = version.get("files", [])
                                for file_info in files:
                                    file_name = file_info.get("name", "")
                                    
                                    # 同时比较文件名和模型名称，取较高的相似度
                                    file_similarity = calculate_name_similarity(model_name, file_name)
                                    model_similarity = calculate_name_similarity(model_name, model_item_name)
                                    
                                    # 使用文件名和模型名称相似度的平均值，但文件名权重更高
                                    similarity = file_similarity * 0.7 + model_similarity * 0.3
                                    
                                    if similarity > best_score:
                                        best_score = similarity
                                        best_match = {
                                            "source": "Civitai",
                                            "name": model_item_name,
                                            "url": f"https://civitai.com/models/{item.get('id')}",
                                            "download_url": file_info.get("downloadUrl"),
                                            "version": version.get("name"),
                                            "file_size": file_info.get("sizeKB", 0) * 1024 if file_info.get("sizeKB") else None,
                                            "similarity": similarity
                                        }
                        
                        # 返回最佳匹配结果，无论相似度如何（用于缓存）
                        # 但标记是否为非精准匹配（相似度 < 0.85）
                        if best_match:
                            if best_score < 0.85:
                                # 非精准匹配，添加标记
                                best_match["is_non_exact_match"] = True
                                best_match["similarity"] = best_score
                            else:
                                # 精准匹配
                                best_match["is_non_exact_match"] = False
                                best_match["similarity"] = best_score
                            return best_match
                        else:
                            # 没有找到任何匹配
                            return None
    except Exception as e:
        # logger.warning(f"Civitai 搜索错误: {e}")
        pass
    return None

# 搜索 Hugging Face 模型
async def search_huggingface_model(model_name):
    """在 Hugging Face 上搜索模型"""
    try:
        # 移除文件扩展名
        search_query = os.path.splitext(model_name)[0]
        url = "https://huggingface.co/api/models"
        params = {"search": search_query, "limit": 10}
        
        # 使用环境变量中的代理设置（HTTP_PROXY 和 HTTPS_PROXY）
        async with aiohttp.ClientSession(trust_env=True) as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    models = await response.json()
                    
                    # 尝试精确匹配文件名
                    for model in models:
                        model_id = model.get("id", "")
                        try:
                            # 获取模型文件列表
                            files_url = f"https://huggingface.co/api/models/{model_id}/tree/main"
                            async with session.get(files_url, timeout=aiohttp.ClientTimeout(total=10)) as files_response:
                                if files_response.status == 200:
                                    files_data = await files_response.json()
                                    for file_info in files_data:
                                        if file_info.get("path") == model_name or file_info.get("rfilename") == model_name:
                                            return {
                                                "source": "Hugging Face",
                                                "name": model_id,
                                                "url": f"https://huggingface.co/{model_id}",
                                                "download_url": f"https://huggingface.co/{model_id}/resolve/main/{quote(model_name)}?download=true",
                                                "file_size": file_info.get("size")
                                            }
                        except:
                            continue
                    
                    # 如果没有精确匹配，尝试获取第一个模型的文件信息
                    if models:
                        model = models[0]
                        model_id = model.get("id", "")
                        try:
                            # 尝试获取文件信息以确认文件是否存在
                            files_url = f"https://huggingface.co/api/models/{model_id}/tree/main"
                            async with session.get(files_url, timeout=aiohttp.ClientTimeout(total=10)) as files_response:
                                if files_response.status == 200:
                                    files_data = await files_response.json()
                                    for file_info in files_data:
                                        if file_info.get("path") == model_name or file_info.get("rfilename") == model_name:
                                            return {
                                                "source": "Hugging Face",
                                                "name": model_id,
                                                "url": f"https://huggingface.co/{model_id}",
                                                "download_url": f"https://huggingface.co/{model_id}/resolve/main/{quote(model_name)}?download=true",
                                                "file_size": file_info.get("size")
                                            }
                            # 如果找不到文件，返回 None（不返回没有 file_size 的结果）
                            return None
                        except:
                            # 如果无法验证文件，返回 None（不返回没有 file_size 的结果）
                            return None
    except Exception as e:
        # logger.warning(f"Hugging Face 搜索错误: {e}")
        pass
    return None

# search_google_model 函数已移至 google_search.py 模块

# 步骤 1: 导入模块
# logger.debug("步骤 1: 导入必要的模块")

# 步骤 2: 获取路由对象（ComfyUI-Manager 的标准方式）
# logger.debug("步骤 2: 获取路由对象")
try:
    # 检查 PromptServer.instance 是否已初始化
    if PromptServer.instance is None:
        # logger.error("✗ PromptServer.instance 为 None，无法注册路由")
        # logger.error("  这通常发生在模块加载时 PromptServer 尚未初始化")
        # logger.error("  请确保 ComfyUI 已完全启动")
        routes = None
    else:
        routes = PromptServer.instance.routes
        # logger.info(f"✓ 111取路由对象: {routes}")
        # logger.debug(f"  路由对象类型: {type(routes)}")
        # logger.debug(f"  PromptServer.instance: {PromptServer.instance}")
except AttributeError as e:
    # logger.error(f"✗ 获取路由对象失败（AttributeError）: {e}")
    # logger.error("  可能 PromptServer.instance 尚未初始化")
    routes = None
except Exception as e:
    # logger.error(f"✗ 获取路由对象失败: {e}")
    import traceback
    # logger.error(traceback.format_exc())
    routes = None

# 步骤 3: 注册API路由
if routes is not None:
    # logger.debug("步骤 3: 注册 API 路由")
    
    # 验证路由是否已添加到路由表
    # logger.debug(f"  当前路由表数量: {len(routes._routes) if hasattr(routes, '_routes') else 'unknown'}")
    
    # 注册版本信息 API（使用复杂路径前缀）
    @routes.get("/comfyui-find-models/api/v1/system/version")
    async def get_version(request):
        """获取版本信息API端点"""
        try:
            from . import __version__
            return web.json_response({
                "version": __version__,
                "name": "ComfyUI Find Models"
            })
        except Exception as e:
            # logger.error(f"获取版本信息失败: {e}")
            return web.json_response({"version": "1.0.0", "name": "ComfyUI Find Models"}, status=200)
    
    # logger.info("✓ API 路由 GET /comfyui-find-models/api/v1/system/version 注册成功")
    
    # 注册测试页面路由
    @routes.get("/comfyui-find-models/test/name-match")
    async def test_name_match_page(request):
        """返回名称匹配测试页面"""
        try:
            test_page_path = os.path.join(os.path.dirname(__file__), "web", "test_name_match.html")
            if os.path.exists(test_page_path):
                with open(test_page_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return web.Response(text=content, content_type='text/html')
            else:
                return web.Response(text="测试页面未找到", status=404)
        except Exception as e:
            # logger.error(f"加载测试页面失败: {e}")
            return web.Response(text=f"加载测试页面失败: {e}", status=500)
    
    # logger.info("✓ API 路由 GET /comfyui-find-models/test/name-match 注册成功")
    
    # 注册名称匹配测试 API
    @routes.get("/comfyui-find-models/api/v1/test/name-match")
    async def test_name_match(request):
        """测试名称匹配功能"""
        try:
            name1 = request.query.get("name1", "")
            name2 = request.query.get("name2", "")
            
            if not name1 or not name2:
                return web.json_response({
                    "error": "请提供 name1 和 name2 参数"
                }, status=400)
            
            norm1 = normalize_name(name1)
            norm2 = normalize_name(name2)
            similarity = calculate_name_similarity(name1, name2)
            
            return web.json_response({
                "name1": name1,
                "name2": name2,
                "normalized1": norm1,
                "normalized2": norm2,
                "similarity": similarity,
                "is_match": similarity >= 0.9
            })
        except Exception as e:
            # logger.error(f"名称匹配测试失败: {e}")
            import traceback
            # logger.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)
    
    # logger.info("✓ API 路由 GET /comfyui-find-models/api/v1/test/name-match 注册成功")
    
    # 注册模型搜索 API（搜索 Civitai 和 Hugging Face）
    @routes.post("/comfyui-find-models/api/v1/models/search")
    async def search_model_links(request):
        """搜索模型链接（Civitai 和 Hugging Face）"""
        try:
            data = await request.json()
            model_name = data.get("model_name", "")
            model_type = data.get("model_type", "其他")
            search_civitai = data.get("search_civitai", True)
            search_hf = data.get("search_hf", True)
            search_google = data.get("search_google", False)  # 默认不搜索 Google，因为需要手动操作
            
            if not model_name:
                return web.json_response({"error": "未提供模型名称"}, status=400)
            
            results = []
            civitai_result = None
            should_search_hf = search_hf
            should_search_google = False
            civitai_size_mb = 0
            
            # 搜索 Civitai
            if search_civitai:
                try:
                    civitai_result = await search_civitai_model(model_name)
                    if civitai_result:
                        # 检查是否为非精确匹配（基于 similarity 字段）
                        is_non_exact_match = civitai_result.get("is_non_exact_match", False)
                        
                        # 检查文件大小：如果没有文件大小或小于 10MB，说明文件可能不存在或不可靠，需要搜索 Google
                        file_size = civitai_result.get("file_size")
                        if file_size is not None:
                            civitai_size_mb = file_size / (1024 * 1024)  # 转换为 MB
                            
                            if civitai_size_mb < 10:
                                # 文件小于 10MB，不添加到结果，搜索 Google
                                should_search_hf = False  # 不搜索 HF，因为文件太小不可靠
                                should_search_google = True
                                civitai_result = None  # 清空结果，不添加到最终结果
                            else:
                                # 文件足够大，无论是否精准匹配都添加到结果（用于缓存）
                                # 但标记是否为非精准匹配，前端会过滤显示
                                results.append(civitai_result)
                                if is_non_exact_match:
                                    # 非精确匹配，触发 Google 搜索
                                    should_search_hf = False
                                    should_search_google = True
                                else:
                                    # 精确匹配且文件足够大，直接使用
                                    should_search_hf = False
                                    should_search_google = False
                        else:
                            # 如果没有文件大小，说明文件可能不存在，不添加到结果，直接搜索 Google
                            should_search_hf = False  # 不搜索 HF，因为没有文件大小说明结果不可靠
                            should_search_google = True
                            civitai_result = None  # 清空结果，不添加到最终结果
                    else:
                        should_search_hf = search_hf
                        should_search_google = True
                except Exception as e:
                    # logger.warning(f"[{model_name}] Civitai 搜索失败: {e}")
                    # Civitai 搜索失败时，如果原本要搜索 HF，则继续搜索
                    should_search_hf = search_hf
                    should_search_google = True
            
            # 搜索 Hugging Face（如果 Civitai 没找到）
            if should_search_hf:
                try:
                    hf_result = await search_huggingface_model(model_name)
                    if hf_result:
                        hf_size = hf_result.get("file_size") or 0
                        hf_size_mb = hf_size / (1024 * 1024) if hf_size > 0 else 0
                        
                        # 如果没有文件大小或小于 10MB，说明文件可能不存在或不可靠，不添加到结果，直接搜索 Google
                        if hf_size == 0:
                            should_search_google = True
                            hf_result = None  # 清空结果，不添加到最终结果
                        elif hf_size_mb < 10:
                            should_search_google = True
                            hf_result = None  # 清空结果，不添加到最终结果
                        else:
                            # 文件足够大，直接使用 Hugging Face 结果
                            results.append(hf_result)
                    else:
                        # 如果 Civitai 也没找到，触发 Google 搜索
                        if not civitai_result:
                            should_search_google = True
                except Exception as e:
                    # logger.warning(f"[{model_name}] Hugging Face 搜索失败: {e}")
                    # 如果 Civitai 也没找到，触发 Google 搜索
                    if not civitai_result:
                        should_search_google = True
            
            # 总是搜索 Google（无论其他搜索是否找到结果）
            try:
                google_results = await search_google_model(model_name)
                # search_google_model 现在总是返回至少一个结果，所以这里应该总是有结果
                if google_results and len(google_results) > 0:
                    # Google 搜索返回的是结果列表（最多 5 个）
                    for google_result in google_results[:5]:  # 只取前 5 个
                        # 移除 note 中的提示信息（会在表格顶部显示）
                        if google_result.get("note") and "点击打开 Google 搜索页面" in google_result.get("note", ""):
                            google_result["note"] = None
                        results.append(google_result)
                else:
                    # 如果 Google 搜索没有返回结果（不应该发生，但作为保险），创建一个搜索链接
                    google_search_url = f"https://www.google.com/search?q={quote(model_name + ' (site:civitai.com/models OR site:huggingface.co OR site:github.com)')}&num=5"
                    results.append({
                        "source": "Google",
                        "name": model_name,
                        "url": google_search_url,
                        "download_url": None,
                        "note": None  # 不在结果中显示提示，会在表格顶部显示
                    })
            except Exception as e:
                # logger.warning(f"[{model_name}] Google 搜索失败: {e}")
                # 即使搜索失败，也提供一个 Google 搜索链接
                google_search_url = f"https://www.google.com/search?q={quote(model_name + ' (site:civitai.com/models OR site:huggingface.co OR site:github.com)')}&num=5"
                results.append({
                    "source": "Google",
                    "name": model_name,
                    "url": google_search_url,
                    "download_url": None,
                    "note": None  # 不在结果中显示提示，会在表格顶部显示
                })
            
            return web.json_response({"results": results})
            
        except Exception as e:
            # logger.error(f"搜索模型链接失败: {e}")
            import traceback
            # logger.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)
    
    # logger.info("✓ API 路由 POST /comfyui-find-models/api/v1/models/search 注册成功")
    
    # 注册获取 extra_model_paths 配置的 API
    @routes.get("/comfyui-find-models/api/v1/system/extra-model-paths")
    async def get_extra_model_paths_api(request):
        """获取 extra_model_paths.yaml 的配置数据"""
        try:
            extra_paths = {}
            yaml_config = {}
            
            # 方法1: 从 folder_paths.folder_names_and_paths 获取路径信息（推荐）
            # folder_names_and_paths 的格式: {model_type: ([path1, path2, ...], [ext1, ext2, ...])}
            try:
                if hasattr(folder_paths, 'folder_names_and_paths'):
                    folder_names_and_paths = folder_paths.folder_names_and_paths
                    if folder_names_and_paths:
                        for model_type, path_info in folder_names_and_paths.items():
                            if path_info:
                                # path_info 可能是 (paths, extensions) 元组
                                if isinstance(path_info, tuple) and len(path_info) >= 1:
                                    paths = path_info[0]
                                elif isinstance(path_info, list):
                                    paths = path_info
                                else:
                                    paths = [path_info] if path_info else []
                                
                                # 确保 paths 是列表
                                if not isinstance(paths, list):
                                    paths = [paths]
                                
                                # 过滤掉空路径
                                paths = [p for p in paths if p and isinstance(p, str)]
                                
                                if paths:
                                    # 提取相对于 models 目录的路径
                                    processed_paths = []
                                    for path in paths:
                                        if not path:
                                            continue
                                        
                                        path_normalized = path.replace('\\', '/')
                                        
                                        # 如果路径包含 'models'，提取 models 后面的相对路径
                                        if '/models/' in path_normalized or path_normalized.endswith('/models'):
                                            # 提取 models 后面的部分
                                            if '/models/' in path_normalized:
                                                parts = path_normalized.split('/models/')
                                                if len(parts) > 1:
                                                    relative_part = parts[-1]
                                                    # 提取第一级目录名（相对于 models 的目录）
                                                    if '/' in relative_part:
                                                        relative_path = relative_part.split('/')[0]
                                                    else:
                                                        relative_path = relative_part if relative_part else model_type
                                                    if relative_path:
                                                        processed_paths.append(relative_path)
                                            elif path_normalized.endswith('/models'):
                                                # 如果路径以 /models 结尾，使用模型类型作为目录名
                                                processed_paths.append(model_type)
                                        else:
                                            # 绝对路径，尝试推断目录名
                                            # 通常格式是：.../models/checkpoints 或 .../checkpoints
                                            path_parts = [p for p in path_normalized.split('/') if p]
                                            # 查找 'models' 后面的目录，或者使用最后一个目录
                                            models_index = -1
                                            for i, part in enumerate(path_parts):
                                                if part == 'models' and i < len(path_parts) - 1:
                                                    models_index = i
                                                    break
                                            
                                            if models_index >= 0 and models_index < len(path_parts) - 1:
                                                # 使用 models 后面的第一个目录
                                                processed_paths.append(path_parts[models_index + 1])
                                            elif path_parts:
                                                # 使用最后一个目录名
                                                processed_paths.append(path_parts[-1])
                                    
                                    # 去重并保留顺序
                                    seen = set()
                                    unique_paths = []
                                    for p in processed_paths:
                                        if p and p not in seen:
                                            seen.add(p)
                                            unique_paths.append(p)
                                    
                                    if unique_paths:
                                        extra_paths[model_type] = {
                                            "paths": unique_paths,
                                            "default_path": unique_paths[0],
                                            "full_paths": paths  # 保留完整路径用于调试
                                        }
                        
                        # 如果没有获取到路径信息，尝试使用 get_folder_paths 方法
                        if not extra_paths:
                            try:
                                # 尝试常见的模型类型
                                common_types = ["checkpoints", "loras", "vae", "controlnet", "upscale_models", "clip", "clip_vision", "ipadapter"]
                                for model_type in common_types:
                                    if hasattr(folder_paths, 'get_folder_paths'):
                                        try:
                                            type_paths = folder_paths.get_folder_paths(model_type)
                                            if type_paths and len(type_paths) > 0:
                                                # 处理路径，提取相对于 models 的目录名
                                                processed = []
                                                for full_path in type_paths[:1]:  # 只取第一个路径
                                                    path_norm = full_path.replace('\\', '/')
                                                    if '/models/' in path_norm:
                                                        rel_part = path_norm.split('/models/')[-1]
                                                        dir_name = rel_part.split('/')[0] if '/' in rel_part else rel_part
                                                        if dir_name and dir_name not in processed:
                                                            processed.append(dir_name)
                                                    elif path_norm.endswith('/models'):
                                                        processed.append(model_type)
                                                    else:
                                                        path_parts = [p for p in path_norm.split('/') if p]
                                                        if path_parts:
                                                            processed.append(path_parts[-1])
                                                
                                                if processed:
                                                    extra_paths[model_type] = {
                                                        "paths": processed,
                                                        "default_path": processed[0],
                                                        "full_paths": type_paths[:1]
                                                    }
                                        except:
                                            continue
                            except Exception as e2:
                                # logger.debug(f"尝试使用 get_folder_paths 方法失败: {e2}")
                                pass
                        
                        # logger.info(f"✓ 通过 folder_paths.folder_names_and_paths 获取路径信息: {len(extra_paths)} 个类型")
                        if extra_paths:
                            # logger.debug(f"  路径信息: {list(extra_paths.keys())}")
                            # for mt, config in list(extra_paths.items())[:3]:  # 只显示前3个
                            #     logger.debug(f"    {mt}: {config.get('default_path', 'N/A')}")
                            pass
            except Exception as e:
                # logger.warning(f"从 folder_paths.folder_names_and_paths 获取路径失败: {e}")
                import traceback
                # logger.debug(traceback.format_exc())
                pass
            
            # 方法2: 尝试直接读取 extra_model_paths.yaml 文件（作为备用）
            try:
                # 尝试找到 ComfyUI 根目录
                # 通过 folder_paths 获取 models 目录，然后向上查找根目录
                try:
                    if hasattr(folder_paths, 'get_folder_paths'):
                        models_path = folder_paths.get_folder_paths("checkpoints")[0] if folder_paths.get_folder_paths("checkpoints") else None
                        if models_path:
                            # models_path 通常是 ComfyUI根目录/models/checkpoints
                            # 向上两级到 ComfyUI 根目录
                            comfyui_root = os.path.dirname(os.path.dirname(models_path))
                        else:
                            raise Exception("无法从 folder_paths 获取 models 路径")
                    else:
                        # 备用方法：从当前文件位置推断
                        current_file = os.path.abspath(__file__)
                        # custom_nodes/ComfyUI-find-models/server.py
                        # 向上两级到 ComfyUI 根目录
                        comfyui_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
                    
                    yaml_path = os.path.join(comfyui_root, "extra_model_paths.yaml")
                    
                    if os.path.exists(yaml_path):
                        try:
                            import yaml
                            with open(yaml_path, 'r', encoding='utf-8') as f:
                                yaml_config = yaml.safe_load(f) or {}
                            # logger.info(f"✓ 成功读取 extra_model_paths.yaml: {yaml_path}")
                            
                            # 转换 YAML 格式为统一格式
                            # YAML 格式通常是: {key: {base_path: "...", checkpoints: "...", loras: "..."}}
                            converted_yaml = {}
                            for key, config in yaml_config.items():
                                if isinstance(config, dict):
                                    for model_type, path_value in config.items():
                                        if model_type != 'base_path' and isinstance(path_value, str):
                                            # 提取相对路径
                                            if 'models' in path_value:
                                                relative_path = path_value.split('models/')[-1].split('/')[0]
                                            else:
                                                relative_path = path_value.split('/')[-1] if '/' in path_value else path_value
                                            
                                            if model_type not in converted_yaml:
                                                converted_yaml[model_type] = {"paths": [], "full_paths": []}
                                            converted_yaml[model_type]["paths"].append(relative_path)
                                            converted_yaml[model_type]["full_paths"].append(path_value)
                                            
                            # 设置默认路径
                            for model_type, paths_data in converted_yaml.items():
                                if paths_data["paths"]:
                                    paths_data["default_path"] = paths_data["paths"][0]
                            
                            if converted_yaml:
                                yaml_config = converted_yaml
                        except ImportError:
                            # logger.warning("PyYAML 未安装，无法直接读取 YAML 文件")
                            pass
                        except Exception as e:
                            # logger.warning(f"读取 extra_model_paths.yaml 失败: {e}")
                            import traceback
                            # logger.debug(traceback.format_exc())
                            pass
                    else:
                        # logger.debug(f"未找到 extra_model_paths.yaml 文件（路径: {yaml_path}）")
                        pass
                except Exception as e:
                    # logger.debug(f"尝试读取 extra_model_paths.yaml 文件失败: {e}")
                    pass
            except Exception as e:
                # logger.warning(f"读取 extra_model_paths.yaml 文件时出错: {e}")
                pass
            
            # 合并两种方法的结果（优先使用 folder_paths 的数据）
            merged = {}
            if extra_paths:
                merged = extra_paths
                # 如果 yaml_config 中有 extra_paths 没有的类型，也添加进去
                for model_type, paths_data in yaml_config.items():
                    if model_type not in merged:
                        merged[model_type] = paths_data
            elif yaml_config:
                merged = yaml_config
            
            result = {
                "from_folder_paths": extra_paths,
                "from_yaml_file": yaml_config,
                "merged": merged
            }
            
            # logger.info(f"✓ 返回 extra_model_paths 配置: {len(merged)} 个模型类型")
            return web.json_response(result)
            
        except Exception as e:
            # logger.error(f"获取 extra_model_paths 配置失败: {e}")
            import traceback
            # logger.error(traceback.format_exc())
            return web.json_response({"error": str(e)}, status=500)
    
    # logger.info("✓ API 路由 GET /comfyui-find-models/api/v1/system/extra-model-paths 注册成功")
    
    # 验证路由注册（调试信息）
    try:
        # 尝试获取路由信息
        if hasattr(routes, '_routes'):
            all_routes = list(routes._routes)
            # logger.debug(f"  路由表总数: {len(all_routes)}")
            # 查找我们注册的路由
            our_routes = [r for r in all_routes if '/comfyui-find-models/api' in str(r.path)]
            if our_routes:
                # logger.info("✓ 验证：找到我们注册的路由:")
                # for route in our_routes:
                #     logger.info(f"    {route.method} {route.path}")
                pass
            else:
                # logger.warning("⚠ 警告：在路由表中未找到我们注册的路由")
                pass
        else:
            # logger.debug("  无法访问路由表内部结构")
            pass
    except Exception as e:
        # logger.debug(f"  验证路由时出错: {e}")
        pass
else:
    # logger.error("✗ 无法注册 API 路由：routes 对象为 None")
    # logger.error("  请检查 ComfyUI 控制台是否有相关错误信息")
    pass

# logger.info("=" * 60)
# logger.info("ComfyUI Find Models 服务器扩展加载完成")
# logger.info("=" * 60)
