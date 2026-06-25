import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/common/Avatar";
import { Holding } from "@/types/types";
import { UserProfile } from "@/components/common/UserProfile";
import { useTranslation } from "@/lib/i18n";

interface HoldersListProps {
  title: string;
  holders: Holding[];
  highlight?: "green" | "red" | "default";
}

const HoldersList: React.FC<HoldersListProps> = ({
  title,
  holders,
  highlight = "default",
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  const goToUserPna = useCallback(
    (userId?: string) => {
      if (!userId) return;
      router.push(`/pna?userId=${encodeURIComponent(String(userId))}`);
    },
    [router]
  );

  return (
    <div className="@container">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-(--border)">
        <span className="text-sm font-medium text-(--text-primary)">
          {title}
        </span>
        <span className="text-xs text-(--text-secondary) uppercase">
          {t.market.shares}
        </span>
      </div>
      <div className="space-y-1">
        {holders.map((holder) => {
          // 0x 开头长度 42 的钱包地址截断显示(0x1234...abcd),避免窄容器横向溢出
          const isAddress =
            holder.userName.startsWith("0x") && holder.userName.length === 42;
          const displayName = isAddress
            ? `${holder.userName.slice(0, 6)}...${holder.userName.slice(-4)}`
            : holder.userName;
          return (
            <div
              key={holder.userId}
              onClick={() => goToUserPna(holder.userId)}
              className="flex items-center gap-3 py-1.5 hover:bg-(--bg-hover) rounded-lg px-2 -mx-2 cursor-pointer"
            >
              <UserProfile userId={holder.userId} displayName={holder.userName}>
                <Avatar name={holder.userName} size={32} />
              </UserProfile>
              {/* 容器宽时(@sm+)同行;窄时换行,shares 单位仅窄时显示 */}
              <div className="block items-center gap-3 flex-1 @sm:flex">
                <UserProfile userId={holder.userId} displayName={holder.userName}>
                  <span className="text-sm text-(--text-primary) truncate hover:underline cursor-pointer">
                    {displayName}
                  </span>
                </UserProfile>
                <span
                  className={`ml-auto shrink-0 text-sm font-medium tabular-nums ${
                    highlight === "green"
                      ? "text-(--green)"
                      : highlight === "red"
                        ? "text-(--red)"
                        : "text-(--text-primary)"
                  }`}
                >
                  {Number(holder.size).toLocaleString()}{" "}
                  <span className="@sm:hidden">{t.market.shares}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HoldersList;
