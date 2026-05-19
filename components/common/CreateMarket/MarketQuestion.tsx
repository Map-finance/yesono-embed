"use client";
import Input from "@/components/ui/Input";
import { CircleAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from '@/lib/i18n';

interface MarketQuestionProps {
  onNext: (data: {
    prediction: string;
    title: string;
    rules: string;
    endDate: string;
  }) => void;
  onPrevious?: () => void;
  initialData?: string;
}

// 输入问题，让 AI 生成市场信息 step 2
export default function MarketQuestion({
  onNext,
  onPrevious = () => {},
  initialData,
}: MarketQuestionProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState(initialData || "");
  const [isLoading, setIsLoading] = useState(false);
  const maxLength = 200;
  const remaining = maxLength - question.length;

  useEffect(() => {
    setQuestion(initialData || "");
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setQuestion(value);
    }
  };

  // Mock AI 生成市场数据
  const generateMarketData = (input: string) => {
    // 基于输入的问题 mock 几个不同的数据
    const mocks = [
      {
        title: "Will Bitcoin reach $100,000 by end of 2024?",
        rules:
          "This market resolves to YES if the price of Bitcoin (BTC) reaches or exceeds $100,000 USD on any major exchange (Coinbase, Binance, etc.) before January 1, 2025. The market resolves to NO if it does not reach this price by the deadline. In case of exchange discrepancies, the average price across major exchanges will be used.",
        endDate: "12/31/2024",
      },
      {
        title: "Will Tesla release a new model in 2024?",
        rules:
          "This market resolves to YES if Tesla officially announces and begins production of a new vehicle model (not just a refresh or variant) in 2024. The announcement must be made by Tesla's official channels. Resolves to NO if no new model is announced by December 31, 2024.",
        endDate: "12/31/2024",
      },
      {
        title: "Will the US Federal Reserve cut interest rates in Q3 2024?",
        rules:
          "This market resolves to YES if the US Federal Reserve announces an interest rate cut during the third quarter of 2024 (July 1 - September 30). Resolves to NO if no rate cut occurs in that period. The decision is based on official FOMC announcements.",
        endDate: "09/30/2024",
      },
    ];

    // 简单随机选择一个 mock 数据
    const randomIndex = Math.floor(Math.random() * mocks.length);
    return mocks[randomIndex];
  };

  const handleSubmit = async () => {
    if (question.trim()) {
      setIsLoading(true);
      try {
        // 模拟 AI 生成过程
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 生成市场数据
        const generatedData = generateMarketData(question);

        // 传递问题和生成的标题、规则、结束日期
        onNext({
          prediction: question,
          title: generatedData.title,
          rules: generatedData.rules,
          endDate: generatedData.endDate,
        });
      } catch (error) {
        console.error("Generation failed:", error);
        // 可以在这里显示错误提示
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isValid = question.trim().length > 0;

  return (
    <div className="text-sm">
      <label>
        <div>{t.market.create.enterYourQuestion}</div>
        <Input
          className="w-full mt-2"
          as="textarea"
          rows={3}
          placeholder={t.market.create.enterMarketQuestion}
          value={question}
          onChange={handleChange}
          disabled={isLoading}
        />
      </label>
      <div className="text-xs text-(--text-secondary) mt-1">
        {t.market.create.charactersRemaining(remaining, maxLength)}
      </div>
      <div className="text-(--accent) text-sm mt-6">
        <CircleAlert size={16} className="inline-block align-middle mr-1" />
        <span className="align-middle">
          {t.market.create.aiHint}
        </span>
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
          {isLoading ? t.market.create.generating : t.market.create.generateMarketDetails}
        </button>
      </div>
    </div>
  );
}
