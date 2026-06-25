/**
 * 球队/盘口名缩写 —— 列表与详情按钮统一口径。
 *
 * 拉丁文按「单词」取前 4 个字母(如 Barcelona → BARC);
 * CJK(中/日/韩)无空格分词且逐字过宽,只取前 3 个字符即可辨识
 * (取 4 字会撑爆固定宽按钮导致换行截断)。
 */
export function getTeamAbbr(title: string): string {
  const clean = (title || "").replace(/\s*\(.*?\)/, "").trim();
  // CJK 文字:全角字符约为拉丁字母两倍宽,取前 3 字
  if (/[一-鿿぀-ヿ가-힯]/.test(clean)) {
    return clean.slice(0, 3);
  }
  const words = clean.split(/\s+/);
  const word = words.find((w) => w.length > 2) || words[0] || "";
  return word.slice(0, 4).toUpperCase();
}
