import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useTranslation } from "@/lib/i18n";
import { useTradingStore } from "@/lib/store/tradingStore";
import GameButton from "@/components/sports/Live/GameButton";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useCtfOperations } from "@/lib/hooks/useCtfOperations";
// yesono-embed 不引入 viem；inline 6-decimal helpers
function parseUnits(value: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = String(value).split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0");
}
function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : String(whole);
  return neg ? "-" + s : s;
}
import {
  getOutcomeLabel,
  normalizeBinaryOutcomeLabel,
} from "@/lib/utils/outcomes";
import { getUserCtfBalance } from "@/lib/api";
import { trackEvent } from "@/lib/sentryClient";
interface MergeSharesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
}

export default function MergeShares({
  open,
  onOpenChange,
  onSuccess,
}: MergeSharesProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { market } = useTradingStore();
  const { merge, isLoading, status } = useCtfOperations();

  const [amount, setAmount] = useState("");
  const [yesBalance, setYesBalance] = useState<bigint>(0n);
  const [noBalance, setNoBalance] = useState<bigint>(0n);
  const [isFetchingAvailable, setIsFetchingAvailable] = useState(false);

  const marketId = market?.id ? String(market.id) : "";
  const conditionId = market?.conditionId ? String(market.conditionId) : "";

  // 使用 getOutcomeLabel 获取统一的标签
  const [yesLabel, noLabel] = useMemo(() => {
    const raw = (market as any)?.marketOutcomes;
    const outcomes = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? (() => { try { return JSON.parse(raw); } catch { return []; } })()
        : [];
    const sideA = outcomes.find((item: any) => Number(item?.originalIndex) === 0) ?? outcomes[0];
    const sideB = outcomes.find((item: any) => Number(item?.originalIndex) === 1) ?? outcomes[1];

    return [
      normalizeBinaryOutcomeLabel(getOutcomeLabel(sideA), t.common.yes, {
        yes: t.common.yes,
        no: t.common.no,
        up: t.common.up,
        down: t.common.down,
      }),
      normalizeBinaryOutcomeLabel(getOutcomeLabel(sideB), t.common.no, {
        yes: t.common.yes,
        no: t.common.no,
        up: t.common.up,
        down: t.common.down,
      })
    ];
  }, [market, t.common.yes, t.common.no, t.common.up, t.common.down]);

  const clobTokenIds = useMemo(() => {
    /**
     * 中文注释（tokenId 来源优先级）：
     * 1) 优先使用 market.marketOutcomes，按 originalIndex 取两边 tokenId（0/1）
     * 2) 若 marketOutcomes 无法解析，再回退到旧字段 clobTokenIds（[0,1]）
     * 3) 最后返回空字符串，交由上层做参数缺失提示
     */
    try {
      const outcomesRaw = (market as any)?.marketOutcomes;
      const outcomes = Array.isArray(outcomesRaw)
        ? outcomesRaw
        : typeof outcomesRaw === "string"
          ? JSON.parse(outcomesRaw)
          : [];

      if (Array.isArray(outcomes) && outcomes.length > 0) {
        const sideA = outcomes.find((item: any) => Number(item?.originalIndex) === 0);
        const sideB = outcomes.find((item: any) => Number(item?.originalIndex) === 1);

        const yesTokenId = String(sideA?.tokenId ?? "");
        const noTokenId = String(sideB?.tokenId ?? "");

        if (yesTokenId && yesTokenId !== "undefined" && noTokenId && noTokenId !== "undefined") {
          return { yesTokenId, noTokenId };
        }
      }
    } catch {
      // 中文注释：marketOutcomes 解析失败时进入 clobTokenIds 回退逻辑
    }

    try {
      const raw = (market as any)?.clobTokenIds;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return { yesTokenId: String(parsed[0]), noTokenId: String(parsed[1]) };
      }
    } catch {
      // 中文注释：clobTokenIds 解析失败时，继续返回空值兜底
    }

    return { yesTokenId: "", noTokenId: "" };
  }, [market]);

  // 从 marketOutcomes 按 originalIndex 排序提取 name（如 'O'/'U'）
  const resolvedOutcomes = useMemo((): { outcomeA: string; outcomeB: string } => {
    try {
      const outcomesRaw = (market as any)?.marketOutcomes;
      const outcomes = Array.isArray(outcomesRaw)
        ? outcomesRaw
        : typeof outcomesRaw === 'string'
          ? JSON.parse(outcomesRaw)
          : [];
      if (Array.isArray(outcomes) && outcomes.length >= 2) {
        const sorted = [...outcomes].sort(
          (a: any, b: any) => Number(a?.originalIndex ?? 0) - Number(b?.originalIndex ?? 0)
        );
        const outcomeA = String(sorted[0]?.name ?? "").trim();
        const outcomeB = String(sorted[1]?.name ?? "").trim();
        return {
          outcomeA,
          outcomeB,
        };
      }
    } catch { /* 内容略 */ }
    return { outcomeA: "", outcomeB: "" };
  }, [market]);

  const availableQuantums = useMemo(() => {
    return yesBalance < noBalance ? yesBalance : noBalance;
  }, [yesBalance, noBalance]);

  const availableReadable = useMemo(() => {
    try {
      return formatUnits(availableQuantums, 6);
    } catch {
      return "0";
    }
  }, [availableQuantums]);

  const fetchCtfBalances = useCallback(async () => {
    const raw = (market as any)?.marketOutcomes;
    const outcomes = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? (() => { try { return JSON.parse(raw); } catch { return []; } })()
        : [];
    if (outcomes.length === 0) {
      setYesBalance(0n);
      setNoBalance(0n);
      return;
    }

    setIsFetchingAvailable(true);
    try {
      let nextYes = 0n;
      let nextNo = 0n;
      await Promise.all(
        outcomes.map(async (outcome: any) => {
          if (!outcome.unionKey) return;
          const resp = await getUserCtfBalance(outcome.unionKey);
          if (resp.success && resp.data !== undefined && resp.data !== null) {
            const balanceNum = parseFloat(String(resp.data));
            if (!Number.isFinite(balanceNum)) return;
            const balance = parseUnits(balanceNum.toFixed(6), 6);

            const isNo = Number(outcome?.originalIndex) === 1;

            if (isNo) {
              nextNo = balance;
            } else {
              nextYes = balance;
            }
          }
        })
      );
      setYesBalance(nextYes);
      setNoBalance(nextNo);
    } catch (e) {
      console.error("[MergeShares] Fetch CTF balance error", e);
      setYesBalance(0n);
      setNoBalance(0n);
    } finally {
      setIsFetchingAvailable(false);
    }
  }, [market]);

  useEffect(() => {
    if (!open) return;
    fetchCtfBalances();
  }, [open, fetchCtfBalances]);

  const handleMax = () => {
    if (isFetchingAvailable) return;
    setAmount(availableReadable);
  };

  const handleMerge = async () => {
    if (!conditionId || !marketId) {
      toast.error(t.common?.error || "Invalid market params");
      return;
    }
    if (!clobTokenIds.yesTokenId || !clobTokenIds.noTokenId) {
      toast.error(t.common?.error || "Missing tokenIds");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t.common?.error || "Invalid amount");
      return;
    }
    if (!resolvedOutcomes.outcomeA || !resolvedOutcomes.outcomeB) {
      toast.error(t.common?.error || "Missing market outcome names");
      return;
    }
    try {
      // yesono-embed 的 MergeParams 只需 { amount, conditionId, marketId }；
      // tokenIds / outcomeA / outcomeB 由后端从 marketId 反查。
      const result = await merge({
        conditionId,
        marketId,
        amount,
      });
      if (result.success) {
        const parsedSize = Number.parseFloat(amount);
        if (Number.isFinite(parsedSize) && parsedSize > 0) {
          trackEvent("merge", {
            market_id: marketId,
            size: parsedSize,
          });
        }
        toast.success(t.common?.success || "Merge Successful");
        setAmount("");
        onOpenChange(false);
        if (onSuccess) {
          await onSuccess();
        }
      } else {
        toast.error(result.error || t.common?.error || "Merge Failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Merge Failed");
    }
  };

  const mergeDescription = useMemo(() => {
    return (t.trade.mergeDescription || "")
      .replace("{{yes}}", yesLabel)
      .replace("{{no}}", noLabel);
  }, [t.trade.mergeDescription, yesLabel, noLabel]);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t.trade.mergeShares}
      >
        <div className="flex flex-col gap-5 py-2">
          <p className="text-[--text-secondary] text-sm leading-relaxed">
            {mergeDescription}
          </p>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium text-[--text-primary]">
              {t.trade.amount}
            </div>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  /**
                   * 中文注释：
                   * - 只允许输入“数字 + 可选一个小数点”
                   * - 之前这里误写成了双反斜杠（\\d），会把数字输入全部拦截
                   */
                  if (/^\d*\.?\d*$/.test(val)) setAmount(val);
                }}
                placeholder="0"
                disabled={isLoading}
                className="w-full p-3 rounded-md border border-[--border] bg-[--bg-input] text-[--text-primary] focus:outline-none focus:border-[--accent] transition-colors disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end items-center text-xs text-[--text-secondary] gap-1">
              {/* 中文注释：不要依赖翻译占位符，直接拼接，避免“可用份额”后面不显示数值 */}
              <span>
                {t.trade.availableShares}: {isFetchingAvailable ? "..." : availableReadable}
              </span>
              <span
                onClick={handleMax}
                className={`text-[--accent] hover:underline font-medium ${isFetchingAvailable ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                {t.trade.max}
              </span>
            </div>
          </div>

          {status ? (
            <div className="text-xs text-[--text-secondary]">{status}</div>
          ) : null}

          <GameButton
            onClick={handleMerge}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              parseFloat(amount) > parseFloat(availableReadable) ||
              isLoading
            }
            className="w-full mt-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>{t.trade.processing}</span>
              </div>
            ) : (
              t.trade.mergeShares
            )}
          </GameButton>
        </div>
      </Dialog>
    </>
  );
}
