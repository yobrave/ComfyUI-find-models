"""
Google 搜索模块
在 Google 上搜索模型（限制在 Civitai、Hugging Face 和 GitHub 网站）
"""

import os
import logging
from urllib.parse import quote

# 配置日志
# logger = logging.getLogger("ComfyUI-find-models")
logger = None  # 禁用 logger

async def search_google_model(model_name):
    """在 Google 上搜索模型（限制在 Civitai、Hugging Face 和 GitHub 网站），返回前 5 个结果"""
    try:
        # 移除文件扩展名
        search_query = os.path.splitext(model_name)[0]
        
        # 构建 Google 搜索查询，限制在特定网站
        # site:civitai.com/models OR site:huggingface.co OR site:github.com
        google_query = f"{search_query} (site:civitai.com/models OR site:huggingface.co OR site:github.com)"
        encoded_query = quote(google_query)
        google_search_url = f"https://www.google.com/search?q={encoded_query}&num=5"
        
        results = []
        
        # 尝试使用 aiohttp 获取 Google 搜索结果
        # 注意：Google 搜索的实际请求已被注释，因为页面结果被防御了
        # 现在只返回 Google 搜索链接，让用户手动打开
        # try:
            
            # 注释掉实际的 HTTP 请求，因为 Google 会防御自动化请求
            # logger.info(f"[{model_name}] 开始发送 HTTP 请求到 Google...")
            # # 检查代理设置
            # http_proxy = os.environ.get('HTTP_PROXY') or os.environ.get('http_proxy')
            # https_proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
            # if http_proxy or https_proxy:
            #     logger.info(f"[{model_name}] 使用代理设置 - HTTP_PROXY: {http_proxy}, HTTPS_PROXY: {https_proxy}")
            # else:
            #     logger.info(f"[{model_name}] 未设置代理，使用直连")
            # # 使用环境变量中的代理设置（HTTP_PROXY 和 HTTPS_PROXY）
            # # trust_env=True 会自动读取 HTTP_PROXY 和 HTTPS_PROXY 环境变量
            # import aiohttp
            # async with aiohttp.ClientSession(trust_env=True) as session:
            #     headers = {
            #         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            #         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            #         'Accept-Language': 'en-US,en;q=0.5'
            #     }
            #     async with session.get(google_search_url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as response:
            #         logger.info(f"[{model_name}] Google 响应状态码: {response.status}")
            #         if response.status == 200:
            #             # 解析 HTML 获取前 5 个结果
            #             html = await response.text()
            #             logger.info(f"[{model_name}] 获取到 HTML 内容，长度: {len(html)} 字符")
            #             
            #             # 保存 HTML 内容到本地文件
            #             try:
            #                 import datetime
            #                 # 创建 google 目录（如果不存在）
            #                 google_dir = os.path.join(os.path.dirname(__file__), "google")
            #                 os.makedirs(google_dir, exist_ok=True)
            #                 
            #                 # 生成文件名（使用模型名称和时间戳）
            #                 safe_model_name = "".join(c for c in model_name if c.isalnum() or c in ('-', '_', '.')).rstrip()
            #                 timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            #                 filename = f"{safe_model_name}_{timestamp}.html"
            #                 filepath = os.path.join(google_dir, filename)
            #                 
            #                 # 保存文件
            #                 with open(filepath, 'w', encoding='utf-8') as f:
            #                     f.write(html)
            #                 
            #                 logger.info(f"[{model_name}] Google 搜索结果已保存到: {filepath}")
            #             except Exception as save_error:
            #                 logger.warning(f"[{model_name}] 保存 Google 搜索结果失败: {save_error}")
            #             
            #             import re
            #             
            #             # 查找 Civitai 链接 (https://civitai.com/models/数字)
            #             civitai_pattern = r'https://civitai\.com/models/\d+[^"\'<>\s]*'
            #             civitai_links = list(set(re.findall(civitai_pattern, html)))[:3]
            #             logger.info(f"[{model_name}] 找到 {len(civitai_links)} 个 Civitai 链接")
            #             
            #             # 查找 Hugging Face 链接 (https://huggingface.co/用户名/模型名/blob/...)
            #             hf_pattern = r'https://huggingface\.co/[^/]+/[^/]+/blob/[^"\'<>\s]*'
            #             hf_links = list(set(re.findall(hf_pattern, html)))[:2]
            #             
            #             # 如果找不到/blob/链接，尝试找模型主页链接
            #             if len(hf_links) < 2:
            #                 hf_main_pattern = r'https://huggingface\.co/[^/]+/[^/]+(?!/blob/)[^"\'<>\s]*'
            #                 hf_main_links = list(set(re.findall(hf_main_pattern, html)))[:2]
            #                 hf_links.extend([l for l in hf_main_links if l not in hf_links])
            #                 hf_links = hf_links[:2]
            #             logger.info(f"[{model_name}] 找到 {len(hf_links)} 个 Hugging Face 链接")
            #             
            #             # 查找 GitHub 链接 (https://github.com/用户名/仓库名/...)
            #             github_pattern = r'https://github\.com/[^/]+/[^/]+[^"\'<>\s]*'
            #             github_links = list(set(re.findall(github_pattern, html)))[:2]
            #             logger.info(f"[{model_name}] 找到 {len(github_links)} 个 GitHub 链接")
            #             
            #             # 添加 Civitai 链接
            #             for link in civitai_links:
            #                 results.append({
            #                     "source": "Google → Civitai",
            #                     "name": model_name,
            #                     "url": link,
            #                     "download_url": None,
            #                     "note": "通过 Google 搜索找到的 Civitai 链接"
            #                 })
            #             
            #             # 添加 Hugging Face 链接
            #             for link in hf_links:
            #                 results.append({
            #                     "source": "Google → Hugging Face",
            #                     "name": model_name,
            #                     "url": link,
            #                     "download_url": None,
            #                     "note": "通过 Google 搜索找到的 Hugging Face 链接"
            #                 })
            #             
            #             # 添加 GitHub 链接
            #             for link in github_links:
            #                 results.append({
            #                     "source": "Google → GitHub",
            #                     "name": model_name,
            #                     "url": link,
            #                     "download_url": None,
            #                     "note": "通过 Google 搜索找到的 GitHub 链接"
            #                 })
            #             
            #             # 限制总共返回 5 个结果
            #             results = results[:5]
            #             
            #             logger.info(f"[{model_name}] Google 搜索找到 {len(results)} 个结果（已限制为前 5 个）")
            #         else:
            #             logger.warning(f"[{model_name}] Google 响应状态码不是 200: {response.status}")
        # except Exception as e:
        #     logger.warning(f"[{model_name}] Google 搜索处理失败: {e}")
        #     import traceback
        #     logger.debug(f"[{model_name}] 详细错误信息: {traceback.format_exc()}")
        
        # 如果没有找到具体链接，返回 Google 搜索页面链接
        if len(results) == 0:
            results.append({
                "source": "Google",
                "name": model_name,
                "url": google_search_url,
                "download_url": None,
                "note": None  # 不在结果中显示提示，会在表格顶部显示
            })
        
        # 总是返回至少一个结果（Google 搜索链接）
        return results if len(results) > 0 else [{
            "source": "Google",
            "name": model_name,
            "url": google_search_url,
            "download_url": None,
            "note": None
        }]
    except Exception as e:
        # logger.error(f"[{model_name}] Google 搜索错误: {e}")
        import traceback
        # logger.error(f"[{model_name}] 详细错误信息: {traceback.format_exc()}")
    
    # 即使发生异常，也返回一个 Google 搜索链接
    try:
        search_query = os.path.splitext(model_name)[0]
        google_query = f"{search_query} (site:civitai.com/models OR site:huggingface.co OR site:github.com)"
        encoded_query = quote(google_query)
        google_search_url = f"https://www.google.com/search?q={encoded_query}&num=5"
        return [{
            "source": "Google",
            "name": model_name,
            "url": google_search_url,
            "download_url": None,
            "note": None
        }]
    except:
        # 如果连构建 URL 都失败，返回一个基本的搜索链接
        return [{
            "source": "Google",
            "name": model_name,
            "url": f"https://www.google.com/search?q={quote(model_name)}",
            "download_url": None,
            "note": None
        }]
