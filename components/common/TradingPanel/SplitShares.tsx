import { useState } from "react";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { useTranslation } from "@/lib/i18n";
import GameButton from "@/components/sports/Live/GameButton";
import { useCtfOperations } from "@/lib/hooks/useCtfOperations";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/sentryClient";
import { normalizeBinaryOutcomeLabel } from "@/lib/utils/outcomes";

interface SplitSharesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onSuccess?: () => void | Promise<void>;
  conditionId: string;
  marketId?: string;
  isAuthenticated?: boolean;
  isAuthorized?: boolean;
  walletBalance?: number;
  yesLabel?: string;
  noLabel?: string;
  marketOutcomes?: any[];
}

export default function SplitShares({
  open,
  onOpenChange,
  onConfirm,
  onSuccess,
  walletBalance = 0,
  conditionId,
  marketId,
  yesLabel: yesLabelProp,
  noLabel: noLabelProp,
  marketOutcomes,
}: SplitSharesProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const { split, isLoading } = useCtfOperations();
  const toast = useToast();

  const fromOutcomes = (() => {
    if (!Array.isArray(marketOutcomes) || marketOutcomes.length < 2) return { yes: "", no: "" };
    const sideA = marketOutcomes.find((o: any) => Number(o?.originalIndex) === 0) ?? marketOutcomes[0];
    const sideB = marketOutcomes.find((o: any) => Number(o?.originalIndex) === 1) ?? marketOutcomes[1];
    const yes = String(sideA?.name ?? sideA?.outcome ?? sideA?.outcomeKey ?? "").trim();
    const no = String(sideB?.name ?? sideB?.outcome ?? sideB?.outcomeKey ?? "").trim();
    return { yes, no };
  })();

  const yesLabel = normalizeBinaryOutcomeLabel(
    fromOutcomes.yes || yesLabelProp,
    yesLabelProp || t.common.yes,
    {
      yes: t.common.yes,
      no: t.common.no,
      up: t.common.up,
      down: t.common.down,
    }
  );
  const noLabel = normalizeBinaryOutcomeLabel(
    fromOutcomes.no || noLabelProp,
    noLabelProp || t.common.no,
    {
      yes: t.common.yes,
      no: t.common.no,
      up: t.common.up,
      down: t.common.down,
    }
  );

  const handleSplit = async () => {
    if (!conditionId) {
      toast.error(t.common?.error || "Invalid Market params");
      return;
    }
    try {
      const result = await split({
        amount,
        conditionId: conditionId,
        marketId,
      });
      if (result.success) {
        const parsedSize = Number.parseFloat(amount);
        if (marketId && Number.isFinite(parsedSize) && parsedSize > 0) {
          trackEvent("split", {
            market_id: marketId,
            size: parsedSize,
          });
        }
        toast.success(t.common?.success || "Split Successful");
        setAmount("");
        onOpenChange(false);
        if (onSuccess) {
          await onSuccess();
        }
      } else {
        toast.error(result.error || t.common?.error || "Split Failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Split Failed");
    }
  };

  const handleMax = () => {
    setAmount(walletBalance.toString());
  }

  // State 1: No Balance -> Show Deposit Prompt (Existing Logic)
  // Assuming a small epsilon for float comparison, though <= 0 is standard for empty
  if (walletBalance <= 0) {
    return (
      <ConfirmDialog
        open={open}
        title={t.trade.splitShares}
        message={t.trade.splitMessage}
        cancelText={null}
        confirmText={t.trade.deposit}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );
  }

  // State 2: Has Balance -> Show Split Form
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.trade.splitShares}
      className="max-w-md"
    >
      <div className="flex flex-col gap-5 py-2">
        {/* Description */}
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          {(t.trade.splitDescription || "")
            .replace("{{yes}}", yesLabel)
            .replace("{{no}}", noLabel)}
        </p>

        {/* Amount Input */}
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-[var(--text-primary)]">{t.trade.amount}</div>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) {
                  setAmount(val);
                }
              }}
              placeholder="0"
              disabled={isLoading}
              className="w-full p-3 rounded-md border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
            />
          </div>
          {/* Available Tip */}
          <div className="flex justify-end items-center text-xs text-[var(--text-secondary)] gap-1">
            <span>
              {(t.trade.availableMax || "Available: {{amount}} USDT Max").replace("{{amount}}", walletBalance.toString())}
            </span>
            <span
              onClick={handleMax}
              className="text-[var(--accent)] cursor-pointer hover:underline font-medium"
            >
              {t.trade.max}
            </span>
          </div>
        </div>

        {/* Confirm Button */}
        <GameButton
          onClick={handleSplit}
          disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > walletBalance || isLoading}
          className="w-full mt-2"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span>{t.trade.processing}</span>
            </div>
          ) : t.trade.splitButton}
        </GameButton>
      </div>
    </Dialog>
  );
}
