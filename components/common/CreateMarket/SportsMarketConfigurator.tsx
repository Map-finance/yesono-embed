"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Check, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { CandidateMarketItemResp } from "@/lib/api";

export type HandicapSide = "home" | "away";

export interface MoneylineTeam {
  id: string;
  name: string;
}

export interface SportsMarketConfig {
  enabledTypes: {
    moneyline: boolean;
    totals: boolean;
    spreads: boolean;
  };
  moneylineTeams: MoneylineTeam[];
  totalsLines: string[];
  spreadsLines: string[];
  handicapSide: HandicapSide;
}

interface Props {
  gameTitle: string;
  gameDateISO: string | null;
  initialTeams: MoneylineTeam[];
  value: SportsMarketConfig | null;
  onChange: (v: SportsMarketConfig) => void;
  existingMarkets?: CandidateMarketItemResp[];
  loadingExistingMarkets?: boolean;
}

export function SportsMarketConfigurator({
  gameTitle,
  gameDateISO,
  initialTeams,
  value,
  onChange,
  existingMarkets = [],
  loadingExistingMarkets = false,
}: Props) {
  const { t } = useTranslation();
  const sc = t.market.create.sportsConfigurator;
  const marketTypeOptions: Array<{
    key: keyof SportsMarketConfig["enabledTypes"];
    label: string;
  }> = [
    { key: "moneyline", label: sc.moneyline },
    { key: "totals", label: sc.totals },
    { key: "spreads", label: sc.spreads },
  ];

  const isQuarterMultiple = (raw: string) => {
    const s = raw.trim();
    if (!s) return true; // 空值不报错，交给父级/下一步校验是否必填
    const n = Number(s);
    if (!Number.isFinite(n)) return false;
    // 允许 0.25 的倍数（含负数）
    const scaled = n * 4;
    return Number.isInteger(scaled) || Math.abs(scaled - Math.round(scaled)) < 1e-9;
  };

  const initialMoneylineTeams = (() => {
    const vTeams = value?.moneylineTeams;
    if (vTeams && vTeams.length > 0) return vTeams;
    if (initialTeams.length > 0) return [...initialTeams];
    return [];
  })();

  const [config, setConfig] = useState<SportsMarketConfig>(() => ({
    enabledTypes: {
      moneyline: true,
      totals: true,
      spreads: true,
    },
    // 默认只展示主队/客队，Draw 改为通过按钮手动添加
    moneylineTeams: initialMoneylineTeams,
    totalsLines: value?.totalsLines.length ? value.totalsLines : [""],
    spreadsLines: value?.spreadsLines.length ? value.spreadsLines : [""],
    handicapSide: value?.handicapSide ?? "home",
  }));

  // 已有市场折叠状态
  const [existingCollapsed, setExistingCollapsed] = useState(true);

  useEffect(() => {
    onChange(config);
  }, [config, onChange]);

  const displayDate = useMemo(() => {
    if (!gameDateISO) return sc.invalidDate;
    const d = new Date(gameDateISO);
    if (isNaN(d.getTime())) return sc.invalidDate;
    return d.toISOString().slice(0, 19).replace("T", " ");
  }, [gameDateISO, sc.invalidDate]);

  const totalsInvalidMap = useMemo(
    () => config.totalsLines.map((v) => !isQuarterMultiple(v)),
    [config.totalsLines]
  );
  const spreadsInvalidMap = useMemo(
    () => config.spreadsLines.map((v) => !isQuarterMultiple(v)),
    [config.spreadsLines]
  );

  const safeTotals = config.totalsLines.filter(
    (v) => v && !Number.isNaN(Number(v)) && isQuarterMultiple(v)
  );
  const safeSpreads = config.spreadsLines.filter(
    (v) => v && !Number.isNaN(Number(v)) && isQuarterMultiple(v)
  );

  const hasDraw = useMemo(
    () =>
      config.moneylineTeams.some(
        (team) => team.id === "DRAW" || team.name.toLowerCase() === "draw"
      ),
    [config.moneylineTeams]
  );

  const homeName = initialTeams[0]?.name || sc.home;
  const awayName = initialTeams[1]?.name || sc.away;

  const homeNameShort = homeName.length > 10 ? `${homeName.slice(0, 9)}…` : homeName;
  const awayNameShort = awayName.length > 10 ? `${awayName.slice(0, 9)}…` : awayName;

  const normalizeLineValue = (value: string | number | null | undefined, absolute = false) => {
    if (value == null || value === "") return "";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value).trim();
    return String(absolute ? Math.abs(numeric) : numeric);
  };

  const normalizeMoneylineOption = (value: string | null | undefined) =>
    (value || "").trim().toLowerCase();

  // DRAFT/DEPLOYING/DEPLOY_FAILED 状态的市场视为未部署，不标记为"已存在"
  const DEPLOYABLE_STATUSES = new Set(["DRAFT", "DEPLOYING", "DEPLOY_FAILED"]);
  const deployedExistingMarkets = useMemo(
    () => existingMarkets.filter((m) => {
      const s = (m.status || "").toUpperCase();
      return s !== "" && !DEPLOYABLE_STATUSES.has(s);
    }),
    [existingMarkets]
  );

  const existingMoneylineMarkets = useMemo(
    () => deployedExistingMarkets.filter((market) => market.type.toUpperCase() === "MONEYLINE"),
    [deployedExistingMarkets]
  );
  const existingTotalsMarkets = useMemo(
    () => deployedExistingMarkets.filter((market) => market.type.toUpperCase() === "TOTALS" && market.line != null),
    [deployedExistingMarkets]
  );
  const existingSpreadsMarkets = useMemo(
    () => deployedExistingMarkets.filter((market) => market.type.toUpperCase() === "SPREADS" && market.line != null),
    [deployedExistingMarkets]
  );

  const existingMoneylineOptions = useMemo(
    () => new Set(existingMoneylineMarkets.map((market) => normalizeMoneylineOption(market.option))),
    [existingMoneylineMarkets]
  );
  const existingTotalsSet = useMemo(
    () => new Set(existingTotalsMarkets.map((market) => normalizeLineValue(market.line))),
    [existingTotalsMarkets]
  );
  const existingSpreadsSet = useMemo(
    () => new Set(existingSpreadsMarkets.map((market) => normalizeLineValue(market.line, true))),
    [existingSpreadsMarkets]
  );

  const totalsDuplicateMap = useMemo(
    () => config.totalsLines.map((v) => {
      const normalized = normalizeLineValue(v);
      return !!normalized && existingTotalsSet.has(normalized);
    }),
    [config.totalsLines, existingTotalsSet]
  );
  const spreadsDuplicateMap = useMemo(
    () => config.spreadsLines.map((v) => {
      const normalized = normalizeLineValue(v, true);
      return !!normalized && existingSpreadsSet.has(normalized);
    }),
    [config.spreadsLines, existingSpreadsSet]
  );

  const previewMoneylineTeams = useMemo(
    () => config.moneylineTeams.filter((team) => !existingMoneylineOptions.has(normalizeMoneylineOption(team.name))),
    [config.moneylineTeams, existingMoneylineOptions]
  );
  const previewTotals = useMemo(
    () => safeTotals.filter((v) => !existingTotalsSet.has(normalizeLineValue(v))),
    [safeTotals, existingTotalsSet]
  );
  const previewSpreads = useMemo(
    () => safeSpreads.filter((v) => !existingSpreadsSet.has(normalizeLineValue(v, true))),
    [safeSpreads, existingSpreadsSet]
  );

  const hasExistingDraw = existingMoneylineOptions.has(normalizeMoneylineOption(sc.draw)) || existingMoneylineOptions.has("draw");

  useEffect(() => {
    if (existingMarkets.length === 0) return;
    setConfig((prev) => {
      const newMoneylineTeams = prev.moneylineTeams.filter((team) => {
        if (team.id === "DRAW" || team.name.toLowerCase() === "draw") {
          return !hasExistingDraw;
        }
        return !existingMoneylineOptions.has((team.name || "").trim().toLowerCase());
      });
      const newTotalsLines = prev.totalsLines.filter((line) => {
        const n = Number(line);
        return !Number.isFinite(n) || !existingTotalsSet.has(String(n));
      });
      const newSpreadsLines = prev.spreadsLines.filter((line) => {
        const n = Number(line);
        return !Number.isFinite(n) || !existingSpreadsSet.has(String(Math.abs(n)));
      });
      return {
        ...prev,
        moneylineTeams: newMoneylineTeams,
        totalsLines: newTotalsLines.length > 0 ? newTotalsLines : [""],
        spreadsLines: newSpreadsLines.length > 0 ? newSpreadsLines : [""],
      };
    });
  }, [existingMarkets, existingMoneylineOptions, existingTotalsSet, existingSpreadsSet, hasExistingDraw]);

  // 当 initialTeams 异步加载完成后，同步到 config.moneylineTeams（保留已有的 DRAW）
  useEffect(() => {
    if (initialTeams.length > 0) {
      setConfig((prev) => {
        const prevNonDraw = prev.moneylineTeams.filter(
          (t) => t.id !== "DRAW" && t.name.toLowerCase() !== "draw"
        );
        // 已有真实参与者则跳过（避免覆盖用户改动）
        if (prevNonDraw.length > 0) return prev;
        // 保留 DRAW（来自 recreate 回填）并合并真实参与者
        const hasPrevDraw = prev.moneylineTeams.some(
          (t) => t.id === "DRAW" || t.name.toLowerCase() === "draw"
        );
        // 过滤掉已存在的 moneyline 队伍，避免重复
        const teams: MoneylineTeam[] = initialTeams.filter(
          (team) => !existingMoneylineOptions.has(normalizeMoneylineOption(team.name))
        );
        if (hasPrevDraw && !hasExistingDraw) {
          teams.push({ id: "DRAW", name: sc.draw });
        }
        return { ...prev, moneylineTeams: teams };
      });
    }
  }, [initialTeams, sc.draw, existingMoneylineOptions, hasExistingDraw]);

  const handleToggleType = (key: keyof SportsMarketConfig["enabledTypes"]) => {
    setConfig((prev) => ({
      ...prev,
      enabledTypes: {
        ...prev.enabledTypes,
        [key]: !prev.enabledTypes[key],
      },
    }));
  };

  return (
    <div className="space-y-4">
      {/* Game & Date */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 space-y-3">
        <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            {sc.game}
          </label>
          <div className="h-10 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] flex items-center text-sm text-[var(--text-primary)] min-w-0">
            <span className="truncate" title={gameTitle || "-"}>{gameTitle || "-"}</span>
          </div>
        </div>

        <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[110px_1fr] items-center gap-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            {sc.date}
          </label>
          <div className="h-10 px-3 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] flex items-center justify-between text-sm text-[var(--text-primary)]">
            <span className="truncate">{displayDate}</span>
            <Calendar className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          </div>
        </div>

        {/* Market Type */}
        <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[110px_1fr] items-start gap-2">
          <label className="text-sm font-medium text-[var(--text-secondary)] pt-2">
            {sc.marketType}
          </label>
          <div className="flex gap-3 flex-wrap">
            {marketTypeOptions.map((opt) => {
              const checked = config.enabledTypes[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    handleToggleType(opt.key)
                  }
                  className={`px-3 py-1.5 rounded-md border text-xs flex items-center gap-2 ${
                    checked
                      ? "bg-[var(--bg-primary)] border-[var(--accent)] text-[var(--text-primary)]"
                      : "bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-secondary)]"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                      checked ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]"
                    }`}
                  >
                    {checked ? <Check className="w-3 h-3 text-black" /> : null}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Existing Markets (collapsible) */}
      {!loadingExistingMarkets && existingMarkets.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
          <button
            type="button"
            onClick={() => setExistingCollapsed((prev) => !prev)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {sc.existingMarkets}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-secondary)] font-medium">
                {existingMarkets.length}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${
                existingCollapsed ? "" : "rotate-180"
              }`}
            />
          </button>
          {!existingCollapsed && (
            <div className="px-3 pb-3 space-y-2 border-t border-[var(--border)]">
              {/* Existing Moneyline */}
              {existingMoneylineMarkets.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--text-tertiary)] pt-1">{sc.moneyline}</p>
                  <div className="flex flex-wrap gap-2">
                    {existingMoneylineMarkets.map((market, idx) => (
                      <div
                        key={`existing-moneyline-${idx}-${market.option}`}
                        className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-primary)] flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                      >
                        <span>{market.option || market.question}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[10px] text-[var(--text-secondary)]">
                          {sc.existingTag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Existing Totals */}
              {existingTotalsMarkets.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--text-tertiary)] pt-1">{sc.totals}</p>
                  {existingTotalsMarkets.map((market, idx) => (
                    <div key={`existing-total-${idx}-${market.line}`} className="flex items-center gap-2 opacity-80">
                      <div className="w-20 h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] text-sm shrink-0 flex items-center justify-center">
                        {normalizeLineValue(market.line)}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-1 text-[10px] min-w-0">
                        <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] flex items-center justify-center min-w-0">
                          <span className="truncate">{sc.overLine.replace("{line}", normalizeLineValue(market.line))}</span>
                        </div>
                        <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] flex items-center justify-center min-w-0">
                          <span className="truncate">{sc.underLine.replace("{line}", normalizeLineValue(market.line))}</span>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-secondary)] shrink-0">
                        {sc.existingTag}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Existing Spreads */}
              {existingSpreadsMarkets.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--text-tertiary)] pt-1">{sc.spreads}</p>
                  {existingSpreadsMarkets.map((market, idx) => {
                    const existingLine = normalizeLineValue(market.line, true);
                    const existingNumber = Number(existingLine || 0);
                    const fmt = (val: number) => val > 0 ? `+${val}` : String(val);
                    return (
                      <div key={`existing-spread-${idx}-${market.line}`} className="flex items-center gap-2 opacity-80">
                        <div className="w-20 h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] text-sm shrink-0 flex items-center justify-center">
                          {existingLine}
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-1 text-[10px] min-w-0">
                          <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] flex items-center justify-center min-w-0">
                            <span className="truncate">{`${homeNameShort} ${fmt(existingNumber)}`}</span>
                          </div>
                          <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] flex items-center justify-center min-w-0">
                            <span className="truncate">{`${awayNameShort} ${fmt(-existingNumber)}`}</span>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-secondary)] shrink-0">
                          {sc.existingTag}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {loadingExistingMarkets && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{sc.loadingExistingMarkets}</span>
        </div>
      )}

      {/* Moneyline */}
      {config.enabledTypes.moneyline && existingMoneylineMarkets.length < 3  && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {sc.moneyline}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.moneylineTeams
              .filter(
                (team) =>
                  !(team.id === "DRAW" || team.name.toLowerCase() === "draw")
              )
              .map((team, idx) => {
                const isExisting = existingMoneylineOptions.has(normalizeMoneylineOption(team.name));
                return (
                <div
                  key={team.id}
                  className="px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center gap-2 text-xs text-[var(--text-primary)]"
                >
                  <span>{team.name}</span>
                  {isExisting ? (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[10px] text-[var(--text-secondary)]">
                      {sc.existingTag}
                    </span>
                  ) : null}
                  {idx >= 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          moneylineTeams: prev.moneylineTeams.filter(
                            (t) => t.id !== team.id
                          ),
                        }))
                      }
                      className="text-[var(--text-secondary)] hover:text-red-500"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              );})}
            {!hasExistingDraw && (
            <button
              type="button"
              onClick={() =>
                setConfig((prev) => {
                  const exists = prev.moneylineTeams.some(
                    (team) =>
                      team.id === "DRAW" ||
                      team.name.toLowerCase() === "draw"
                  );
                  if (exists) {
                    return {
                      ...prev,
                      moneylineTeams: prev.moneylineTeams.filter(
                        (team) =>
                          !(
                            team.id === "DRAW" ||
                            team.name.toLowerCase() === "draw"
                          )
                      ),
                    };
                  }
                  return {
                    ...prev,
                    moneylineTeams: [
                      ...prev.moneylineTeams,
                      { id: "DRAW", name: sc.draw },
                    ],
                  };
                })
              }
              className={`px-3 py-1.5 rounded-full border flex items-center gap-2 text-xs ${
                hasDraw
                  ? "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  : "border-dashed border-[var(--border)] bg-transparent text-[var(--text-secondary)]"
              }`}
            >
              <span>{sc.draw}</span>
            </button>
            )}
          </div>
        </div>
      )}

      {/* Totals & Spreads 同一行，高度与对齐统一 */}
      {(config.enabledTypes.totals || config.enabledTypes.spreads) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Totals */}
          {config.enabledTypes.totals && (
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between min-h-9">
                <p className="text-sm font-medium text-[var(--text-primary)]">{sc.totals}</p>
                <span className="invisible w-0 h-0 md:w-auto md:h-auto" aria-hidden />
              </div>
              {config.totalsLines.map((line, idx) => {
                const invalid = (totalsInvalidMap[idx] || totalsDuplicateMap[idx]) && line.trim().length > 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={line}
                        onChange={(e) => {
                          const v = e.target.value;
                          setConfig((prev) => {
                            const next = [...prev.totalsLines];
                            next[idx] = v;
                            return { ...prev, totalsLines: next };
                          });
                        }}
                        placeholder="3.00"
                        aria-invalid={invalid}
                        style={{
                          borderColor: invalid ? "#ef4444" : "var(--border)",
                          boxShadow: invalid
                            ? "0 0 0 1px rgba(239,68,68,0.4)"
                            : undefined,
                          outline: "none",
                        }}
                        className="w-20 h-9 px-2 rounded-md border bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm shrink-0 focus:outline-none"
                      />
                      <div className="flex-1 grid grid-cols-2 gap-1 text-[10px] min-w-0">
                        <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center min-w-0">
                          <span className="truncate">{sc.overLine.replace("{line}", line || "-")}</span>
                        </div>
                        <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center min-w-0">
                          <span className="truncate">{sc.underLine.replace("{line}", line || "-")}</span>
                        </div>
                      </div>
                      {config.totalsLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((prev) => {
                              const next = prev.totalsLines.filter((_, i) => i !== idx);
                              return { ...prev, totalsLines: next.length ? next : [""] };
                            })
                          }
                          className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 shrink-0 self-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {invalid && (
                      <div className="text-[10px] text-red-500 pl-[88px]">
                        {totalsDuplicateMap[idx] ? sc.existingDuplicate : sc.mustBeQuarterMultiple}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, totalsLines: [...prev.totalsLines, ""] }))
                }
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {sc.addTotalLine}
              </button>
            </div>
          )}

          {/* Spreads */}
          {config.enabledTypes.spreads && (
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between min-h-9">
                <p className="text-sm font-medium text-[var(--text-primary)]">{sc.spreads}</p>
              </div>
              {config.spreadsLines.map((line, idx) => {
                const invalid = (spreadsInvalidMap[idx] || spreadsDuplicateMap[idx]) && line.trim().length > 0;
                const n = Number(line);
                const hasVal = line.trim() !== "" && Number.isFinite(n);
                const fmt = (val: number) => val > 0 ? `+${val}` : String(val);
                const homeLabel = hasVal
                  ? `${homeNameShort} ${fmt(n)}`
                  : `${homeNameShort} -`;
                const awayLabel = hasVal
                  ? `${awayNameShort} ${fmt(-n)}`
                  : `${awayNameShort} -`;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        value={line}
                        onChange={(e) => {
                          const nv = e.target.value;
                          setConfig((prev) => {
                            const next = [...prev.spreadsLines];
                            next[idx] = nv;
                            return { ...prev, spreadsLines: next };
                          });
                        }}
                        placeholder="1.00"
                        aria-invalid={invalid}
                        style={{
                          borderColor: invalid ? "#ef4444" : "var(--border)",
                          boxShadow: invalid
                            ? "0 0 0 1px rgba(239,68,68,0.4)"
                            : undefined,
                          outline: "none",
                        }}
                        className="w-20 h-9 px-2 rounded-md border bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm shrink-0 focus:outline-none"
                      />
                      <div className="flex-1 grid grid-cols-2 gap-1 text-[10px] min-w-0">
                        <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center min-w-0">
                          <span className="truncate">{homeLabel}</span>
                        </div>
                        <div className="h-9 px-2 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center min-w-0">
                          <span className="truncate">{awayLabel}</span>
                        </div>
                      </div>
                      {config.spreadsLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((prev) => {
                              const next = prev.spreadsLines.filter((_, i) => i !== idx);
                              return { ...prev, spreadsLines: next.length ? next : [""] };
                            })
                          }
                          className="p-1.5 text-[var(--text-secondary)] hover:text-red-500 shrink-0 self-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {invalid && (
                      <div className="text-[10px] text-red-500 pl-[88px]">
                         {spreadsDuplicateMap[idx] ? sc.existingDuplicate : sc.mustBeQuarterMultiple}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    spreadsLines: [...prev.spreadsLines, ""],
                  }))
                }
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {sc.addSpreadLine}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Markets Preview */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{sc.marketsPreview}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Moneyline */}
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
            <p className="text-sm font-medium mb-2">{sc.moneyline}</p>
            <div className="space-y-1 text-xs">
              {previewMoneylineTeams.length ? previewMoneylineTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between text-[var(--text-secondary)]"
                >
                  <span className="mr-2">{team.name}</span>
                  <div className="flex gap-2 text-[var(--text-primary)]">
                    <span className="px-2 py-0.5 rounded border border-[var(--border)]">
                      {t.market.common.yes}
                    </span>
                    <span className="px-2 py-0.5 rounded border border-[var(--border)]">
                      {t.market.common.no}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-[var(--text-secondary)]">{sc.noNewMarketsToCreate}</div>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
            <p className="text-sm font-medium mb-2">{sc.totals}</p>
            <div className="space-y-1 text-xs text-[var(--text-secondary)]">
              {previewTotals.length ? (
                previewTotals.map((v, idx) => (
                  <div key={idx}>
                    <div>{sc.overLine.replace("{line}", v)}</div>
                    <div>{sc.underLine.replace("{line}", v)}</div>
                  </div>
                ))
              ) : (
                <div>{sc.noNewMarketsToCreate}</div>
              )}
            </div>
          </div>

          {/* Spreads */}
          <div className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-3">
            <p className="text-sm font-medium mb-2">{sc.spreads}</p>
            <div className="space-y-1 text-xs text-[var(--text-secondary)]">
              {previewSpreads.length ? (
                previewSpreads.map((v, idx) => {
                  const home = homeNameShort;
                  const away = awayNameShort;
                  const n = Number(v);
                  const fmt = (val: number) => val > 0 ? `+${val}` : String(val);
                  const homeLabel = `${home} ${fmt(n)}`;
                  const awayLabel = `${away} ${fmt(-n)}`;
                  return (
                    <div key={idx}>
                      {homeLabel} | {awayLabel}
                    </div>
                  );
                })
              ) : (
                <div>{sc.noNewMarketsToCreate}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

