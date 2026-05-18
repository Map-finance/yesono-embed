/**
 * CreateMarketNew 的纯工具函数 / 类型 / 常量集合。
 *
 * 从 CreateMarketNew.tsx 拆出，机械搬运不改变语义。该文件只放
 * 「与组件 state 无耦合」的辅助代码，UI 与 hooks 仍留在主文件。
 */

import dayjs from "dayjs";
import type {
  CreateMarketRespV2,
} from "@/types/market";
import type { MarketBatchFailedItemResp } from "@/lib/api";
import type { MoneylineTeam } from "./SportsMarketConfigurator";

// ---------------------------------------------------------------- toHex
// 替换 viem.toHex：yesono-embed 不引入 viem，用内联实现
// （输入 Uint8Array 时返回 0x 前缀的 hex 字符串）
export function toHex(input: string | Uint8Array): `0x${string}` {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `0x${hex}`;
}

// ---------------------------------------------------------------- bet amount / id
/**
 * TobUmaMarketCreateReq.betAmount 必填且 >0；UI 不暴露。
 * 优先取 env `NEXT_PUBLIC_TOB_DEFAULT_CREATE_BET_AMOUNT`，缺省回落 "5"
 * （后端限制 betAmount > 0，"0" 会被拒；先用 5 USDT 作为最小创建押注）
 */
export function getDefaultCreateBetAmount(): string {
  const raw = process.env.NEXT_PUBLIC_TOB_DEFAULT_CREATE_BET_AMOUNT;
  const trimmed = raw && raw.trim();
  if (trimmed && Number.parseFloat(trimmed) > 0) {
    return trimmed;
  }
  return "5";
}

/** 幂等 betId；优先用 crypto.randomUUID，降级到 Date.now + 随机串 */
export function newBetId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {}
  return `bet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------- step / type 枚举
export type Step =
  // Sports flow
  | "category"
  | "candidate"
  | "config"
  | "confirm"
  | "processing"
  | "success"
  // General flow
  | "general_question"
  | "general_details"
  | "general_preview"
  // Crypto flow
  | "crypto_select_event"
  | "crypto_form"
  // Batch Event & Markets flow
  | "event_info"
  | "batch_markets"
  | "global_settings"
  | "event_confirm";

// Crypto 市场类型
export type CryptoMarketType =
  | "above"
  | "below"
  | "price-range"
  | "hit-price"
  | "first-to-hit"
  | "custom";
// 时间类型
export type CryptoTimeType = "daily" | "weekly" | "monthly" | "yearly";

/** 批量生成的市场项 */
export interface BatchMarketItem {
  id: string;
  keyword: string; // 市场关键词（用户输入）
  question: string; // AI 生成的市场标题
  description?: string; // AI 生成的市场描述
  error?: string; // 审核错误信息
  repeat_id?: number | null;
}

// ---------------------------------------------------------------- 回填数据
/** 从外部传入的回填数据（用于「重新创建」场景） */
export interface CreateMarketInitialData {
  category?: string;
  question?: string;
  title?: string;
  description?: string;
  endDate?: string;
  image?: string;
  icon?: string;
  subType?: string;
  marketValue?: number;
  groupItemTitle?: string;
  period?: string;
  type?: string;
  /** Sports 流程：直接跳到 config 步骤 */
  candidateId?: string;
  /** Sports 流程：候选人名称（用于展示） */
  candidateTitle?: string;
  /** Sports 流程：结果选项列表（用于回填 outcomes） */
  outcomeNames?: string[];
  /** Batch General 流程：父事件标题 */
  batchEventTitle?: string;
  /** Batch General 流程：父事件 ID（已存在的事件） */
  batchEventId?: number;
  /** Batch General 流程：父事件描述 */
  batchEventDescription?: string;
  /** Batch General 流程：截止日期 (YYYY-MM-DD) */
  batchResolutionDate?: string;
  /** Batch General 流程：预填的市场列表 */
  batchMarkets?: Array<{
    keyword: string;
    question: string;
    description?: string;
  }>;
  /** Sports 流程：预填的市场配置（enabledTypes / totalsLines / spreadsLines / moneylineTeams） */
  sportsInitialConfig?: {
    enabledTypes?: { moneyline?: boolean; totals?: boolean; spreads?: boolean };
    totalsLines?: string[];
    spreadsLines?: string[];
    /** 预填的 moneyline 参与者（含 DRAW 时传入 {id:"DRAW", name:"Draw"}） */
    moneylineTeams?: MoneylineTeam[];
  };
  /** Sports 流程：参与者 ID 数组（moneyline outcomes） */
  participantIds?: string[];
  /** Batch General 流程：预填的 tags */
  batchTags?: Array<{ name: string; slug: string }>;
  /** Batch General 流程：预填的 tag ID 数组 */
  batchTagIds?: string[];
  /** 审核记录回填（从审核记录列表进入创建/修改时传入） */
  reviewRecord?: {
    id: number;
    status: "approved" | "rejected" | "pending";
    input: any;
    metadata: Record<string, any>;
    result: any;
  };
  /** Crypto 流程回填字段 */
  cryptoMarketType?: string;
  cryptoCoin?: string;
  cryptoExchange?: string;
  cryptoTimeType?: string;
  cryptoHitPriceMode?: "target" | "first_to_hit"; // legacy, mapped to type
  cryptoTargetPrices?: string[];
  cryptoRanges?: Array<{
    low: string;
    high: string;
    direction: "above" | "below" | "range";
  }>;
  cryptoHitTargets?: string[];
  cryptoFirstToHits?: Array<{ priceA: string; priceB: string }>;
  /** 已有市场列表（审核记录中事件下已存在的市场，不可编辑） */
  existingEventMarkets?: Array<{
    id: number | string;
    question: string;
    description?: string;
  }>;
}

export interface CreateMarketNewProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 回填数据：从市场创建记录中「重新创建」时传入 */
  initialData?: CreateMarketInitialData;
}

// ---------------------------------------------------------------- timestamp / sports 归一化
export type MaybeTimestampValue = string | number | null | undefined;

export function normalizeTimestampValue(
  value: MaybeTimestampValue
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = dayjs(trimmed);
  return parsed.isValid() ? parsed.valueOf() : null;
}

export function formatTimestampDateOnly(value: MaybeTimestampValue): string {
  const normalized = normalizeTimestampValue(value);
  if (normalized == null) return "";
  return dayjs(normalized).format("YYYY-MM-DD");
}

export function normalizeSportsLineValue(
  value: string | number | null | undefined,
  absolute = false
): string {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value).trim();
  return String(absolute ? Math.abs(numeric) : numeric);
}

export function normalizeSportsOptionValue(
  value: string | null | undefined
): string {
  return (value || "").trim().toLowerCase();
}

// ---------------------------------------------------------------- create flow result
export type CreateFlowResult = Partial<CreateMarketRespV2> & {
  marketId?: string;
  slug?: string;
  createdCount?: number;
  failedCount?: number;
  failedMarkets?: MarketBatchFailedItemResp[];
};

// ---------------------------------------------------------------- deployed market 判定
/** 需要重新部署的状态 — 这些市场存在于后端但未成功上链，应视为"不存在" */
export const DEPLOYABLE_STATUSES = new Set([
  "DRAFT",
  "DEPLOYING",
  "DEPLOY_FAILED",
]);

/** 判断一个已存在的市场是否已成功部署（不需要重新部署） */
export function isDeployedMarket(market: { status?: string }): boolean {
  const s = (market.status || "").toUpperCase();
  return s !== "" && !DEPLOYABLE_STATUSES.has(s);
}
