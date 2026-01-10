/**
 * 链接过滤工具函数
 */

/**
 * 过滤链接：Civitai 和 Hugging Face 必须有 file_size 且 >= 10MB，Google 链接可以没有
 */
export function filterLinksBySize(links) {
    return links.filter(link => {
        const source = link.source || "";
        if (source.includes("Google")) {
            return true;
        }
        if (source === "Civitai" || source === "Hugging Face") {
            const fileSize = link.file_size;
            if (!fileSize || fileSize === 0) {
                return false;
            }
            const fileSizeMB = fileSize / (1024 * 1024);
            return fileSizeMB >= 10;
        }
        const fileSize = link.file_size;
        if (!fileSize || fileSize === 0) {
            return false;
        }
        const fileSizeMB = fileSize / (1024 * 1024);
        return fileSizeMB >= 10;
    });
}

/**
 * 检查是否为非精确匹配
 */
export function isNonExactMatch(link) {
    // 检查 is_non_exact_match 字段（后端标记）
    if (link.is_non_exact_match === true) {
        return true;
    }
    // 兼容旧的 note 字段检查
    return link.note && (link.note.includes("可能不是精确匹配") || link.note.includes("精确匹配"));
}

/**
 * 过滤非精确匹配的链接（当有精确匹配时）
 * 非精准匹配的结果不在界面上显示，但会保存在缓存中
 */
export function filterNonExactMatches(filteredLinks) {
    // 直接过滤掉所有非精准匹配的 Civitai 和 Hugging Face 结果
    // 这样它们不会在界面上显示，但会保存在缓存中
    return filteredLinks.filter(link => {
        const source = link.source || "";
        if (source === "Civitai" || source === "Hugging Face") {
            // 过滤掉非精准匹配的结果
            return !isNonExactMatch(link);
        }
        return true; // Google 等其他链接保留
    });
}
