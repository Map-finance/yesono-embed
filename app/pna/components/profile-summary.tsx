"use client";

import { useMemo } from "react";
import NumberFlow from "@number-flow/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/shadcn/avatar";
import { Card, CardContent } from "@/components/ui/shadcn/card";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/authStore";
import useGetPositions from "@/lib/hooks/pna/use-get-positions";

interface ProfileSummaryProps {
  targetUserId?: string;
  isViewingOtherUser: boolean;
}

export default function ProfileSummary({
  targetUserId,
  isViewingOtherUser,
}: ProfileSummaryProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const displayUser = isViewingOtherUser
    ? { userId: targetUserId, avatar: undefined, name: undefined }
    : user;

  const userId = displayUser?.userId || targetUserId || "—";
  const avatarUrl = (displayUser as { avatar?: string })?.avatar;
  const displayName = (displayUser as { name?: string })?.name || userId;

  const { positions, isLoading } = useGetPositions({
    limit: 100,
    userId: targetUserId,
  });

  const totalValue = useMemo(
    () => positions.reduce((sum, p) => sum + (p.value ?? 0), 0),
    [positions]
  );
  const totalProfit = useMemo(
    () => positions.reduce((sum, p) => sum + (p.profit ?? 0), 0),
    [positions]
  );

  const initials = (displayName || userId).slice(0, 2).toUpperCase();

  return (
    <Card className="w-full bg-(--bg-card) border-(--border)">
      <CardContent className="p-4 flex items-center gap-4">
        <Avatar className="size-12 shrink-0">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
          <AvatarFallback className="bg-(--bg-secondary) text-(--text-primary)">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate text-(--text-primary)">
            {displayName}
          </div>
          {userId !== displayName && (
            <div className="text-xs text-(--text-secondary) truncate font-mono">
              {userId}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-stretch gap-6 text-right">
          <Stat label={t.pna.profile.positionsValue} value={totalValue} loading={isLoading} />
          <Stat
            label={t.pna.profitLossLabel}
            value={totalProfit}
            loading={isLoading}
            positive={totalProfit >= 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatProps {
  label: string;
  value: number;
  loading?: boolean;
  positive?: boolean;
}

function Stat({ label, value, loading, positive }: StatProps) {
  return (
    <div>
      <div className="text-xs text-(--text-secondary)">{label}</div>
      <div
        className={
          positive === undefined
            ? "text-base font-semibold text-(--text-primary)"
            : positive
              ? "text-base font-semibold text-emerald-500"
              : "text-base font-semibold text-red-500"
        }
      >
        {loading ? (
          <span className="text-(--text-secondary)">—</span>
        ) : (
          <NumberFlow value={value} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
        )}
      </div>
    </div>
  );
}
