/**
 * 比赛阶段标记（与后端 MatchMark 对应）
 * - HOLD: 未开/暂停（未开、中场、待定）
 * - RUN: 进行中（上半场、下半场、加时、点球）
 * - END: 已结束（完场、取消、腰斩）
 * - DELAY: 延迟（中断、推迟）
 */
export const MatchMark = {
  HOLD: "HOLD",
  RUN: "RUN",
  END: "END",
  DELAY: "DELAY",
} as const;

export type MatchMarkType = (typeof MatchMark)[keyof typeof MatchMark];

/**
 * 比赛状态（与后端 MatchState 枚举对应）
 * code: 状态码（与后端一致）
 * label: 中文展示文案
 * mark: 阶段标记
 */
export const MatchState = {
  NS: { code: 0, label: "未开", mark: MatchMark.HOLD },
  INPLAY_1ST_HALF: { code: 1, label: "上半场", mark: MatchMark.RUN },
  HT: { code: 2, label: "中场", mark: MatchMark.HOLD },
  INPLAY_2ND_HALF: { code: 3, label: "下半场", mark: MatchMark.RUN },
  INPLAY_ET: { code: 4, label: "加时", mark: MatchMark.RUN },
  INPLAY_PENALTIES: { code: 5, label: "点球", mark: MatchMark.RUN },
  FT: { code: -1, label: "完场", mark: MatchMark.END },
  CANCELLED: { code: -10, label: "取消", mark: MatchMark.END },
  TBA: { code: -11, label: "待定", mark: MatchMark.HOLD },
  ABANDONED: { code: -12, label: "腰斩", mark: MatchMark.END },
  INTERRUPTED: { code: -13, label: "中断", mark: MatchMark.DELAY },
  DELAYED: { code: -14, label: "推迟", mark: MatchMark.DELAY },
} as const;

export type MatchStateKey = keyof typeof MatchState;

export type MatchStateItem = (typeof MatchState)[MatchStateKey];

/** 状态码 -> 状态项 */
const codeToState: Record<number, MatchStateItem> = Object.fromEntries(
  (Object.entries(MatchState) as [MatchStateKey, MatchStateItem][]).map(
    ([_, v]) => [v.code, v]
  )
);

/**
 * 根据状态码获取比赛状态（支持 number 或 string，如 API 返回 "1"）
 */
export function getMatchStateByCode(
  code: number | string
): MatchStateItem | undefined {
  const n = typeof code === "string" ? parseInt(code, 10) : code;
  if (Number.isNaN(n)) return undefined;
  return codeToState[n];
}

/**
 * 根据状态码获取中文标签（未知状态码返回空字符串或可传 fallback）
 */
export function getMatchStateLabel(
  code: number | string,
  fallback: string = ""
): string {
  return getMatchStateByCode(code)?.label ?? fallback;
}

/**
 * 是否为进行中（RUN）
 */
export function isMatchInPlay(code: number | string): boolean {
  const item = getMatchStateByCode(code);
  return item?.mark === MatchMark.RUN;
}

/**
 * 是否已结束（END）
 */
export function isMatchEnded(code: number | string): boolean {
  const item = getMatchStateByCode(code);
  return item?.mark === MatchMark.END;
}

/**
 * 是否为延迟/中断（DELAY）
 */
export function isMatchDelayed(code: number | string): boolean {
  const item = getMatchStateByCode(code);
  return item?.mark === MatchMark.DELAY;
}

/**
 * 是否为未开/暂停（HOLD，含未开、中场、待定）
 */
export function isMatchOnHold(code: number | string): boolean {
  const item = getMatchStateByCode(code);
  return item?.mark === MatchMark.HOLD;
}
