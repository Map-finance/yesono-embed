/**
 * To-B hooks 统一出口（v1.1：仅写入类）
 *
 * 用法：import { useTobOrderCancel } from "@/lib/hooks/tob";
 */

export { useAsyncResource } from "./useAsyncResource";
export { useTobMutation } from "./useTobMutation";

export { useTobOrderCancel } from "./useTobOrderCancel";
export {
  useTobOrderSplit,
  useTobOrderMerge,
  useTobOrderRedeem,
  useTobActionStatusPolling,
} from "./useTobOrderActions";
export { useTobCreateOrder } from "./useTobCreateOrder";
export { useTobUmaCreate } from "./useTobUmaCreate";

/** feature flags（详见 .env.example） */
export const TOB_FEATURE_FLAGS = {
  useNewCancel: process.env.NEXT_PUBLIC_TOB_USE_NEW_CANCEL === "1",
  useNewMarket: process.env.NEXT_PUBLIC_TOB_USE_NEW_MARKET === "1",
  useNewCtf: process.env.NEXT_PUBLIC_TOB_USE_NEW_CTF === "1",
  useNewOrder: process.env.NEXT_PUBLIC_TOB_USE_NEW_ORDER === "1",
} as const;
