"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getReviewRecordList,
  type ReviewRecordItem,
} from "@/lib/services/aiService";
import { useAuthStore } from "@/lib/stores/authStore";
import { useHybridSmartAccount } from "@/lib/hybrid-auth";
import { useLocale } from "@/lib/i18n";

interface UseGetReviewRecordsOptions {
  page?: number;
  pageSize?: number;
  status?: "pending" | "approved" | "rejected";
  enabled?: boolean;
}

export default function useGetReviewRecords(
  opts: UseGetReviewRecordsOptions = {}
) {
  const { page = 1, pageSize = 20, status, enabled = true } = opts;
  const { user: backendUser } = useAuthStore();
  const { smartAccount } = useHybridSmartAccount();
  const { locale } = useLocale();
  // 使用 walletAddress（真实钱包地址）而非 smartAccountAddress（智能合约地址）
  const wallet =
    backendUser?.walletAddress ||
    backendUser?.smartAccountAddress ||
    (smartAccount?.address as string) ||
    "";

  const [records, setRecords] = useState<ReviewRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!wallet || !enabled) return;
    setIsLoading(true);
    try {
      const res = await getReviewRecordList({
        wallet,
        status,
        page,
        page_size: pageSize,
      });
      setRecords(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error("[useGetReviewRecords]", e);
    } finally {
      setIsLoading(false);
    }
  }, [wallet, status, page, pageSize, enabled]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, locale]);

  return { records, total, isLoading, refresh: fetchRecords };
}

export type { ReviewRecordItem };
