"use client";

import { useState } from "react";
import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import ProxyImage from "@/components/common/ProxyImage";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useEmbed } from "@/lib/embed/EmbedContext";
import useGetPositions, { type Position } from "@/app/pna/hooks/use-get-positions";
import useGetClosedPositions, {
  type ClosedPosition,
} from "@/app/pna/hooks/use-get-closed-positions";
import { fmtMoney, fmtPct } from "./formatters";
import { useToast } from "@/components/ui/Toast";
import { useTobOrderRedeem } from "@/lib/hooks/tob";
import { Loader2 } from "lucide-react";

interface PositionsTableProps {
  targetUserId?: string;
}

type SubTab = "active" | "closed";

export default function PositionsTable({ targetUserId }: PositionsTableProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SubTab>("active");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList variant="line">
          <TabsTrigger value="active">{t.pna.positionFilters.active}</TabsTrigger>
          <TabsTrigger value="closed">{t.pna.positionFilters.closed}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "active" ? (
        <ActivePositions targetUserId={targetUserId} />
      ) : (
        <ClosedPositions targetUserId={targetUserId} />
      )}
    </div>
  );
}

function ActivePositions({ targetUserId }: { targetUserId?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user: embedUser } = useEmbed();
  // 仅查看本人持仓时才显示「领取」：无 targetUserId（默认本人页）或与当前用户一致。
  // 查看他人持仓不应出现领取按钮（领取是本人操作）。
  const isOwnView =
    !targetUserId || targetUserId === embedUser?.profile?.userId;
  const { positions, isLoading, refresh } = useGetPositions({
    userId: targetUserId,
    limit: 100,
  });
  const redeem = useTobOrderRedeem();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (p: Position) => {
    const marketId = String(p.marketId ?? p.marketNumericId ?? "");
    if (!marketId) return;
    setClaimingId(p.id);
    try {
      const r = await redeem.mutate({
        betId: crypto.randomUUID(),
        marketId,
      });
      // 后端只要回了非空响应（含 betId / actionId / status）就算受理成功；
      // 状态为 action_pending 等中间态都视作 "已提交"，不再轮询。
      if (r && (r.betId || r.actionId)) {
        toast.success(t.pna.positions.claimSuccess);
        refresh();
      } else {
        toast.error(t.pna.positions.claimFailed);
      }
    } catch {
      toast.error(t.pna.positions.claimFailed);
    } finally {
      setClaimingId(null);
    }
  };

  const columns: DataTableColumn<Position>[] = [
    {
      key: "market",
      header: t.pna.positionHeaders.market,
      cell: (p) => {
        const profit = derivedProfit(p);
        return (
          <MarketCell
            icon={p.icon}
            title={p.question || p.market}
            eventSlug={p.eventSlug}
            subtitle={
              <>
                <OutcomeBadge label={p.outcome} tone={profit >= 0 ? "positive" : "negative"} />
                <span className="text-xs text-(--text-secondary) tabular-nums">
                  {p.shares.toLocaleString()} {t.pna.activity.shares} at {fmtMoney(p.avgPrice)}
                </span>
                {p.canClaim && isOwnView ? (
                  <button
                    type="button"
                    disabled={claimingId === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClaim(p);
                    }}
                    className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded text-[10px] font-medium bg-(--accent) text-black hover:opacity-90 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {claimingId === p.id ? (
                      <>
                        <Loader2 size={10} className="animate-spin" />
                        {t.pna.positions.claiming}
                      </>
                    ) : (
                      t.pna.positions.claim
                    )}
                  </button>
                ) : null}
              </>
            }
          />
        );
      },
    },
    {
      key: "avg",
      header: t.pna.positionHeaders.avg,
      align: "center",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.avgPrice)}</span>,
    },
    {
      key: "current",
      header: t.pna.positionHeaders.current,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.currentPrice)}</span>,
    },
    {
      key: "value",
      header: t.pna.positionHeaders.value,
      align: "right",
      cell: (p) => {
        const value = derivedValue(p);
        const profit = derivedProfit(p);
        const pct = derivedProfitPct(p);
        return (
          <div className="flex flex-col items-end">
            <span className="tabular-nums">{fmtMoney(value)}</span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                profit >= 0 ? "text-emerald-500" : "text-red-500"
              )}
            >
              {profit >= 0 ? "+" : "-"}
              {fmtMoney(Math.abs(profit))} ({fmtPct(pct)})
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={positions}
      loading={isLoading}
      rowKey={(p) => p.id}
      empty={t.pna.noPositions}
      columns={columns}
    />
  );
}

// 后端 value/profit 字段不可靠（实际看到 0），用 shares × price 客户端推导，
// 与 h2-market 原始 PositionsTable 一致。
function derivedValue(p: Position): number {
  return (Number(p.shares) || 0) * (Number(p.currentPrice) || 0);
}
function derivedProfit(p: Position): number {
  const cost = (Number(p.shares) || 0) * (Number(p.avgPrice) || 0);
  return derivedValue(p) - cost;
}
function derivedProfitPct(p: Position): number {
  const cost = (Number(p.shares) || 0) * (Number(p.avgPrice) || 0);
  if (cost === 0) return 0;
  return (derivedProfit(p) / cost) * 100;
}

function ClosedPositions({ targetUserId }: { targetUserId?: string }) {
  const { t } = useTranslation();
  const { positions, isLoading } = useGetClosedPositions({ userId: targetUserId, limit: 100 });

  const columns: DataTableColumn<ClosedPosition>[] = [
    {
      key: "market",
      header: t.pna.positionHeaders.market,
      cell: (p) => {
        const won = p.result === "Won";
        return (
          <MarketCell
            icon={p.icon}
            title={p.question || p.market}
            eventSlug={p.eventSlug}
            subtitle={
              <>
                <OutcomeBadge label={p.outcome} tone={won ? "positive" : "negative"} />
                <span className="text-xs text-(--text-secondary)">
                  {won ? `🏆 ${t.pna.positions.won}` : `❌ ${t.pna.positions.lost}`}
                </span>
              </>
            }
          />
        );
      },
    },
    {
      key: "bet",
      header: t.pna.positionHeaders.bet,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.totalBet)}</span>,
    },
    {
      key: "value",
      header: t.pna.positionHeaders.value,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.amountWon)}</span>,
    },
    {
      key: "profit",
      header: t.pna.profitLossLabel,
      align: "right",
      cell: (p) => {
        const positive = p.profit >= 0;
        const sign = positive ? "+" : "-";
        return (
          <div
            className={cn(
              "flex flex-col items-end tabular-nums",
              positive ? "text-emerald-500" : "text-red-500"
            )}
          >
            <span className="font-medium">
              {sign}
              {fmtMoney(Math.abs(p.profit))}
            </span>
            <span className="text-[11px]">({fmtPct(p.profitPct)})</span>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={positions}
      loading={isLoading}
      rowKey={(p, i) => `${p.eventSlug ?? "p"}-${i}`}
      empty={t.pna.noPositions}
      columns={columns}
    />
  );
}

interface MarketCellProps {
  icon: string | null;
  title: string;
  eventSlug?: string | null;
  subtitle?: React.ReactNode;
}

function MarketCell({ icon, title, eventSlug, subtitle }: MarketCellProps) {
  const titleNode = eventSlug ? (
    <Link
      href={`/market/${eventSlug}`}
      className="truncate font-medium hover:underline"
      title={title}
    >
      {title}
    </Link>
  ) : (
    <span className="truncate font-medium" title={title}>
      {title}
    </span>
  );

  return (
    <div className="flex items-center gap-2 min-w-0">
      {icon ? (
        <ProxyImage src={icon} alt="" className="size-8 rounded shrink-0 object-cover" />
      ) : null}
      <div className="min-w-0 flex flex-col gap-1">
        {titleNode}
        {subtitle ? (
          <div className="flex items-center gap-2 flex-wrap">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Outcome 徽章 —— 默认按 outcome 文字语义着色（up/YES/over → 绿；down/NO/under → 红）。
 * 调用方传 tone 时优先用 tone（如活跃持仓里按 profit 正负着色，与 h2-market 对齐）。
 */
function OutcomeBadge({
  label,
  tone,
}: {
  label: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const finalTone = tone ?? outcomeTone(label);
  const cls =
    finalTone === "positive"
      ? "bg-emerald-500/15 text-emerald-500"
      : finalTone === "negative"
        ? "bg-red-500/15 text-red-500"
        : "bg-(--bg-secondary) text-(--text-secondary)";
  return (
    <span className={cn("py-0.5 px-2 rounded text-xs font-medium whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

const POSITIVE_TOKENS = new Set(["yes", "y", "up", "over", "won", "win", "more"]);
const NEGATIVE_TOKENS = new Set(["no", "n", "down", "under", "lost", "lose", "less"]);

function outcomeTone(label: string): "positive" | "negative" | "neutral" {
  const k = (label ?? "").trim().toLowerCase();
  if (POSITIVE_TOKENS.has(k)) return "positive";
  if (NEGATIVE_TOKENS.has(k)) return "negative";
  return "neutral";
}

export { MarketCell };
