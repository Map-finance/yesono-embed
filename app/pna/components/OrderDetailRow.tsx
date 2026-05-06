"use client";

/**
 * OrderDetailRow - 单条订单明细行（OrderCard 展开后渲染）。
 * 从 OrderCard.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { useI18n } from "@/components/hooks/useI18n";
import { useToast } from "@/components/ui/Toast";
import { formatHandicap } from "@/utils/handicap";
import type { OrderDetailType } from "../types";
import { getPnlColor } from "./OrderBookTab.helpers";

interface OrderDetailRowProps {
  detail: OrderDetailType;
  /** 跳转到详情前持久化展开状态，让用户返回时自动恢复。 */
  onSaveExpandedSnapshot: () => void;
}

const useClaimStatusLabel = () => {
  const { t } = useI18n();
  return (code: number) => {
    switch (code) {
      case 0:
        return { label: "-" };
      case 1:
        return { label: t("notClaimed") };
      case 2:
        return { label: t("claimed") };
      case 3:
        return { label: t("claimableAmountZero") };
      default:
        return { label: t("unknownStatus") };
    }
  };
};

const OrderDetailRow: React.FC<OrderDetailRowProps> = ({
  detail,
  onSaveExpandedSnapshot,
}) => {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const getClaimStatusLabel = useClaimStatusLabel();

  const cs = getClaimStatusLabel(detail.claimStatus);
  const isHomeTeam = detail.code === "1";
  const marketLine = Number(detail?.handicap);

  let lineDisplay = "-";
  if (detail.mechanism === "overUnder") {
    const formatted = formatHandicap(marketLine, false);
    lineDisplay = isHomeTeam
      ? `${t("over")}${formatted}`
      : `${t("under")}${formatted}`;
  } else if (detail.handicap !== "-") {
    const displayValue = isHomeTeam ? marketLine : -marketLine;
    lineDisplay = formatHandicap(displayValue, true);
  }

  // 投注选择：统一背景色（不区分主/客/平）
  const selBg = "";
  const selColor = "var(--text-primary)";

  const selLabel =
    detail.mechanism === "overUnder"
      ? lineDisplay
      : `${detail.homeTeamPool} ${lineDisplay}`;

  return (
    <div
      key={detail.key}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-x-4 gap-y-3 px-4 py-4 border-b border-dashed last:border-0"
      style={{ borderColor: "var(--border)" }}
    >
      {/* 盘口类型 + 详情 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("handicapType")}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-[14px]"
            style={{ color: "var(--text-primary)" }}
          >
            {detail.mechanism === "overUnder" ? t("overUnder") : t("handicap")}
          </span>
          {detail.marketId && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                background: "var(--accent)",
                color: "var(--text-inverse)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                const anchorId = detail.anchorId || detail.marketId;
                // 保存当前展开状态，返回时自动恢复
                onSaveExpandedSnapshot();
                router.push(
                  `/sports/football/asian/detail?eventId=${anchorId}&type=market&catalog=football&marketId=${detail.marketId}&from=orders`
                );
              }}
            >
              {t("detail") || "详情"}
            </span>
          )}
        </div>
      </div>
      {/* 投注选择 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("betSelection")}
        </span>
        <span
          className="text-[12px] font-medium "
          style={{ background: selBg, color: selColor }}
        >
          {selLabel}
        </span>
      </div>
      {/* 下注金额 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("betAmount")}
        </span>
        <span
          className="text-[14px] font-number"
          style={{ color: "var(--text-primary)" }}
        >
          {detail.betAmount}
        </span>
      </div>
      {/* 盈亏 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("profitLoss")}
        </span>
        <span
          className="text-[14px] font-number font-semibold"
          style={{ color: getPnlColor(detail.profitLoss) }}
        >
          {detail.profitLoss}
        </span>
      </div>
      {/* 可领金额 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("claimableAmount")}
        </span>
        <span
          className="text-[14px] font-number"
          style={{ color: "var(--text-primary)" }}
        >
          {detail.availableAmount}
        </span>
      </div>
      {/* 盘口总金额 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("totalVolume") || "盘口总额"}
        </span>
        <span
          className="text-[14px] font-number"
          style={{ color: "var(--text-primary)" }}
        >
          {detail.option1Turnover && detail.option2Turnover
            ? `$${(parseFloat(detail.option1Turnover) + parseFloat(detail.option2Turnover)).toLocaleString()}`
            : "-"}
        </span>
      </div>
      {/* 我的占比 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("myShare") || "我的占比"}
        </span>
        <span
          className="text-[14px] font-number"
          style={{
            color:
              parseFloat(detail.ownSideStakeRatio || "0") > 0
                ? "var(--accent)"
                : "var(--text-secondary)",
          }}
        >
          {(() => {
            const r = parseFloat(detail.ownSideStakeRatio || "0");
            if (r <= 0) return "-";
            return r >= 1
              ? `${(r * 100).toFixed(0)}%`
              : `${(r * 100).toFixed(1)}%`;
          })()}
        </span>
      </div>
      {/* 交易哈希 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("transactionHash")}
        </span>
        <div className="flex items-center gap-1">
          <span
            className="text-[12px] font-mono"
            style={{ color: "var(--info)" }}
            title={detail.transactionHash}
          >
            {detail.transactionHash
              ? `${detail.transactionHash.slice(0, 8)}…${detail.transactionHash.slice(-6)}`
              : t("none")}
          </span>
          {detail.transactionHash && (
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-primary"
              onClick={() => {
                navigator.clipboard
                  .writeText(detail.transactionHash)
                  .then(() => toast.success(t("transactionIdCopied")))
                  .catch(() => toast.error(t("copyFailed")));
              }}
              aria-label={t("transactionIdCopied")}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* 领取状态 */}
      <div className="flex flex-col gap-1">
        <span
          className="text-[12px] lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("claimStatus")}
        </span>
        <span className="text-[12px] font-medium inline-flex items-center px-2 py-0.5 rounded w-fit">
          {cs.label}
        </span>
      </div>
    </div>
  );
};

export default OrderDetailRow;
