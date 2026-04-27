import React from "react";
import Avatar from "@/components/common/Avatar";
import { Holding } from "@/types/types";
import { UserProfile } from "@/components/common/UserProfile";

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
  return (
    <div>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {title}
        </span>
        <span className="text-xs text-[var(--text-secondary)] uppercase">
          Shares
        </span>
      </div>
      <div className="space-y-1">
        {holders.map((holder) => (
          <div
            key={holder.userId}
            className="flex items-center gap-3 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg px-2 -mx-2 cursor-pointer"
          >
            <UserProfile userId={holder.userId} displayName={holder.userName}>
              <Avatar name={holder.userName} id={holder.userId} size="sm" />
            </UserProfile>
            <UserProfile userId={holder.userId} displayName={holder.userName}>
              <span className="text-sm text-[var(--text-primary)] truncate hover:underline cursor-pointer">
                {holder.userName}
              </span>
            </UserProfile>
            <span
              className={`ml-auto flex-shrink-0 text-sm font-medium tabular-nums ${
                highlight === "green"
                  ? "text-[var(--green)]"
                  : highlight === "red"
                    ? "text-[var(--red)]"
                    : "text-[var(--text-primary)]"
              }`}
            >
              {Number(holder.size).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HoldersList;
