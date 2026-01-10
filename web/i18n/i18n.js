/**
 * 国际化管理器
 */

import { translations } from './locales.js';

const LANGUAGE_STORAGE_KEY = 'comfyui-find-models-language';
const DEFAULT_LANGUAGE = 'en'; // 默认英文

// 获取当前语言（从 localStorage 读取，如果没有则使用默认语言）
export function getCurrentLanguage() {
    try {
        const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh')) {
            return savedLanguage;
        }
    } catch (error) {
        // console.warn('[ComfyUI-find-models] 读取语言设置失败:', error);
    }
    return DEFAULT_LANGUAGE;
}

// 设置语言并保存到 localStorage（不过期）
export function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'zh') {
        // console.warn(`[ComfyUI-find-models] 不支持的语言: ${lang}`);
        return;
    }
    
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        // 触发语言变更事件，通知其他组件更新
        window.dispatchEvent(new CustomEvent('comfyui-find-models-language-changed', { detail: { language: lang } }));
    } catch (error) {
        // console.error('[ComfyUI-find-models] 保存语言设置失败:', error);
    }
}

// 获取翻译文本
export function t(key, params = {}) {
    const lang = getCurrentLanguage();
    const text = translations[lang]?.[key] || translations[DEFAULT_LANGUAGE]?.[key] || key;
    
    // 支持参数替换（例如：{index} -> params.index）
    return text.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
    });
}

// 切换语言
export function toggleLanguage() {
    const currentLang = getCurrentLanguage();
    const newLang = currentLang === 'en' ? 'zh' : 'en';
    setLanguage(newLang);
    return newLang;
}
