"use client";

import { YesNoOrders } from "./yes-no";
import { AsianOrders } from "./asian";

interface OrdersTableProps {
  targetUserId?: string;
  mode: "yesNo" | "asian";
}

export default function OrdersTable({ targetUserId, mode }: OrdersTableProps) {
  if (mode === "yesNo") return <YesNoOrders targetUserId={targetUserId} />;
  return <AsianOrders />;
}
