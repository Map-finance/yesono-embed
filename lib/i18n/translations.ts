/**
 * 国际化翻译文件
 * 支持 en (英文) 和 zh (中文)
 */
import sports from "./langs/sports"
import leaderboard from "./langs/leaderboard"
import trade from "./langs/trade"
import pna from "./langs/pna"
import earnings from "./langs/earnings"
import rewards from "./langs/rewards"
import accuracy from "./langs/accuracy"
import common from "./langs/common"
import market from "./langs/market"
import account from "./langs/account"
import errors from "./langs/errors"
import terms from "./langs/terms"
import * as locales from "@/locales"

export type Locale = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'de' | 'fr' | 'es' | 'it' | 'ru' | 'fa' | 'ar' | 'el' | 'hu' | 'vi' | 'th' | 'km';

/**
 * 语言显示标签映射
 */
export const languageLabels = {
  lang_en_label: 'English',
  lang_zh_cn_label: '简体中文',
  lang_zh_tw_label: '繁體中文',
  lang_ja_label: '日本語',
  lang_de_label: 'Deutsch',
  lang_fr_label: 'Français',
  lang_es_label: 'Español',
  lang_it_label: 'Italiano',
  lang_ru_label: 'Русский',
  lang_fa_label: 'فارسی',
  lang_ar_label: 'العربية',
  lang_el_label: 'Ελληνικά',
  lang_hu_label: 'Magyar',
  lang_vi_label: 'Tiếng Việt',
  lang_th_label: 'ภาษาไทย',
  lang_km_label: 'ភាសាខ្មែរ',
};

/**
 * 助手函数：将 locales 目录下的扁平结构映射到 lib/i18n 的命名空间结构
 */
const mapLocale = (localeObj: any, base: any) => {
  return {
    ...base,
    common: {
      ...base.common,
      ...languageLabels,
      back: localeObj.return || base.common.back,
      loading: localeObj.loading || base.common.loading,
      success: localeObj.success || base.common.success,
      error: localeObj.error || base.common.error,
      confirm: localeObj.confirm || base.common.confirm,
      cancel: localeObj.cancel || base.common.cancel,
      close: localeObj.close || base.common.close,
      logout: localeObj.logout || base.common.logout,
      login: localeObj.login || base.common.login,
    },
    trading: {
      ...base.trading,
      market: localeObj.market || base.trading.market,
      balance: localeObj.balance || base.trading.balance,
      max: localeObj.max || base.trading.max,
      confirmTrade: localeObj.confirmBet || base.trading.confirmTrade,
    }
  };
};

const SPORTS_NAV_LABELS: Partial<Record<Locale, { allSports: string; asian: string }>> = {
  'zh-TW': { allSports: '所有體育', asian: '亞盤' },
  ja: { allSports: 'すべてのスポーツ', asian: 'アジアン' },
  de: { allSports: 'Alle Sportarten', asian: 'Asiatisch' },
  fr: { allSports: 'Tous les sports', asian: 'Asiatique' },
  es: { allSports: 'Todos los deportes', asian: 'Asiático' },
  it: { allSports: 'Tutti gli sport', asian: 'Asiatico' },
  ru: { allSports: 'Все виды спорта', asian: 'Азиатский' },
  fa: { allSports: 'همه ورزش‌ها', asian: 'آسیایی' },
  ar: { allSports: 'جميع الرياضات', asian: 'آسيوي' },
  el: { allSports: 'Όλα τα αθλήματα', asian: 'Ασιατικό' },
  hu: { allSports: 'Minden sport', asian: 'Ázsiai' },
  vi: { allSports: 'Tất cả môn thể thao', asian: 'Châu Á' },
  th: { allSports: 'กีฬาทั้งหมด', asian: 'เอเชีย' },
  km: { allSports: 'កីឡាទាំងអស់', asian: 'អាស៊ី' },
};

const withLocalizedSportsNav = (locale: Locale, translation: any) => {
  const localizedNav = SPORTS_NAV_LABELS[locale];
  if (!localizedNav) return translation;

  return {
    ...translation,
    sports: {
      ...translation.sports,
      nav: {
        ...translation.sports?.nav,
        ...localizedNav,
      },
    },
  };
};

const en = {
  // 通用
  common: {
    ...languageLabels,
    ...common.en
  },

  // 分类
  categories: {
    all: 'All',
    economy: 'Economy',
    politics: 'Politics',
    world: 'World',
    sports: 'Sports',
    crypto: 'Crypto',
    finance: 'Finance',
    tech: 'Tech',
    culture: 'Culture',
  },

  // Breaking 页面
  breaking: {
    title: 'Breaking News',
    subtitle: 'See the yesono markets that moved the most in the last 24 hours',
    getDailyUpdates: 'Get daily updates',
    dailyUpdatesDesc: "We'll send you an email every day with what's moving on YesONo",
    enterEmail: 'Enter your email',
    getUpdates: 'Get updates',
    liveFrom: 'Live from @yesono',
    followOnX: 'Follow on X',
    breakingNews: 'Breaking news',
    newMarket: 'New yesono market',
  },

  // Market 详情页
  market: {
    ...market.en
  },

  // 交易面板
  trading: {
    ...trade.en,
    market: 'Market',
    limit: 'Limit',
    amm: 'AMM',
    balance: 'Balance',
    max: 'Max',
    estimatedShares: 'Est. Shares',
    totalCost: 'Total Cost',
    fee: 'Fee',
    slippage: 'Slippage',
    confirmTrade: 'Confirm Trade',
    insufficientBalance: 'Insufficient Balance'
  },
  sports: sports.en,
  leaderboard: leaderboard.en,
  trade: trade.en,
  pna: pna.en,
  earnings: earnings.en,
  account: account.en,
  rewards: rewards.en,
  accuracy: accuracy.en,
  errors: errors.en,
  terms: terms.en,
};

const zh_CN = {
  // 通用
  common: {
    ...languageLabels,
    ...common['zh-CN']
  },

  // 分类
  categories: {
    all: '全部',
    economy: '经济',
    politics: '政治',
    world: '世界',
    sports: '体育',
    crypto: '加密货币',
    finance: '金融',
    tech: '科技',
    culture: '文化',
  },

  // Breaking 页面
  breaking: {
    title: '突发新闻',
    subtitle: '查看过去24小时内变化最大的 YesONo 市场',
    getDailyUpdates: '获取每日更新',
    dailyUpdatesDesc: '我们将每天发送邮件，告诉您 YesONo 上的最新动态',
    enterEmail: '输入您的邮箱',
    getUpdates: '获取更新',
    liveFrom: '来自 @yesono 的实时动态',
    followOnX: '在 X 上关注',
    breakingNews: '突发新闻',
    newMarket: '新 YesONo 市场',
  },

  // Market 详情页
  market: {
    ...market['zh-CN']
  },

  // 交易面板
  trading: {
    ...trade.zh,
    market: '市价',
    limit: '限价',
    amm: 'AMM',
    balance: '余额',
    max: '最大',
    estimatedShares: '预计份额',
    totalCost: '总成本',
    fee: '手续费',
    slippage: '滑点',
    confirmTrade: '确认交易',
    insufficientBalance: '余额不足'
  },
  sports: sports.zh,
  leaderboard: leaderboard['zh-CN'],
  trade: trade.zh,
  pna: pna['zh-CN'],
  earnings: earnings.zh,
  account: account['zh-CN'],
  rewards: rewards.zh,
  accuracy: accuracy.zh,
  errors: errors.zh,
  terms: terms['zh-CN'],
};

const zh_TW = mapLocale(locales.zh_TW, {
  ...zh_CN,
  common: {
    ...zh_CN.common,
    ...common['zh-TW']
  },
  market: {
    ...zh_CN.market,
    ...market['zh-TW']
  },
  leaderboard: leaderboard['zh-TW'],
  pna: pna['zh-TW'],
  account: account['zh-TW'],
  trade: trade['zh-TW'],
  trading: {
    ...zh_CN.trading,
    ...trade['zh-TW']
  },
  terms: terms['zh-TW'],
});

export const translations = {
  en,
  'zh-CN': zh_CN,
  'zh-TW': withLocalizedSportsNav('zh-TW', zh_TW),
  // 使用 mapLocale 将 locales 目录下的语言包集成
  ja: withLocalizedSportsNav('ja', mapLocale(locales.ja, { ...en, common: { ...en.common, ...common.ja }, market: { ...en.market, ...market.ja }, leaderboard: leaderboard.ja, pna: pna.ja, account: account.ja, trade: trade.ja, trading: { ...en.trading, ...trade.ja }, terms: terms.ja })),
  de: withLocalizedSportsNav('de', mapLocale(locales.de, { ...en, common: { ...en.common, ...common.de }, market: { ...en.market, ...market.de }, leaderboard: leaderboard.de, pna: pna.de, account: account.de, trade: trade.de, trading: { ...en.trading, ...trade.de }, terms: terms.de })),
  fr: withLocalizedSportsNav('fr', mapLocale(locales.fr, { ...en, common: { ...en.common, ...common.fr }, market: { ...en.market, ...market.fr }, leaderboard: leaderboard.fr, pna: pna.fr, account: account.fr, trade: trade.fr, trading: { ...en.trading, ...trade.fr }, terms: terms.fr })),
  es: withLocalizedSportsNav('es', mapLocale(locales.es, { ...en, common: { ...en.common, ...common.es }, market: { ...en.market, ...market.es }, leaderboard: leaderboard.es, pna: pna.es, account: account.es, trade: trade.es, trading: { ...en.trading, ...trade.es }, terms: terms.es })),
  it: withLocalizedSportsNav('it', mapLocale(locales.it, { ...en, common: { ...en.common, ...common.it }, market: { ...en.market, ...market.it }, leaderboard: leaderboard.it, pna: pna.it, account: account.it, trade: trade.it, trading: { ...en.trading, ...trade.it }, terms: terms.it })),
  ru: withLocalizedSportsNav('ru', mapLocale(locales.ru, { ...en, common: { ...en.common, ...common.ru }, market: { ...en.market, ...market.ru }, leaderboard: leaderboard.ru, pna: pna.ru, account: account.ru, trade: trade.ru, trading: { ...en.trading, ...trade.ru }, terms: terms.ru })),
  fa: withLocalizedSportsNav('fa', mapLocale(locales.fa, { ...en, common: { ...en.common, ...common.fa }, market: { ...en.market, ...market.fa }, leaderboard: leaderboard.fa, pna: pna.fa, account: account.fa, trade: trade.fa, trading: { ...en.trading, ...trade.fa }, terms: terms.fa })),
  ar: withLocalizedSportsNav('ar', mapLocale(locales.ar, { ...en, common: { ...en.common, ...common.ar }, market: { ...en.market, ...market.ar }, leaderboard: leaderboard.ar, pna: pna.ar, account: account.ar, trade: trade.ar, trading: { ...en.trading, ...trade.ar }, terms: terms.ar })),
  el: withLocalizedSportsNav('el', mapLocale(locales.el, { ...en, common: { ...en.common, ...common.el }, market: { ...en.market, ...market.el }, leaderboard: leaderboard.el, pna: pna.el, account: account.el, trade: trade.el, trading: { ...en.trading, ...trade.el }, terms: terms.el })),
  hu: withLocalizedSportsNav('hu', mapLocale(locales.hu, { ...en, common: { ...en.common, ...common.hu }, market: { ...en.market, ...market.hu }, leaderboard: leaderboard.hu, pna: pna.hu, account: account.hu, trade: trade.hu, trading: { ...en.trading, ...trade.hu }, terms: terms.hu })),
  vi: withLocalizedSportsNav('vi', mapLocale(locales.vi, { ...en, common: { ...en.common, ...common.vi }, market: { ...en.market, ...market.vi }, leaderboard: leaderboard.vi, pna: pna.vi, account: account.vi, trade: trade.vi, trading: { ...en.trading, ...trade.vi }, terms: terms.vi })),
  th: withLocalizedSportsNav('th', mapLocale(locales.th, { ...en, common: { ...en.common, ...common.th }, market: { ...en.market, ...market.th }, leaderboard: leaderboard.th, pna: pna.th, account: account.th, trade: trade.th, trading: { ...en.trading, ...trade.th }, terms: terms.th })),
  km: withLocalizedSportsNav('km', mapLocale(locales.km, { ...en, common: { ...en.common, ...common.km }, market: { ...en.market, ...market.km }, leaderboard: leaderboard.km, pna: pna.km, account: account.km, trade: trade.km, trading: { ...en.trading, ...trade.km }, terms: terms.km })),
} as const;

// 类型工具：把嵌套对象递归展开为以点分隔的路径字符串联合
type ExtractStringKeys<T> = Extract<keyof T, string>;

type Paths<T, P extends string = ""> = T extends object
  ? {
      [K in ExtractStringKeys<T>]: T[K] extends object
        ? `${P}${K}` | Paths<T[K], `${P}${K}.`>
        : `${P}${K}`;
    }[ExtractStringKeys<T>]
  : never;

export type TranslationPathKeys = Paths<typeof translations.en>;
export type TranslationKeys = typeof translations.en;
