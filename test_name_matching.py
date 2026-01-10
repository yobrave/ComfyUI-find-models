#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试名称匹配功能
"""

import sys
import io

# 设置输出编码为 UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from name_matcher import normalize_name, calculate_name_similarity

def test_case(name1, name2, expected_match, description=""):
    """测试单个用例"""
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)
    similarity = calculate_name_similarity(name1, name2)
    is_match = similarity >= 0.85  # Civitai 使用的阈值
    
    status = "[OK]" if is_match == expected_match else "[FAIL]"
    match_text = "匹配" if is_match else "不匹配"
    expected_text = "应该匹配" if expected_match else "不应该匹配"
    
    print(f"{status} {description}")
    print(f"  名称1: {name1}")
    print(f"  名称2: {name2}")
    print(f"  规范化1: {norm1}")
    print(f"  规范化2: {norm2}")
    print(f"  相似度: {similarity:.4f}")
    print(f"  结果: {match_text} (阈值: 0.85, {expected_text})")
    print()

# 测试用例
print("=" * 70)
print("名称匹配功能测试")
print("=" * 70)
print()

# 测试用例 1: 正确的匹配（用户确认的）
test_case(
    "zukiCuteILL_v40.safetensors",
    "zuki-cute-ill-v40-sdxl",
    True,
    "测试用例 1: zukiCuteILL_v40 应该匹配 zuki-cute-ill-v40-sdxl"
)

# 测试用例 2: 不应该匹配的（用户报告的误匹配）
test_case(
    "POV Cheek Grabbing - Concept.safetensors",
    "open_door - Concept (sliding doors)",
    False,
    "测试用例 2: POV Cheek Grabbing 不应该匹配 open_door"
)

# 测试用例 3: 完全匹配
test_case(
    "test_model.safetensors",
    "test_model.safetensors",
    True,
    "测试用例 3: 完全相同的名称"
)

# 测试用例 4: 不同分隔符
test_case(
    "test_model.safetensors",
    "test-model.safetensors",
    True,
    "测试用例 4: 不同分隔符（下划线 vs 连字符）"
)

# 测试用例 5: 大小写不同
test_case(
    "TestModel.safetensors",
    "test_model.safetensors",
    True,
    "测试用例 5: 大小写不同"
)

# 测试用例 6: 驼峰命名
test_case(
    "userProfileName.safetensors",
    "user_profile_name.safetensors",
    True,
    "测试用例 6: 驼峰命名 vs 蛇形命名"
)

# 测试用例 7: 版本号差异
test_case(
    "model_v1.safetensors",
    "model_v2.safetensors",
    False,
    "测试用例 7: 版本号不同（v1 vs v2）"
)

# 测试用例 8: 部分匹配但核心相同
test_case(
    "concept_model.safetensors",
    "concept_model_v2.safetensors",
    True,
    "测试用例 8: 版本后缀差异（应该匹配）"
)

# 测试用例 9: 完全不相关
test_case(
    "model_a.safetensors",
    "model_b.safetensors",
    False,
    "测试用例 9: 完全不相关的模型"
)

# 测试用例 10: 共同词但核心不同
test_case(
    "anime_style.safetensors",
    "realistic_style.safetensors",
    False,
    "测试用例 10: 只有共同词 'style'，核心不同"
)

print("=" * 70)
print("测试完成")
print("=" * 70)
