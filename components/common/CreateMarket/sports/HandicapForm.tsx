"use client";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { useState, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from '@/lib/i18n';

const handicapTypes = [
  { value: "handicap", label: "Handicap" },
  { value: "over_under", label: "Over/Under" },
  { value: "custom", label: "Custom" },
];

const handicapOptions = [
  { value: "0.5", label: "0.5" },
  { value: "1", label: "1" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2" },
  { value: "2.5", label: "2.5" },
  { value: "3", label: "3" },
  { value: "3.5", label: "3.5" },
  { value: "4", label: "4" },
  { value: "4.5", label: "4.5" },
];

const overUnderOptions = [
  { value: "1.5", label: "1.5" },
  { value: "2.5", label: "2.5" },
  { value: "3.5", label: "3.5" },
  { value: "4.5", label: "4.5" },
];

interface HandicapFormProps {
  onNext: (data: {
    type: string;
    config: any;
    title: string;
    rules: string;
    endDate: string;
  }) => void;
  onPrevious?: () => void;
  initialData?: {
    type?: string;
    config?: any;
  };
  team1?: string;
  team2?: string;
  matchTime?: string;
}

export default function HandicapForm({
  onNext,
  onPrevious = () => {},
  initialData = {},
  team1 = "Team 1",
  team2 = "Team 2",
  matchTime = "",
}: HandicapFormProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<string | undefined>(initialData.type);
  const [handicapValue, setHandicapValue] = useState<string | undefined>(
    initialData.config?.handicapValue,
  );
  const [customHandicap, setCustomHandicap] = useState<string>(
    initialData.config?.customHandicap || "",
  );
  const [overUnderValue, setOverUnderValue] = useState<string | undefined>(
    initialData.config?.overUnderValue,
  );
  const [customOverUnder, setCustomOverUnder] = useState<string>(
    initialData.config?.customOverUnder || "",
  );

  const [customQuestion, setCustomQuestion] = useState<string>(
    initialData.config?.customQuestion || "",
  );
  const [customOptions, setCustomOptions] = useState<string[]>(
    initialData.config?.customOptions || ["", ""],
  );

  const [isLoading, setIsLoading] = useState(false);

  const isHandicapCustom = handicapValue === "custom";
  const isOverUnderCustom = overUnderValue === "custom";

  const handleSubmit = async () => {
    let config: any = {};
    let title = "";
    let rules = "";
    let endDate = matchTime;

    if (type === "handicap") {
      title = `Will ${team1} win with handicap ${isHandicapCustom ? customHandicap : handicapValue || ""} against ${team2}?`;
      config = {
        handicapValue: isHandicapCustom ? customHandicap : handicapValue || "",
        options: ["Handicap Win", "Handicap Lose/Draw"],
      };
      rules = `Handicap Win: Net goals > ${isHandicapCustom ? customHandicap : handicapValue || ""}. Handicap Lose/Draw: Net goals ≤ ${isHandicapCustom ? customHandicap : handicapValue || ""}.`;
    } else if (type === "over_under") {
      title = `Will the total goals in ${team1} vs ${team2} exceed ${isOverUnderCustom ? customOverUnder : overUnderValue || ""}?`;
      config = {
        overUnderValue: isOverUnderCustom
          ? customOverUnder
          : overUnderValue || "",
        options: ["Over", "Under"],
      };
      rules = `Over: Total goals ≥ ${isOverUnderCustom ? customOverUnder : overUnderValue || ""}. Under: Total goals ≤ ${isOverUnderCustom ? customOverUnder : overUnderValue || ""}.`;
    } else if (type === "custom") {
      title = customQuestion;
      config = {
        customOptions,
      };
      rules = "";
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      onNext({ type: type!, config, title, rules, endDate });
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = (() => {
    if (!type) return false;
    if (type === "handicap") {
      return (
        (handicapValue && !isHandicapCustom) ||
        (isHandicapCustom && customHandicap)
      );
    }
    if (type === "over_under") {
      return (
        (overUnderValue && !isOverUnderCustom) ||
        (isOverUnderCustom && customOverUnder)
      );
    }
    if (type === "custom") {
      return customQuestion && customOptions.filter((o) => o).length >= 2;
    }
    return true;
  })();

  const addCustomOption = () => {
    if (customOptions.length < 8) {
      setCustomOptions([...customOptions, ""]);
    }
  };

  const updateCustomOption = (index: number, value: string) => {
    const newOptions = [...customOptions];
    newOptions[index] = value;
    setCustomOptions(newOptions);
  };

  const removeCustomOption = (index: number) => {
    if (customOptions.length > 2) {
      setCustomOptions(customOptions.filter((_, i) => i !== index));
    }
  };

  return (
    <div>
      <div className="flex gap-6 text-xs max-md:flex-col max-md:gap-4">
        <div className="flex-1">
          <div className="mt-6">
            <div className="mb-2 text-[var(--text-secondary)]">
              {t.market.common.handicapType}
            </div>
            <Select
              options={handicapTypes}
              className="w-full"
              value={type}
              onChange={setType}
              placeholder={t.market.create.selectHandicapType}
              disabled={isLoading}
            />
          </div>

          {type === "handicap" && (
            <>
              <div className="mt-6">
                <div className="mb-2 text-[var(--text-secondary)]">
                  {t.market.common.handicapValue}
                </div>
                <Select
                  options={[
                    ...handicapOptions,
                    { value: "custom", label: "Custom" },
                  ]}
                  className="w-full"
                  value={handicapValue}
                  onChange={setHandicapValue}
                  placeholder={t.market.create.selectHandicapValue}
                  disabled={isLoading}
                />
                {isHandicapCustom && (
                  <Input
                    type="text"
                    value={customHandicap}
                    onChange={(e) => setCustomHandicap(e.target.value)}
                    placeholder={t.market.create.enterCustomHandicap}
                    disabled={isLoading}
                    className="mt-2 w-full"
                  />
                )}
              </div>

              <div className="mt-6">
                <div className="mb-2 text-[var(--text-secondary)]">
                  {t.market.common.settlementOptions}
                </div>
                <div>
                  Handicap Win (Net goals {">"}{" "}
                  {isHandicapCustom ? customHandicap : handicapValue})
                </div>
                <div>
                  Handicap Lose/Draw (Net goals ≤{" "}
                  {isHandicapCustom ? customHandicap : handicapValue})
                </div>
              </div>
            </>
          )}

          {type === "over_under" && (
            <>
              <div className="mt-6">
                <div className="mb-2 text-[var(--text-secondary)]">
                  {t.market.common.overUnderLine}
                </div>
                <Select
                  options={[
                    ...overUnderOptions,
                    { value: "custom", label: "Custom" },
                  ]}
                  className="w-full"
                  value={overUnderValue}
                  onChange={setOverUnderValue}
                  placeholder={t.market.common.selectOverUnderLine}
                  disabled={isLoading}
                />
                {isOverUnderCustom && (
                  <Input
                    type="text"
                    value={customOverUnder}
                    onChange={(e) => setCustomOverUnder(e.target.value)}
                    placeholder={t.market.create.enterCustomLine}
                    disabled={isLoading}
                    className="mt-2 w-full"
                  />
                )}
              </div>

              <div className="mt-6">
                <div className="mb-2 text-[var(--text-secondary)]">
                  {t.market.common.settlementOptions}
                </div>
                <div>
                  Over (Total goals ≥{" "}
                  {isOverUnderCustom ? customOverUnder : overUnderValue})
                </div>
                <div>
                  Under (Total goals ≤{" "}
                  {isOverUnderCustom ? customOverUnder : overUnderValue})
                </div>
              </div>
            </>
          )}

          {type === "custom" && (
            <>
              <div className="mt-6">
                <div className="mb-2 text-[var(--text-secondary)]">
                  {t.market.common.customMarketQuestion}
                </div>
                <Input
                  type="text"
                  className="w-full"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder={t.market.create.enterCustomQuestion}
                  disabled={isLoading}
                />
              </div>
              <div className="mt-6">
                <div className="mb-2 text-[var(--text-secondary)]">
                  {t.market.common.settlementOptions}
                </div>
                {customOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500 w-6 text-center">
                      {index + 1}.
                    </span>
                    <Input
                      type="text"
                      value={option}
                      onChange={(e) =>
                        updateCustomOption(index, e.target.value)
                      }
                      placeholder={t.market.common.option(index + 1)}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    {customOptions.length > 2 && (
                      <button
                        onClick={() => removeCustomOption(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        disabled={isLoading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {customOptions.length < 8 && (
                  <button
                    onClick={addCustomOption}
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-700 transition-colors"
                    disabled={isLoading}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.market.common.addOption}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex justify-end mt-6 gap-3 max-md:flex-col-reverse">
        {onPrevious && (
          <button
            onClick={onPrevious}
            disabled={isLoading}
            className="text-[var(--text-secondary)] text-sm underline hover:text-[var(--text-primary)] disabled:opacity-50 max-md:w-full max-md:py-2"
          >
            {t.market.common.back}
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="px-4 py-2 rounded-full bg-[var(--accent)] text-sm text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity max-md:w-full"
        >
          {isLoading ? t.market.common.processing : t.market.common.next}
        </button>
      </div>
    </div>
  );
}
