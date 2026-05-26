"use client";
import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Crown,
} from "lucide-react";

import { useRouter } from "next/navigation";
import { Popover } from "@/components/ui/Popover";
import { useTranslation } from "@/lib/i18n";
import useLeaderboard, { type LeaderboardUser } from "./useLeaderboard";
import useMyOverview from "./useMyOverview";
import { UserProfile } from "@/components/common/UserProfile";
import Avatar from "@/components/common/Avatar";
import { useAuthStore } from "@/lib/stores/authStore";

const MEDAL_STYLES: Record<
  number,
  { ring: string; label: string; chip: string }
> = {
  1: {
    ring: "ring-[3px] ring-[#E1A610]",
    label: "text-[#E1A610]",
    chip: "bg-[#E1A610] text-black",
  },
  2: {
    ring: "ring-[3px] ring-[#94a3b8]",
    label: "text-[#94a3b8]",
    chip: "bg-[#94a3b8] text-black",
  },
  3: {
    ring: "ring-[3px] ring-[#bd7f6f]",
    label: "text-[#bd7f6f]",
    chip: "bg-[#bd7f6f] text-black",
  },
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

const formatSigned = (n: number) =>
  new Intl.NumberFormat("en-US", {
    signDisplay: "always",
    maximumFractionDigits: 0,
  }).format(n);

const PodiumCard: React.FC<{
  user: LeaderboardUser;
  rank: 1 | 2 | 3;
  onClick: () => void;
}> = ({ user, rank, onClick }) => {
  const style = MEDAL_STYLES[rank];
  const heightClass =
    rank === 1 ? "md:pt-2 md:pb-7" : "md:pt-4 md:pb-5";
  const orderClass =
    rank === 1 ? "md:order-2" : rank === 2 ? "md:order-1" : "md:order-3";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-2 rounded-2xl border border-(--border) bg-[var(--bg-card)] px-4 py-5 transition-all hover:border-(--accent)/40 hover:bg-(--bg-hover) ${heightClass} ${orderClass}`}
    >
      {rank === 1 && (
        <Crown
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[#E1A610]"
          fill="#E1A610"
          size={22}
        />
      )}
      <div className="relative">
        <div className={`rounded-full ${style.ring}`}>
          <Avatar
            src={user.avatarUrl}
            name={user.name}
            className="!size-14"
          />
        </div>
        <span
          className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${style.chip}`}
        >
          {rank}
        </span>
      </div>
      <div className="mt-1 max-w-full truncate text-sm font-bold text-(--text-primary) group-hover:underline">
        {user.name}
      </div>
      <div className="text-xs font-semibold text-(--text-secondary)">
        <span
          className={
            user.profitLoss >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
          }
        >
          ${formatSigned(user.profitLoss)}
        </span>
      </div>
    </button>
  );
};

const Leaderboard: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // 排序指标(列)放在 hook 之前:hook 按它选对应 endpoint(盈亏/交易量),服务端排序+分页
  const [selectColumnIndex, setSelectColumnIndex] = useState(0);
  const columns = [
    { label: t.leaderboard.table.profitLoss, value: "profitLoss" },
    { label: t.leaderboard.table.volume, value: "volume" },
  ] as const;
  const metric = columns[selectColumnIndex].value;

  const {
    data: paginatedData,
    page,
    totalPages,
    isLoading,
    setPage,
    setTimeRange,
    setSearch,
    timeRange,
    search,
  } = useLeaderboard("Monthly", metric, isAuthenticated);

  const { data: myOverview } = useMyOverview(isAuthenticated, timeRange, metric);

  const timeRanges = [
    { key: "Today", label: t.leaderboard.timeRange.today },
    { key: "Weekly", label: t.leaderboard.timeRange.weekly },
    { key: "Monthly", label: t.leaderboard.timeRange.monthly },
    { key: "All", label: t.leaderboard.timeRange.all },
  ];
  const [mounted, setMounted] = useState(false);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 服务端已按当前指标(盈亏/交易量)排序+分页,前端不再二次排序;
  // 列表序号仍按展示顺序生成((page-1)*size+index+1 = 全局排名)。
  const sortedData = paginatedData;

  // 前排三甲按「当前展示顺序」取前 3（不再按后端 rank 过滤）：切到交易量排序后
  // 三甲与榜单口径一致；否则会把盈亏前三塞进交易量榜的前排，序号/人选都错乱。
  const podium = useMemo(
    () => (page === 1 && !search ? sortedData.slice(0, 3) : []),
    [sortedData, page, search],
  );

  const restRows = useMemo(
    () =>
      podium.length > 0
        ? sortedData.filter((u) => !podium.some((p) => p.userId === u.userId))
        : sortedData,
    [sortedData, podium],
  );

  // 当前用户序号:后端按当前指标返回(盈亏走 my-overview、交易量走 my-volume-overview),
  // 两个指标下都准确,直接用。
  const myRank = myOverview?.rank ?? null;

  const generatePageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("...");
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = generatePageNumbers();

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToUser = (user: { userId?: string; name: string }) =>
    router.push(
      `/pna?userId=${encodeURIComponent(String(user.userId || user.name))}`,
    );

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-(--text-tertiary)">{t.leaderboard.loading}</div>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl p-4 space-y-4 ${myOverview ? "pb-24" : ""}`}>
      {/* 标题 */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-(--accent)/10">
          <Trophy className="size-5 text-(--accent)" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-(--text-primary)">
            {t.leaderboard.title}
          </h1>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--border) bg-[var(--bg-card)] p-2">
        {/* 时间筛选 - desktop */}
        <div className="hidden gap-1 md:flex">
          {timeRanges.map((tr) => (
            <button
              key={tr.key}
              onClick={() => setTimeRange(tr.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                timeRange === tr.key
                  ? "bg-(--accent) text-(--text-inverse)"
                  : "text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>

        {/* 时间筛选 - mobile */}
        <Popover
          content={({ close }) => (
            <div className="flex min-w-[120px] flex-col">
              {timeRanges.map((tr) => (
                <button
                  key={tr.key}
                  className="rounded px-2 py-2 text-left transition-colors hover:bg-(--bg-hover)"
                  onClick={() => {
                    setTimeRange(tr.key);
                    close();
                  }}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          )}
        >
          {({ isOpen }) => (
            <button className="flex items-center gap-1 rounded-xl border border-(--border) px-3 py-2 text-sm font-semibold md:hidden">
              <span>{timeRanges.find((tr) => tr.key === timeRange)?.label}</span>
              <ChevronDown
                className={`ml-1 size-4 text-(--text-tertiary) transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </Popover>

        {/* 搜索 */}
        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--text-tertiary)" />
          <input
            type="text"
            placeholder={t.leaderboard.table.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-(--border) bg-transparent py-2 pl-9 pr-3 text-sm text-(--text-primary) outline-none transition-colors placeholder:text-(--text-tertiary) focus:border-(--accent)/50"
          />
        </div>
      </div>

      {/* 颁奖台 - 仅第一页且未搜索 */}
      {podium.length === 3 && (
        <div className="grid grid-cols-3 items-end gap-3">
          {podium.map((user, idx) => (
            <PodiumCard
              key={user.userId || user.name}
              user={user}
              rank={(idx + 1) as 1 | 2 | 3}
              onClick={() => goToUser(user)}
            />
          ))}
        </div>
      )}

      {/* 表格卡片 */}
      <div className="overflow-hidden rounded-2xl border border-(--border) bg-[var(--bg-card)]">
        {/* 列头 */}
        <div className="flex items-center justify-between border-b border-(--border) px-4 py-3 text-xs font-bold uppercase tracking-wider text-(--text-tertiary)">
          <div className="flex items-center gap-3">
            <span className="w-8 text-center">#</span>
            <span>{t.leaderboard.table.searchPlaceholder.replace(/\?$/, "")}</span>
          </div>
          <div className="flex items-center gap-6">
            {/* mobile column toggle */}
            <Popover
              content={({ close }) => (
                <div className="flex min-w-[140px] flex-col">
                  {columns.map((col, index) => (
                    <button
                      className="rounded px-2 py-2 text-left transition-colors hover:bg-(--bg-hover)"
                      key={col.value}
                      onClick={() => {
                        close();
                        setSelectColumnIndex(index);
                      }}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              )}
            >
              {({ isOpen }) => (
                <button className="flex items-center gap-1.5 md:hidden">
                  <span>{columns[selectColumnIndex].label}</span>
                  <ChevronDown
                    className={`size-3.5 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
            </Popover>

            {/* desktop columns */}
            <button
              onClick={() => setSelectColumnIndex(0)}
              className={`hidden transition-colors md:block ${
                selectColumnIndex === 0
                  ? "text-(--text-primary)"
                  : "hover:text-(--text-secondary)"
              }`}
            >
              {t.leaderboard.table.profitLoss}
            </button>
            <button
              onClick={() => setSelectColumnIndex(1)}
              className={`hidden min-w-[100px] text-right transition-colors md:block ${
                selectColumnIndex === 1
                  ? "text-(--text-primary)"
                  : "hover:text-(--text-secondary)"
              }`}
            >
              {t.leaderboard.table.volume}
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="divide-y divide-(--border)">
          {isLoading && sortedData.length === 0 && (
            <div className="space-y-3 px-4 py-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 animate-pulse"
                >
                  <div className="size-8 rounded-full bg-(--bg-hover)" />
                  <div className="size-10 rounded-full bg-(--bg-hover)" />
                  <div className="h-4 flex-1 rounded bg-(--bg-hover)" />
                  <div className="h-4 w-20 rounded bg-(--bg-hover)" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && sortedData.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-(--text-tertiary)">
              {t.leaderboard.noData}
            </div>
          )}
          {restRows.map((user: LeaderboardUser, index: number) => {
            // 序号按「当前展示顺序」拍：page 偏移 + 三甲占位 + 当前下标。
            // 不用接口 rank —— 它按盈亏排，切到交易量排序后会与展示顺序错乱。
            const actualRank =
              (page - 1) * ITEMS_PER_PAGE + podium.length + index + 1;
            const medal = MEDAL_STYLES[actualRank];

            return (
              <div
                key={`${user.rank}-${user.userId || user.name}-${index}`}
                onClick={() => goToUser(user)}
                className="group flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-(--bg-hover)"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`w-8 text-center text-sm font-bold ${
                      medal ? medal.label : "text-(--text-tertiary)"
                    }`}
                  >
                    {actualRank}
                  </span>
                  <UserProfile
                    userId={user.userId || user.name}
                    displayName={user.name}
                  >
                    <div
                      className={`shrink-0 rounded-full ${medal?.ring ?? ""}`}
                    >
                      <Avatar
                        src={user.avatarUrl}
                        name={user.name}
                        className="!size-10"
                      />
                    </div>
                  </UserProfile>
                  <UserProfile
                    userId={user.userId || user.name}
                    displayName={user.name}
                  >
                    <span className="truncate text-sm font-semibold text-(--text-primary) group-hover:underline">
                      {user.name}
                    </span>
                  </UserProfile>
                </div>
                <div className="flex shrink-0 items-center gap-6">
                  <div
                    className={`text-right text-sm font-semibold tabular-nums ${
                      selectColumnIndex === 0
                        ? "text-(--text-primary)"
                        : "text-(--text-tertiary) max-md:hidden"
                    }`}
                  >
                    ${formatCurrency(user.profitLoss)}
                  </div>
                  <div
                    className={`min-w-[100px] text-right text-sm font-semibold tabular-nums ${
                      selectColumnIndex === 1
                        ? "text-(--text-primary)"
                        : "text-(--text-tertiary) max-md:hidden"
                    }`}
                  >
                    ${formatCurrency(user.volume)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 border-t border-(--border) px-4 py-4">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="flex size-8 items-center justify-center rounded-lg text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="size-4" />
            </button>

            {pageNumbers.map((p, i) => (
              <React.Fragment key={i}>
                {typeof p === "number" ? (
                  <button
                    onClick={() => goToPage(p)}
                    className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                      page === p
                        ? "bg-(--accent) text-(--text-inverse)"
                        : "text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
                    }`}
                  >
                    {p}
                  </button>
                ) : (
                  <span className="flex size-8 items-center justify-center text-xs text-(--text-tertiary)">
                    …
                  </span>
                )}
              </React.Fragment>
            ))}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="flex size-8 items-center justify-center rounded-lg text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* 底部悬浮个人排名 */}
      {myOverview && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--border) bg-[var(--bg-secondary)]/95 backdrop-blur-md md:left-1/2 md:right-auto md:bottom-3 md:w-[min(72rem,calc(100%-2rem))] md:-translate-x-1/2 md:rounded-2xl md:border md:shadow-xl"
          onClick={() => router.push("/pna")}
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="group flex cursor-pointer items-center justify-between py-3 transition-colors hover:bg-(--bg-hover) md:rounded-2xl md:px-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-8 text-center text-sm font-bold text-(--accent)">
                  {/* 交易量排序下后端无对应口径排名，显示 — 而非误导性序号 */}
                  {myRank ?? "—"}
                </span>
                <Avatar
                  src={myOverview.avatarUrl}
                  name={myOverview.userName}
                  className="!size-10 shrink-0"
                />
                <span className="truncate text-sm font-semibold text-(--text-primary) group-hover:underline">
                  {myOverview.userName}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-6">
                <div className="text-right text-sm font-semibold tabular-nums text-(--text-primary)">
                  ${formatCurrency(myOverview.profitLoss)}
                </div>
                <div className="min-w-[100px] text-right text-sm font-semibold tabular-nums text-(--text-primary) max-md:hidden">
                  ${formatCurrency(myOverview.volume)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
