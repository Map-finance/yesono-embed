import { zh_TW } from './zh-TW';
import { zh_CN } from './zh-CN';
import { en } from './en';
import { ja } from './ja';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { it } from './it';
import { ru } from './ru';
import { fa } from './fa';
import { ar } from './ar';
import { el } from './el';
import { hu } from './hu';
import { vi } from './vi';
import { th } from './th';
import { km } from './km';

// 扩展语言支持
export const translations = {
  'zh-CN': zh_CN,
  'zh-TW': zh_TW,
  en,  // 英语 - 完整翻译
  ja,  // 日语 - 部分翻译
  de,  // 德语 - 部分翻译
  fr,  // 法语 - 部分翻译
  es,  // 西班牙语 - 部分翻译
  it,  // 意大利语 - 部分翻译
  ru,  // 俄语 - 部分翻译
  fa,  // 波斯语 - 部分翻译
  ar,  // 阿拉伯语 - 部分翻译
  el,  // 希腊语 - 部分翻译
  hu,  // 匈牙利语 - 部分翻译
  vi,  // 越南语 - 部分翻译
  th,  // 泰语 - 部分翻译
  km,  // 高棉语 - 部分翻译
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof zh_CN;

// 重新导出所有语言配置
export { zh_CN, zh_TW, en, ja, de, fr, es, it, ru, fa, ar, el, hu, vi, th, km };
