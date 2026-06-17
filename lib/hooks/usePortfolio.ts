/**
 * usePortfolio - h2 portfolio 全局缓存的 embed 占位。
 *
 * h2 在右上角持续渲染钱包总览(USDT 余额、累积持仓),redeem/cancel/下单后调
 * refreshPortfolio() 让那块儿立即更新。embed iframe 形态没有总览面板,这里就是 no-op。
 *
 * 保留 1:1 export 签名,避免 h2 组件移植时改 import。
 */
export function refreshPortfolio(): void {
  /* no-op:embed 无 portfolio 总览 */
}
