"use client";

/**
 * OrderCard - 单个订单卡片（含展开后的明细行表格）。
 * 从 OrderBookTab.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/components/hooks/useI18n";
import type { OrderBookType, OrderDetailType } from "../types";
import { getPnlColor } from "./OrderBookTab.helpers";
import OrderDetailRow from "./OrderDetailRow";

interface OrderCardProps {
  record: OrderBookType;
  isExpanded: boolean;
  onToggleExpand: (key: string) => void;
  /** 父组件维护的 claiming 状态（按 key 索引）—— 用于显示 "已领取" 标记。 */
  claimingStatus: { [key: string]: string };
  /** 跳转到详情前持久化展开状态，让用户返回时自动恢复。 */
  onSaveExpandedSnapshot: () => void;
}

/**
 * 获取赛事状态样式（保留与原文件一致——所有分支均返回 var(--border)，无差异）。
 */
const getStatusStyle = (_status: string) => ({ border: "var(--border)" });

const OrderCard: React.FC<OrderCardProps> = ({
  record,
  isExpanded,
  onToggleExpand,
  claimingStatus,
  onSaveExpandedSnapshot,
}) => {
  const { t } = useI18n();

  const ss = getStatusStyle(record.status);
  const children = Array.isArray(record.children)
    ? (record.children as any[])
    : [];
  const hasChildren = children.length > 0;
  // 所有子订单均已领取(2)→ 聚合显示已领取
  const allClaimed = hasChildren && children.every((c) => c.claimStatus === 2);
  const isClaimed = claimingStatus[record.key] === t("claimSuccess");

  const renderDetailRow = (detail: OrderDetailType) => (
    <OrderDetailRow
      key={detail.key}
      detail={detail}
      onSaveExpandedSnapshot={onSaveExpandedSnapshot}
    />
  );


  return (
    <div
      key={record.key}
      id={`order-card-${record.key}`}
      className="rounded-xl mb-3 overflow-hidden transition-shadow"
      style={{
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${ss.border}`,
        background: "var(--bg-card)",
        boxShadow: isExpanded ? "0 4px 16px 0 rgba(0,0,0,0.10)" : "none",
      }}
    >
      {/* ── 卡片头部 ── */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-3 py-3 cursor-pointer select-none"
        onClick={() => {
          if (!hasChildren) return;
          onToggleExpand(record.key);
        }}
      >
        {/* 展开图标 */}
        <span
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
          style={{
            color: "var(--text-secondary)",
            opacity: hasChildren ? 1 : 0.25,
          }}
        >
          {isExpanded ? (
            <ChevronUp style={{ fontSize: 11 }} />
          ) : (
            <ChevronDown style={{ fontSize: 11 }} />
          )}
        </span>

        {/* ── 左侧：联赛 + 比赛名 + 时间（弹性填充） ── */}
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[12px] px-2 py-0.5 rounded whitespace-nowrap font-medium flex-shrink-0"
              style={{
                background: "var(--muted)",
                color: "var(--text-secondary)",
              }}
            >
              {record.league}
            </span>
            <span
              className="text-[15px] font-semibold truncate flex items-center gap-1"
              style={{ color: "var(--text-primary)" }}
            >
              {(() => {
                const parts = record.match.split(" vs ");
                if (parts.length === 2) {
                  return (
                    <>
                      <span>{parts[0]}</span>
                      <span
                        className="text-[12px] font-normal px-1"
                        style={{
                          color: "var(--text-secondary)",
                          opacity: 0.6,
                        }}
                      >
                        vs
                      </span>
                      <span>{parts[1]}</span>
                    </>
                  );
                }
                return record.match;
              })()}
            </span>
          </div>
          {/* 资金池 & 占比 */}
          {((record.option1Turnover && record.option1Turnover !== "0") ||
            (record.option2Turnover && record.option2Turnover !== "0")) &&
            (() => {
              const parts = record.match.split(" vs ");
              const home = parts[0]?.trim() || "A";
              const away = parts[1]?.trim() || "B";
              const pool1 = parseFloat(record.option1Turnover || "0");
              const pool2 = parseFloat(record.option2Turnover || "0");
              const ratio = parseFloat(record.ownSideStakeRatio || "0");
              return (
                <div
                  className="mt-0.5 text-[11px] font-number"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {home} ${pool1.toLocaleString()} : {away} ${pool2.toLocaleString()}
                  {ratio > 0 && (
                    <>
                      {" "}
                      · {t("myShare") || "我的占比"}{" "}
                      <span style={{ color: "var(--accent)" }}>
                        {ratio >= 1
                          ? `${(ratio * 100).toFixed(0)}%`
                          : `${(ratio * 100).toFixed(1)}%`}
                      </span>
                    </>
                  )}
                </div>
              );
            })()}
          <div className="mt-1">
            <span
              className="text-[12px] font-number"
              style={{ color: "var(--text-secondary)" }}
            >
              {record.matchTime}
            </span>
          </div>
        </div>
        {/* 右侧信息区域：桌面端横向，移动端整块换到第二行右侧 */}
        <div className="flex flex-row items-center gap-2 sm:gap-4 sm:ml-2 mt-2 sm:mt-0 sm:flex-shrink-0 sm:w-auto justify-between sm:justify-end">
          {/* 下注金额：桌面显示 */}
          <div className="flex-shrink-0 w-[72px] text-center hidden md:block">
            <div
              className="text-[12px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("betAmount")}
            </div>
            <div
              className="text-[15px] font-bold font-number tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {record.totalStakeAmount}
            </div>
          </div>
          {/* 比分：桌面显示 */}
          <div className="flex-shrink-0 w-[80px] text-center hidden sm:block">
            <div
              className="text-[12px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("matchResult")}
            </div>
            <div
              className="text-[16px] font-bold font-number tabular-nums"
              style={{
                color:
                  record.result === "- : -"
                    ? "var(--text-secondary)"
                    : "var(--accent)",
              }}
            >
              {record.result}
            </div>
          </div>
          {/* 状态：移动端只显示文字，桌面带标题 */}
          <div className="flex-shrink-0 flex flex-col items-end">
            <div
              className="text-[12px] mb-0.5 hidden sm:block"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("status")}
            </div>
            <span className="text-[13px] font-semibold whitespace-nowrap">
              {record.status}
            </span>
          </div>
          {/* 盈亏：桌面显示 */}
          <div className="flex-shrink-0 w-[126px] text-center hidden md:block">
            <div
              className="text-[12px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("profitLoss")}
            </div>
            <div
              className="text-[15px] font-bold font-number tabular-nums"
              style={{ color: getPnlColor(record.profitLoss) }}
            >
              {record.profitLoss === "-"
                ? "-"
                : record.profitLoss.startsWith("-")
                  ? record.profitLoss
                  : record.profitLoss === "0.00"
                    ? record.profitLoss
                    : `+${record.profitLoss}`}
            </div>
          </div>
          {/* 可领金额：桌面显示 */}
          <div className="flex-shrink-0 w-[128px] text-center hidden md:block">
            <div
              className="text-[12px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("claimableAmount")}
            </div>
            <div
              className="text-[15px] font-bold font-number tabular-nums"
              style={{
                color:
                  record.availableAmount === "-"
                    ? "var(--text-secondary)"
                    : "var(--green)",
              }}
            >
              {record.availableAmount}
            </div>
          </div>
          {/* 操作：移动端和桌面统一按钮位置 */}
          <div
            className="flex-shrink-0 w-[80px] flex justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {isClaimed || allClaimed ? (
              <span
                className="text-[12px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{
                  background: "rgba(0,200,83,0.12)",
                  color: "var(--green)",
                }}
              >
                ✓ {t("claimed")}
              </span>
            ) : (
              <span
                className="text-[14px]"
                style={{ color: "var(--text-secondary)", opacity: 0.35 }}
              >
                -
              </span>
            )}
          </div>
        </div>

        {/* ── 移动端补充字段行（sm 以下显示，比分 / 下注 / 盈亏 / 可领） ── */}
        <div className="sm:hidden grid grid-cols-2 gap-x-6 gap-y-2 pl-7 pb-3 w-full">
          {/* 赛事结果 */}
          <div>
            <div
              className="text-[11px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("matchResult")}
            </div>
            <div
              className="text-[15px] font-bold font-number tabular-nums"
              style={{
                color:
                  record.result === "- : -"
                    ? "var(--text-secondary)"
                    : "var(--accent)",
              }}
            >
              {record.result}
            </div>
          </div>
          {/* 下注金额 */}
          <div>
            <div
              className="text-[11px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("betAmount")}
            </div>
            <div
              className="text-[15px] font-bold font-number tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {record.totalStakeAmount}
            </div>
          </div>
          {/* 盈亏 */}
          <div>
            <div
              className="text-[11px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("profitLoss")}
            </div>
            <div
              className="text-[15px] font-bold font-number tabular-nums"
              style={{ color: getPnlColor(record.profitLoss) }}
            >
              {record.profitLoss === "-"
                ? "-"
                : record.profitLoss.startsWith("-")
                  ? record.profitLoss
                  : record.profitLoss === "0.00"
                    ? record.profitLoss
                    : `+${record.profitLoss}`}
            </div>
          </div>
          {/* 可领金额 */}
          <div>
            <div
              className="text-[11px] mb-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("claimableAmount")}
            </div>
            <div
              className="text-[15px] font-bold font-number tabular-nums"
              style={{
                color:
                  record.availableAmount === "-"
                    ? "var(--text-secondary)"
                    : "var(--green)",
              }}
            >
              {record.availableAmount}
            </div>
          </div>
        </div>
      </div>

      {/* ── 展开的投注明细 ── */}
      {isExpanded && hasChildren && (
        <div
          style={{
            borderTop: `1px solid var(--border)`,
            background: "var(--bg-secondary)",
          }}
        >
          {/* 明细表头 */}
          <div
            className="hidden lg:grid grid-cols-9 gap-x-4 px-4 py-2.5"
            style={{
              borderBottom: `1px solid var(--border)`,
              background: "var(--bg-card)",
            }}
          >
            {[
              t("handicapType"),
              t("betSelection"),
              t("betAmount"),
              t("profitLoss"),
              t("claimableAmount"),
              t("totalVolume") || "盘口总额",
              t("myShare") || "我的占比",
              t("transactionHash"),
              t("claimStatus"),
            ].map((h) => (
              <span
                key={h}
                className="text-[12px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {h}
              </span>
            ))}
          </div>
          {/* 明细行 */}
          {(record.children as OrderDetailType[]).map(renderDetailRow)}
        </div>
      )}
    </div>
  );
};

export default OrderCard;
