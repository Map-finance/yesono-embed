import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { getUserTransactions } from "@/lib/api";
import { useI18n } from "@/components/hooks/useI18n";
import { getBasescanUrl } from "@/lib/config";
import { TransactionStatus, TransactionType } from "@/types/transaction";
import { ApiTransactionRecord, TransactionRecordType } from "../types";
import { useAuthStore } from "@/lib/stores/authStore";
import { useToast } from "@/components/ui/Toast";
import Select from "@/components/ui/Select";

const OrderEmptyState: React.FC<{ text?: string }> = ({ text = "暂无订单" }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <span className="text-4xl">📋</span>
    <span className="text-[14px]" style={{ color: "var(--text-primary)" }}>
      {text}
    </span>
  </div>
);

const pageSizeOptions = [5, 10, 20, 50];


interface TransactionRecordsTabProps {
  isActive: boolean;
}

const TransactionRecordsTab: React.FC<TransactionRecordsTabProps> = ({
  isActive,
}) => {
  const toast = useToast();
  const router = useRouter();
  const { t } = useI18n();
  const { accessToken, isAuthenticated } = useAuthStore();

  const [transactionData, setTransactionData] = useState<
    TransactionRecordType[]
  >([]);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionPagination, setTransactionPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
  });

  // 复制交易编号功能
  const copyTransactionId = (id: string) => {
    navigator.clipboard
      .writeText(id)
      .then(() => toast.success(t("transactionIdCopied")))
      .catch(() => toast.error(t("copyFailed")));
  };

  const getTypeText = (type: TransactionType) => {
    switch (type) {
      case TransactionType.STAKE:
        return t("stake");
      case TransactionType.CLAIM:
        return t("claim");
      default:
        return type;
    }
  };

  // 转换 API 数据为组件所需格式
  const transformApiTransactionData = useCallback(
    (apiData: ApiTransactionRecord[]): TransactionRecordType[] => {
      return apiData.map((item) => {
      // 格式化时间戳 - 统一处理时间戳格式
      const formatTimestamp = (timestamp: number) => {
        try {
          // 判断时间戳格式：如果小于等于10位数字，说明是秒级；否则是毫秒级
          const date =
            timestamp.toString().length <= 10
              ? new Date(timestamp * 1000) // 秒级转毫秒级
              : new Date(timestamp); // 毫秒级直接使用
          return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        } catch (e) {
          console.warn('[TransactionRecordsTab] Failed to format timestamp', e);
          return t("timeUnknown");
        }
      };

      // 判断交易状态
      const getTransactionStatus = (): TransactionStatus => {
        // 由于API中status为null，我们可以根据是否有txHash来判断状态
        if (item.txHash && item.txHash.length > 0) {
          return TransactionStatus.SUCCESS; // 有交易哈希说明交易成功
        }
        return TransactionStatus.PENDING; // 默认为处理中
      };

      // 判断交易类型
      const getTransactionType = (): TransactionType => {
        if (item.type === "stake") {
          return TransactionType.STAKE;
        } else if (item.type === "claim") {
          return TransactionType.CLAIM;
        }
        // 根据金额正负判断类型，默认为stake
        return TransactionType.STAKE;
      };

        return {
          key: item.id.toString(),
          id: item.id.toString(),
          anchorId: item.anchorId,
          type: getTransactionType(),
          amount: `${(Number(item.amount) || 0).toLocaleString()}`,
          status: getTransactionStatus(),
          createTime: formatTimestamp(item.chainTimestamp || item.createdAt),
          transactionId: item.txHash, // 使用txHash作为交易ID
          email: item.email,
          address: item.address,
          smartAccount: item.smartAccount,
          avatarUrl: item.avatarUrl,
          marketId: item.marketId?.toString() || "",
          eventName: item.eventName || "-",
          direct: item.option?.name || "-",
        };
      });
    },
    [t]
  );

  // 获取交易记录数据
  const fetchTransactionData = useCallback(
    async (page: number = 1, size: number = 5) => {
      if (!isAuthenticated || !accessToken) return;
      await Promise.resolve();
      setTransactionLoading(true);
      try {
        const response = await getUserTransactions(page, size);
        if (response.success && response.data) {
          const transformedData = transformApiTransactionData(
            response.data.records || []
          );
          setTransactionData(transformedData);
          setTransactionPagination({
            current: page,
            pageSize: size,
            total: response.data.total || 0,
          });
        } else {
          toast.error(response.msg || t("getTransactionRecordsFailed"));
        }
      } catch (error) {
        console.error("获取交易记录失败:", error);
        toast.error(t("getTransactionRecordsFailed"));
      } finally {
        setTransactionLoading(false);
      }
    },
    [accessToken, isAuthenticated, t, toast, transformApiTransactionData]
  );

  // 组件挂载或激活时获取数据
  useEffect(() => {
    if (!(isActive && isAuthenticated && accessToken)) return;

    const timer = window.setTimeout(() => {
      void fetchTransactionData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isActive, isAuthenticated, accessToken, fetchTransactionData]);

  // 处理分页变化
  const handleTransactionPaginationChange = (
    page: number,
    pageSize?: number
  ) => {
    fetchTransactionData(page, pageSize || transactionPagination.pageSize);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(transactionPagination.total / transactionPagination.pageSize)
  );
  const currentPage = Math.min(transactionPagination.current, totalPages);
  const hasRows = transactionData.length > 0;
  const showInitialLoading = transactionLoading && !hasRows;

  const statusMeta = (status: TransactionStatus) => {
    if (status === TransactionStatus.PENDING) {
      return {
        label: t("processing"),
        className:
          "bg-[color:var(--warning)] text-[color:var(--warning-foreground)]",
      };
    }

    if (status === TransactionStatus.FAIL) {
      return {
        label: t("failed"),
        className:
          "bg-[color:var(--error)] text-[color:var(--error-foreground)]",
      };
    }

    return {
      label: t("success"),
      className:
        "bg-[color:var(--success)] text-[color:var(--success-foreground)]",
    };
  };

  const formatTransactionHash = (txHash?: string) => {
    if (!txHash) return t("none");
    return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  };

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    if (safePage === currentPage) return;
    handleTransactionPaginationChange(safePage, transactionPagination.pageSize);
  };

  const changePageSize = (nextPageSize: number) => {
    if (nextPageSize === transactionPagination.pageSize) return;
    handleTransactionPaginationChange(1, nextPageSize);
  };

  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[860px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
        {transactionLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/55 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2 text-sm text-[var(--text-secondary)] shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loading") || "Loading..."}
            </div>
          </div>
        )}

        <table className="w-full border-separate border-spacing-0">
          <thead className="bg-[var(--bg-secondary)]">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <th className="px-4 py-3">{t("type")}</th>
              <th className="px-4 py-3">{t("leagueName")}</th>
              <th className="px-4 py-3">{t("direct")}</th>
              <th className="px-4 py-3 text-center">{t("amount")}</th>
              <th className="px-4 py-3 text-center">{t("status")}</th>
              <th className="px-4 py-3">{t("createTime")}</th>
              <th className="px-4 py-3">{t("transactionHash")}</th>
            </tr>
          </thead>
          <tbody>
            {!showInitialLoading && !hasRows ? (
              <tr>
                <td colSpan={7} className="px-4 py-0">
                  <OrderEmptyState text={t("noOrders") || "暂无订单"} />
                </td>
              </tr>
            ) : (
              transactionData.map((record) => {
                const meta = statusMeta(record.status);

                return (
                  <tr
                    key={record.key}
                    className="border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-secondary)]/70"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      router.push(
                        `/sports/football/asian/detail?eventId=${record.anchorId}&type=market&catalog=football`
                      );
                    }}
                  >
                    <td className="px-4 py-4 text-[12px] md:text-[14px] text-text-primary">
                      {getTypeText(record.type)}
                    </td>
                    <td className="px-4 py-4 text-[12px] md:text-[14px] text-text-primary">
                      <span className="block max-w-[180px] truncate" title={record.eventName}>
                        {record.eventName}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[12px] md:text-[14px] text-text-primary">
                      <span className="block max-w-[180px] truncate" title={record.direct}>
                        {record.direct}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-[12px] md:text-[14px] text-text-primary font-number">
                      {record.amount}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-2.5 py-1 text-[12px] font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[12px] md:text-[14px] text-text-primary font-number">
                      {record.createTime}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="max-w-[140px] truncate font-mono text-[12px] text-[var(--info)] transition-colors hover:text-primary"
                          title={record.transactionId || undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (record.transactionId?.startsWith("0x")) {
                              window.open(
                                getBasescanUrl.transaction(record.transactionId),
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }
                          }}
                        >
                          {formatTransactionHash(record.transactionId)}
                        </button>
                        {record.transactionId && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyTransactionId(record.transactionId);
                            }}
                            aria-label={t("transactionIdCopied")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--text-secondary)]">
            {t("totalRecords", {
              total: transactionPagination.total.toString(),
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span>Page size</span>
              <Select
                options={pageSizeOptions.map((size) => ({
                  value: size,
                  label: size.toString(),
                }))}
                value={transactionPagination.pageSize}
                onChange={changePageSize}
                className="min-w-[100px]"
                renderSelected={(option) => (
                  <span>{option.label} / page</span>
                )}
                renderOption={(option) => <span>{option.label} / page</span>}
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[100px] text-center text-sm text-[var(--text-secondary)]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionRecordsTab;
