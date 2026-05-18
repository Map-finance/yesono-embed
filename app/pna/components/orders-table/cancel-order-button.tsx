"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { cancelOrder } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { useTobMutation } from "@/lib/hooks/tob/useTobMutation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcn/popover";

interface Props {
  /** 旧路径下传 orderId（数字字符串）；新路径下传 betId（uuid）。dispatcher 自适应 */
  betId: string;
  /** 取消成功后刷新订单列表 */
  onSuccess?: () => void;
}

export function CancelOrderButton({ betId, onSuccess }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { mutate, loading } = useTobMutation(cancelOrder);

  const handleConfirm = async () => {
    const r = await mutate(betId);
    if (r?.ok) {
      toast.success(t.pna.orders.cancelSuccess);
      setOpen(false);
      onSuccess?.();
    } else {
      toast.error(t.pna.orders.cancelFailed);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t.pna.orders.cancel}
          disabled={!betId || loading}
          className="text-(--text-secondary) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <p className="mb-3 text-sm text-(--text-primary)">
          {t.pna.orders.cancelConfirm ?? "Cancel this order?"}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="px-3 py-1 rounded text-sm border border-(--border) text-(--text-secondary) hover:bg-(--bg-secondary) disabled:opacity-50"
          >
            {t.common.cancel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-3 py-1 rounded text-sm bg-(--red) text-white hover:opacity-90 disabled:opacity-50"
          >
            {t.common.confirm ?? "Confirm"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
