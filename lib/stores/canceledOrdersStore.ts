import { create } from "zustand";

/**
 * 已取消订单(按 orderId)—— 乐观移除用的响应式集合。
 *
 * 背景:取消是后端 + 链上操作,后端把订单状态从 pending 翻成 canceled 有延迟。
 * 取消后立即 markCanceled(orderId),「当前委托」(status=pending 的 useMarketOrders 实例)
 * 据此把该单过滤掉、立刻消失,不等后端、也不会被随后的 refetch 闪回。
 *
 * 注意:只过滤「当前委托」,不过滤「历史委托」—— 该单稍后会以 canceled 出现在历史委托里。
 *
 * orderId 是后端雪花 ID,全局唯一、不复用,所以集合只增不减也安全(内存极小);
 * 不做清理以避免重渲染抖动。
 */
interface CanceledOrdersState {
  canceled: Set<string>;
  markCanceled: (orderId: string | number) => void;
}

export const useCanceledOrdersStore = create<CanceledOrdersState>((set) => ({
  canceled: new Set<string>(),
  markCanceled: (orderId) =>
    set((s) => {
      const id = String(orderId);
      if (!id || s.canceled.has(id)) return s;
      const next = new Set(s.canceled);
      next.add(id);
      return { canceled: next };
    }),
}));
