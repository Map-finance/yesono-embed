/**
 * 市场结算结果(settlement-result)解析与展示工具。
 *
 * 后端 `/api/markets/{marketId}/settlement-result` 返回的 `data` 是 **YES 侧的赔付比例**(0~1):
 * - 1.00 → YES 完胜
 * - 0.75 → YES 赢一半
 * - 0.50 → 打平 / 退款(push)
 * - 0.25 → YES 输一半
 * - 0.00 → YES 完败(NO 完胜)
 *
 * 取值理论上只有这 5 个离散值,这里用中点边界归一,容忍后端浮点误差。
 */

export type SettlementState =
  | "yes_win"
  | "yes_half_win"
  | "push"
  | "yes_half_lose"
  | "no_win";

/** 将 YES 侧赔付比例归一到五态;null/NaN 返回 null(交由上层回退到旧逻辑) */
export function getSettlementState(
  value: number | null | undefined
): SettlementState | null {
  if (value === null || value === undefined) return null;
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  if (v >= 0.875) return "yes_win";
  if (v >= 0.625) return "yes_half_win";
  if (v >= 0.375) return "push";
  if (v >= 0.125) return "yes_half_lose";
  return "no_win";
}

export interface SettlementLabels {
  /** YES 侧 outcome 文案,如 "Yes" / "Up" / 自定义 */
  yes: string;
  /** NO 侧 outcome 文案,如 "No" / "Down" / 自定义 */
  no: string;
  /** "赢一半" */
  halfWin: string;
  /** "输一半" */
  halfLose: string;
  /** "平局(退款)" */
  push: string;
}

export interface SettlementDisplay {
  state: SettlementState;
  /** 已本地化的徽标文案 */
  label: string;
  /** 文字 / 图标主色 */
  accent: string;
  /** 徽标背景色(带透明度) */
  bg: string;
  /** 徽标边框色(带透明度) */
  border: string;
}

const PALETTE: Record<
  SettlementState,
  Pick<SettlementDisplay, "accent" | "bg" | "border">
> = {
  yes_win: {
    accent: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    border: "rgba(34,197,94,0.3)",
  },
  no_win: {
    accent: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.3)",
  },
  yes_half_win: {
    accent: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.3)",
  },
  yes_half_lose: {
    accent: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.3)",
  },
  push: {
    accent: "#6b7280",
    bg: "rgba(107,114,128,0.15)",
    border: "rgba(107,114,128,0.3)",
  },
};

/**
 * 由 settlement-result 数值生成可直接渲染的展示信息;
 * 数值不可用时返回 null,调用方应回退到旧的 outcomePrices 推断逻辑。
 */
export function getSettlementDisplay(
  value: number | null | undefined,
  labels: SettlementLabels
): SettlementDisplay | null {
  const state = getSettlementState(value);
  if (!state) return null;
  const palette = PALETTE[state];
  let label: string;
  switch (state) {
    case "yes_win":
      label = labels.yes;
      break;
    case "no_win":
      label = labels.no;
      break;
    case "yes_half_win":
      label = `${labels.yes} · ${labels.halfWin}`;
      break;
    case "yes_half_lose":
      label = `${labels.yes} · ${labels.halfLose}`;
      break;
    case "push":
      label = labels.push;
      break;
  }
  return { state, label, ...palette };
}
