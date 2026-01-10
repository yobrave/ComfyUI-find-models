"""
名称匹配模块
支持多种命名格式的模型名称匹配（snake_case, camelCase, kebab-case, PascalCase 等）
"""

import os
import re
from difflib import SequenceMatcher


def normalize_name(name):
    """
    将不同命名格式的名称转换为统一的格式（小写字母，用空格分隔单词）
    支持：
    - snake_case (user_profile_name) -> user profile name
    - SCREAMING_SNAKE_CASE (MAX_RETRY_COUNT) -> max retry count
    - camelCase (userProfileName) -> user profile name
    - PascalCase (UserProfileName) -> user profile name
    - kebab-case (user-profile-name) -> user profile name
    - flatcase (userprofilename) -> userprofilename
    - dot.case (user.profile.name) -> user profile name
    
    Args:
        name: 原始名称（可能包含文件扩展名）
    
    Returns:
        规范化后的名称（小写，空格分隔）
    """
    if not name:
        return ""
    
    # 移除文件扩展名
    name = os.path.splitext(name)[0]
    
    # 处理不同的分隔符
    # 先处理下划线、连字符、点号
    name = re.sub(r'[_\-.]+', ' ', name)
    
    # 处理驼峰命名（camelCase 和 PascalCase）
    # 在大写字母前插入空格（但不在开头）
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', name)
    
    # 转换为小写并去除多余空格
    name = name.lower().strip()
    name = re.sub(r'\s+', ' ', name)
    
    return name


def calculate_name_similarity(name1, name2):
    """
    计算两个名称的相似度（0.0 到 1.0）
    支持多种命名格式的匹配
    
    Args:
        name1: 第一个名称
        name2: 第二个名称
    
    Returns:
        相似度值（0.0 到 1.0），1.0 表示完全匹配
    """
    if not name1 or not name2:
        return 0.0
    
    # 精确匹配
    if name1 == name2:
        return 1.0
    
    # 规范化后比较
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)
    
    # 规范化后的精确匹配
    if norm1 == norm2:
        return 1.0
    
    # 将规范化后的名称拆分为单词列表
    words1 = set(norm1.split())
    words2 = set(norm2.split())
    
    # 如果单词集合完全相同，返回 1.0
    if words1 == words2:
        return 1.0
    
    # 计算单词交集和并集
    intersection = words1 & words2
    union = words1 | words2
    
    # 如果交集为空，相似度为 0
    if not intersection:
        return 0.0
    
    # Jaccard 相似度（单词级别的相似度）
    jaccard_similarity = len(intersection) / len(union) if union else 0.0
    
    # 使用 SequenceMatcher 计算字符级别的相似度
    sequence_similarity = SequenceMatcher(None, norm1, norm2).ratio()
    
    # 综合相似度：单词相似度权重 0.6，字符相似度权重 0.4
    # 这样可以避免因为共同词（如 "Concept"）导致误匹配
    combined_similarity = jaccard_similarity * 0.6 + sequence_similarity * 0.4
    
    # 如果单词交集占比很高（>= 80%），但总单词数差异很大，降低相似度
    # 例如："pov cheek grabbing concept" vs "open door concept sliding doors"
    # 交集只有 "concept"，但总单词数差异大，应该降低相似度
    if len(intersection) > 0:
        min_words = min(len(words1), len(words2))
        max_words = max(len(words1), len(words2))
        if max_words > min_words * 1.5:  # 单词数差异超过 50%
            # 降低相似度，避免因为少量共同词导致误匹配
            word_ratio = len(intersection) / max_words
            if word_ratio < 0.5:  # 共同词占比小于 50%
                combined_similarity *= 0.7  # 降低 30%
    
    # 检查是否一个名称包含另一个（完全包含的情况）
    # 例如："zuki cute ill v40" 包含在 "zuki cute ill v40 sdxl" 中
    if norm1 in norm2 or norm2 in norm1:
        # 完全包含时，相似度至少为 0.90
        combined_similarity = max(combined_similarity, 0.90)
    
    # 检查核心单词是否完全匹配（即使有额外后缀）
    # 例如："zuki cute ill v40" vs "zuki cute ill v40 sdxl"
    # 如果较短的名称的所有单词都在较长的名称中，且占比 >= 80%，提升相似度
    if len(words1) > 0 and len(words2) > 0:
        shorter_words = words1 if len(words1) <= len(words2) else words2
        longer_words = words2 if len(words1) <= len(words2) else words1
        
        # 计算较短名称的单词在较长名称中的占比
        matched_words = shorter_words & longer_words
        if len(matched_words) == len(shorter_words) and len(shorter_words) >= 3:
            # 所有核心单词都匹配，且核心单词数 >= 3
            match_ratio = len(matched_words) / len(shorter_words)
            if match_ratio >= 0.8:  # 至少 80% 的单词匹配
                # 提升相似度，但不超过 0.95
                combined_similarity = max(combined_similarity, min(0.95, jaccard_similarity * 1.2))
    
    return combined_similarity
