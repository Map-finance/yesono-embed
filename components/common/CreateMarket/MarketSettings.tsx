"use client";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useState, useEffect } from "react";
import { useTranslation } from '@/lib/i18n';

interface MarketSettingsProps {
  onNext: (data: {
    token: string;
    proposerReward: string;
    stakeDeposit: string;
  }) => void;
  onPrevious: () => void;
  initialData?: {
    token?: string;
    proposerReward?: string;
    stakeDeposit?: string;
  };
}

// 市场设置 step: 选择交易代币和设置奖励
export default function MarketSettings({
  onNext,
  onPrevious,
  initialData = {},
}: MarketSettingsProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState(initialData.token || "");
  const [proposerReward, setProposerReward] = useState(
    initialData.proposerReward || "",
  );
  const [stakeDeposit, setStakeDeposit] = useState(
    initialData.stakeDeposit || "",
  );
  const [isLoading, setIsLoading] = useState(false);

  // 可选的交易代币列表
  const tokenOptions = [
    { value: "ETH", label: "ETH" },
    { value: "USDC", label: "USDC" },
    { value: "USDT", label: "USDT" },
    { value: "DAI", label: "DAI" },
  ];

  useEffect(() => {
    if (initialData.token) setToken(initialData.token);
    if (initialData.proposerReward)
      setProposerReward(initialData.proposerReward);
    if (initialData.stakeDeposit) setStakeDeposit(initialData.stakeDeposit);
  }, [initialData]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // 模拟API请求
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onNext({ token, proposerReward, stakeDeposit });
    } catch (error) {
      console.error("Settings submission failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = token && proposerReward.trim() && stakeDeposit.trim();

  return (
    <div className="text-sm">
      <div className="mb-6">
        <div className="mb-2 text-[var(--text-secondary)]">{t.market.create.tradingToken}</div>
        <Select
          options={tokenOptions}
          className="w-full"
          value={token}
          onChange={setToken}
          placeholder={t.market.create.selectTradingToken}
          disabled={isLoading}
        />
      </div>

      <div className="mb-6">
        <div className="mb-2 text-[var(--text-secondary)]">
          {t.market.create.proposerReward}
        </div>
        <Input
          type="number"
          className="w-full"
          value={proposerReward}
          onChange={(e) => setProposerReward(e.target.value)}
          placeholder="e.g., 5"
          disabled={isLoading}
          min="0"
          max="100"
          step="0.1"
        />
        <div className="text-xs text-[var(--text-secondary)] mt-1">
          {t.market.create.proposerRewardDesc}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 text-[var(--text-secondary)]">{t.market.create.stakeDeposit}</div>
        <Input
          type="number"
          className="w-full"
          value={stakeDeposit}
          onChange={(e) => setStakeDeposit(e.target.value)}
          placeholder="e.g., 100"
          disabled={isLoading}
          min="0"
          step="1"
        />
        <div className="text-xs text-[var(--text-secondary)] mt-1">
          {t.market.create.stakeDepositDesc}
        </div>
      </div>

      <div className="flex justify-end mt-6 gap-3 max-md:flex-col-reverse">
        <button
          onClick={onPrevious}
          disabled={isLoading}
          className="text-[--text-secondary] text-sm underline hover:text-[--text-primary] disabled:opacity-50 max-md:w-full max-md:py-2"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="px-4 py-2 rounded-full bg-[--accent] text-sm text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity max-md:w-full"
        >
          {isLoading ? t.market.common.saving : t.market.common.next}
        </button>
      </div>
    </div>
  );
}
