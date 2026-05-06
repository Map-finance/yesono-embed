/**
 * 将 API 订单簿数据转换为 OrderBookTab 所需的 UI 结构。
 * 从 OrderBookTab.tsx 拆出。原本闭包依赖 useI18n 的 `t`，现以参数注入。
 */

import {
  ApiOrderBookRecord,
  OrderBookType,
  OrderDetailType,
} from "../types";
import {
  getMatchStateByCode,
  isMatchEnded,
  MatchMark,
  MatchState,
} from "@/types/match-state";
import { formatDynamicAmount } from "./OrderBookTab.helpers";

/** useI18n 返回的 t 的最小契约（避免硬依赖具体类型）。 */
type TFunc = (key: string, params?: Record<string, string>) => string;

export const transformApiOrderBookData = (
  apiData: ApiOrderBookRecord[],
  t: TFunc
): OrderBookType[] => {
  return apiData.map((item, index) => {
    // 格式化时间戳 - 统一处理时间戳格式
    const formatTimestamp = (timestamp: string | number) => {
      try {
        const timestampNum =
          typeof timestamp === "string" ? parseInt(timestamp) : timestamp;
        // 判断时间戳格式：如果小于等于10位数字，说明是秒级；否则是毫秒级
        const date =
          timestampNum.toString().length <= 10
            ? new Date(timestampNum * 1000) // 秒级转毫秒级
            : new Date(timestampNum); // 毫秒级直接使用

        return date.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        console.error("[OrderBookTab] Failed to format timestamp", e);
        return t("timeUnknown");
      }
    };

    // 根据 state 映射状态显示（优先使用 MatchState 枚举，与后端一致）
    const getMatchStatus = () => {
      const stateObj = getMatchStateByCode(item.state);
      if (stateObj) {
        if (stateObj.mark === MatchMark.END) {
          if (stateObj === MatchState.CANCELLED) return t("canceled");
          if (stateObj === MatchState.ABANDONED) return stateObj.label; // 腰斩
          return t("finished"); // FT 等
        }
        if (stateObj.mark === MatchMark.RUN) return t("inProgress");
        if (stateObj.mark === MatchMark.HOLD) return t("notStarted");
        if (stateObj.mark === MatchMark.DELAY) return stateObj.label; // 中断 / 推迟
      }
    };

    // 获取主队客队名称
    const getTeamNames = () => {
      if (!item.options || !Array.isArray(item.options)) {
        return {
          homeName: t("unknownHomeTeam"),
          awayName: t("unknownAwayTeam"),
        };
      }

      const homeTeam = item.options.find((option) => option.code === "1");
      const awayTeam = item.options.find((option) => option.code === "2");

      return {
        homeName: homeTeam?.name || t("unknownHomeTeam"),
        awayName: awayTeam?.name || t("unknownAwayTeam"),
      };
    };

    // 获取比赛结果，从 options 中的 outcomeValue 提取比分值（仅已结束赛事显示）
    const getMatchResult = (): string => {
      if (!isMatchEnded(item.state)) {
        return "- : -";
      }

      if (!item.options || !Array.isArray(item.options)) {
        return "- : -";
      }
      // 查找主队（code为"1"）和客队（code为"2"）的选项
      const homeTeam = item.options.find((option) => option.code === "1");
      const awayTeam = item.options.find((option) => option.code === "2");

      // 提取比分信息
      const homeScore = homeTeam?.outcomeValue || "-";
      const awayScore = awayTeam?.outcomeValue || "-";

      // 格式化为 "主队：客队" 格式
      return `${homeScore} : ${awayScore}`;
    };

    // 转换订单详情
    const transformOrderDetails = (): OrderDetailType[] => {
      if (!item.orderDetails || !Array.isArray(item.orderDetails)) {
        return [];
      }

      // 获取主队客队名称用于显示
      const { homeName, awayName } = getTeamNames();

      return item.orderDetails.map((detail, detailIndex) => {
        // 根据code确定投注的是主队还是客队
        const getSelectedTeam = () => {
          if (detail.code === "1") {
            return homeName; // 主队
          } else if (detail.code === "2") {
            return awayName; // 客队
          } else {
            return t("draw"); // 其他情况（如X代表平局）
          }
        };

        return {
          key: `order-${item.id}-${detail.txHash}-${detailIndex}`,
          handicap: detail.line || "-",
          homeTeamPool: getSelectedTeam(), // 显示具体的队伍名称
          awayTeamPool: "-", // 不再显示客队池，因为已经在 homeTeamPool 中显示了选择的队伍
          betAmount: `${(Number(detail.stakeAmount) || 0).toLocaleString()}`,
          // profitLoss: `${
          //   parseFloat(detail.claimableAmount) > 0 ? detail.profitLoss : "-"
          // }`,
          profitLoss: detail.profitLoss
            ? parseFloat(detail.profitLoss).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "-",
          availableAmount:
            parseFloat(detail.claimableAmount) > 0
              ? formatDynamicAmount(detail.claimableAmount)
              : "-",
          createTime: formatTimestamp(detail.createdAt),
          transactionHash: detail.txHash || detail.transactionHash,
          marketId: detail.marketId || "",
          mechanism: detail.mechanism || "",
          claimStatus: detail.claimStatus,
          code: detail.code,
          option1Turnover: detail.option1Turnover || "0",
          option2Turnover: detail.option2Turnover || "0",
          ownSideStakeRatio: detail.ownSideStakeRatio || "0",
          anchorId: detail.anchorId || "",
        };
      });
    };

    const { homeName, awayName } = getTeamNames();

    return {
      key: item.id,
      serialNumber: (index + 1).toString().padStart(2, "0"),
      league: item.name || t("unknownLeague"), // 使用 name 字段作为联赛名称
      match: `${homeName} vs ${awayName}`, // 使用主队客队名称组成比赛名称
      matchTime: formatTimestamp(item.eventTime), // 使用 eventTime 字段
      handicapType: t("handicap"), // 根据 orderDetails 中的 mechanism 判断
      status: getMatchStatus() ?? "", // 存已翻译的状态文字，渲染直接展示
      result: getMatchResult(),
      // profitLoss: `${
      //   parseFloat(item.totalClaimableAmount) > 0 ? item.totalProfitLoss : "-"
      // }`,
      profitLoss: item.totalProfitLoss
        ? parseFloat(item.totalProfitLoss).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "-",
      availableAmount:
        parseFloat(item.totalClaimableAmount) > 0
          ? formatDynamicAmount(item.totalClaimableAmount)
          : "-",
      totalStakeAmount: `${(Number(item.totalStakeAmount) || 0).toLocaleString()}`,
      isClaimable: item.isClaimable,
      operation:
        item.isClaimable && parseFloat(item.totalClaimableAmount) > 0
          ? t("claim")
          : "-",
      marketId: item.orderDetails?.[0]?.marketId || item.id, // 使用第一个订单详情的 marketId，或回退到 id
      eventId: item.orderDetails?.[0]?.eventId || "",
      anchorId: item.orderDetails?.[0]?.anchorId || "",
      option1Turnover: item.option1Turnover || "0",
      option2Turnover: item.option2Turnover || "0",
      ownSideStakeRatio: item.ownSideStakeRatio || "0",
      children: transformOrderDetails(),
    };
  });
};
