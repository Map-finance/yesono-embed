"use client";
import Input from "@/components/ui/Input";
import { CircleCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from '@/lib/i18n';

interface GenerateResultAndFormProps {
  onNext: (data: { title: string; endDate: string; rules: string }) => void;
  onPrevious: () => void;
  initialData?: {
    title?: string;
    endDate?: string;
    rules?: string;
  };
  isAIGenerated?: boolean;
}

// AI生成的预测表单 step 2
export default function GenerateResultAndForm({
  onNext,
  onPrevious,
  initialData = {},
  isAIGenerated = true,
}: GenerateResultAndFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialData.title || "");
  const [endDate, setEndDate] = useState(initialData.endDate || "");
  const [rules, setRules] = useState(initialData.rules || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData.title) setTitle(initialData.title);
    if (initialData.endDate) setEndDate(initialData.endDate);
    if (initialData.rules) setRules(initialData.rules);
  }, [initialData]);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // 这里执行异步请求
      // const response = await api.confirmMarketDetails({ title, endDate, rules });

      // 模拟API请求
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 验证成功，进入下一步
      onNext({ title, endDate, rules });
    } catch (error) {
      console.error("Confirmation failed:", error);
      // 可以在这里显示错误提示
    } finally {
      setIsLoading(false);
    }
  };

  const isValid =
    title.trim().length > 0 &&
    endDate.trim().length > 0 &&
    rules.trim().length > 0;

  return (
    <div>
      <FormItem label={t.market.create.marketTitle}>
        <Input
          className="w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          placeholder={t.market.create.marketTitle}
        />
      </FormItem>
      <FormItem label={t.market.create.endDate}>
        <Input
          className="w-full"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={isLoading}
          placeholder="e.g., 12/31/2024"
        />
      </FormItem>
      <FormItem label={t.market.rules}>
        <Input
          as="textarea"
          className="w-full"
          rows={5}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          disabled={isLoading}
          placeholder={t.market.create.marketResolutionRules}
        />
      </FormItem>
      {isAIGenerated && (
        <div className="text-sm flex items-start gap-2 border border-[#079911] px-3 py-1 rounded-md">
          <CircleCheck className="text-[#079911]" />
          <div className="space-y-2">
            <div>{t.market.create.aiGeneratedNote}</div>
            <div className="opacity-70">
              {t.market.create.aiGeneratedEditHint}
            </div>
          </div>
        </div>
      )}
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

function FormItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 text-sm">
      <div className="mb-1 text-[var(--text-secondary)]">{label}</div>
      <div>{children}</div>
    </div>
  );
}
