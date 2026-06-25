/**
 * marketFee - 交易 taker 手续费(单一来源)
 *
 * 公式:fee = C × feeRate × p × (1-p)
 *   - C = 份额, p = 价格(0-1), feeRate = 按类目费率
 *   - p=0.5 时最大(C × feeRate × 0.25);越靠 0/1 越小
 *
 * 费率来源:内置默认表 + env `NEXT_PUBLIC_MARKET_FEE_RATES`(JSON, key=类目 slug)覆盖。
 * 仅买入(taker)需要预留 + 展示;卖出不在此 gate(费从到手里扣)。
 */

/** 内置默认费率表(键 = 类目 slug;与产品给定一致) */
const DEFAULT_FEE_RATES: Record<string, number> = {
  crypto: 0.07,
  sports: 0.03,
  finance: 0.04,
  politics: 0.04,
  tech: 0.04,
  mentions: 0.04,
  economics: 0.05,
  culture: 0.05,
  weather: 0.05,
  geopolitics: 0,
  other: 0.05,
};
const FALLBACK_RATE = 0.05; // 未识别类目兜底

/** 解析 env JSON 覆盖(非法值忽略,费率须 ∈ [0,1]) */
function readEnvRates(): Record<string, number> {
  const raw = process.env.NEXT_PUBLIC_MARKET_FEE_RATES;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1) out[k.toLowerCase()] = n;
    }
    return out;
  } catch (e) {
    console.warn("[marketFee] invalid NEXT_PUBLIC_MARKET_FEE_RATES", e);
    return {};
  }
}
const ENV_RATES = readEnvRates();

/** 按类目 slug 取费率(env 覆盖 > 默认表 > 兜底) */
export function getCategoryFeeRate(category?: string | null): number {
  const key = (category || "").toLowerCase();
  if (key && key in ENV_RATES) return ENV_RATES[key];
  if (key && key in DEFAULT_FEE_RATES) return DEFAULT_FEE_RATES[key];
  return ENV_RATES.other ?? DEFAULT_FEE_RATES.other ?? FALLBACK_RATE;
}

type FeeEventLike = {
  categorySlug?: string | null;
  tags?: { slug?: string | null }[] | null;
} | null | undefined;

/** 从事件对象解析费率:categorySlug 优先 → 扫 tags[].slug 命中已知类目 → 兜底 */
export function resolveFeeRate(event: FeeEventLike): number {
  if (!event) return getCategoryFeeRate(null);
  if (event.categorySlug) return getCategoryFeeRate(event.categorySlug);
  for (const t of event.tags || []) {
    const slug = (t?.slug || "").toLowerCase();
    if (slug && (slug in ENV_RATES || slug in DEFAULT_FEE_RATES)) {
      return getCategoryFeeRate(slug);
    }
  }
  return getCategoryFeeRate(null);
}

/** 单价手续费:C × feeRate × p × (1-p),p clamp 到 [0,1];异常返回 0 */
export function computeFee(shares: number, feeRate: number, price: number): number {
  if (!(shares > 0) || !(feeRate > 0)) return 0;
  const p = Math.min(1, Math.max(0, price));
  return shares * feeRate * p * (1 - p);
}

/**
 * 手续费金额展示(USD):
 * - ≥ $0.01:两位小数($0.09)
 * - 不足 1 分(0 < fee < 0.01):保留有效小数、去尾零,确保非零可见($0.0035),
 *   极小值再加精度,避免显示成 $0.00。
 */
export function formatFeeUsd(fee: number): string {
  if (!(fee > 0)) return "$0.00";
  if (fee >= 0.01) return `$${fee.toFixed(2)}`;
  let s = fee.toFixed(4);
  if (parseFloat(s) === 0) s = fee.toFixed(6);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return `$${s}`;
}
