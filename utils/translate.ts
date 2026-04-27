type TranslateOptions = {
  source?: string;
  target: string;
  useLocalCache?: boolean;
};

const localCache = new Map<string, string>();

export async function translateTexts(
  texts: string[],
  options: TranslateOptions
): Promise<string[]> {
  const { source = "auto", target, useLocalCache = true } = options;

  if (!target) throw new Error("translateTexts requires a target language");

  const textIndexMap = new Map<string, number[]>();
  texts.forEach((text, idx) => {
    if (!textIndexMap.has(text)) textIndexMap.set(text, []);
    textIndexMap.get(text)!.push(idx);
  });
  const uniqueTexts = Array.from(textIndexMap.keys());
  const results: string[] = new Array(texts.length);

  const uncachedTexts: string[] = [];

  const cacheKey = (text: string) => `${target}::${text}`;

  // ① 查本地缓存（缓存与目标语言相关）
  uniqueTexts.forEach((text) => {
    const key = cacheKey(text);
    if (useLocalCache && localCache.has(key)) {
      for (const idx of textIndexMap.get(text)!) {
        results[idx] = localCache.get(key)!;
      }
    } else {
      uncachedTexts.push(text);
    }
  });

  if (uncachedTexts.length) {
    // ② 批量调用 Google 翻译
    const joined = uncachedTexts.join("\uE000\n");
    const translated = await fetchGoogleTranslate(joined, source, target);

    // ③ 回填结果并写缓存（以 target::text 为 key）
    for (let i = 0; i < translated.length; i++) {
      const original = uncachedTexts[i];
      const trText = translated[i];
      const key = cacheKey(original);
      if (useLocalCache) localCache.set(key, trText);
      for (const idx of textIndexMap.get(original)!) {
        results[idx] = trText;
      }
    }
  }

  return results;
}

async function fetchGoogleTranslate(
  text: string,
  source: string,
  target: string
): Promise<string[]> {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(
      text
    )}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": navigator.userAgent,
    },
  });

  if (!res.ok) throw new Error("Google Translate fetch failed");

  const data = await res.json();

  // 返回按行分割的数组
  return data[0].map((item: any) => item[0]).join("").split("\uE000\n");
}
