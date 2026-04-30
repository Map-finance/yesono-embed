"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { useTranslation } from "@/lib/i18n";
import { OrderBookView } from "./order-book";
import { TransactionsView } from "./transactions";
import { OpenRecordsView } from "./open-records";

type AsianSubTab = "orderbook" | "transactions" | "records";

export function AsianOrders() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AsianSubTab>("orderbook");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as AsianSubTab)}>
        <TabsList variant="line">
          <TabsTrigger value="orderbook">{t.pna.asian.orderBook}</TabsTrigger>
          <TabsTrigger value="transactions">{t.pna.asian.transactionRecords}</TabsTrigger>
          <TabsTrigger value="records">{t.pna.asian.openRecords}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "orderbook" && <OrderBookView />}
      {tab === "transactions" && <TransactionsView />}
      {tab === "records" && <OpenRecordsView />}
    </div>
  );
}
