/**
 * Trade error message mapper.
 *
 * 下单/撤单的后端 raw 错误经常是长串 dYdX SDK 错误链(包含 final_settlement /
 * clobpair status / DUPLICATE_ORDER 等内部标识),直接塞给用户体验很差。
 * 这里识别已知错误模式,映射成 caller 传入的友好文案;其它错误原样返回(不吞业务错误)。
 */
export interface TradeErrorTexts {
  /** 市场已结束/结算,无法下单 */
  marketExpired: string;
  /** 重复下单(后端 DUPLICATE_ORDER / 前端请求去重) */
  duplicateOrder?: string;
}

export function mapTradeErrorMessage(
  raw: string | undefined | null,
  texts: TradeErrorTexts
): string | undefined {
  if (!raw) return raw ?? undefined;
  const lower = raw.toLowerCase();
  // 市场已结算/交易已禁用(dYdX 链上拒单)
  if (
    lower.includes("final_settlement") ||
    lower.includes("trading is disabled for clob pair") ||
    lower.includes("clobpair status")
  ) {
    return texts.marketExpired;
  }
  // 重复下单:后端返回 "Duplicate order request detected"(code DUPLICATE_ORDER),
  // 或前端请求去重抛同样文案。映射成友好提示。
  if (texts.duplicateOrder && lower.includes("duplicate order")) {
    return texts.duplicateOrder;
  }
  return raw;
}
