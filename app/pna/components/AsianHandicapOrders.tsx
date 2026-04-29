"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/hooks/useI18n";
import Tabs from "@/components/ui/Tabs";
import OrderBookTab from "./OrderBookTab";
import TransactionRecordsTab from "./TransactionRecordsTab";
import OpenRecordsTab from "./OpenRecordsTab";

export default function AsianHandicapOrders() {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState("1");

    const items = useMemo(() => [
        {
            value: "1",
            label: t("orderBook"),
            children: <OrderBookTab isActive={activeTab === "1"} />,
    },
        {
            value: "2",
            label: t("transactionRecords"),
            children: <TransactionRecordsTab isActive={activeTab === "2"} />,
        },
        {
            value: "3",
            label: t("openRecords"),
            children: <OpenRecordsTab isActive={activeTab === "3"} />,
        },
    ], [activeTab, t]);

    const onChange = (key: string) => {
        setActiveTab(key);
    };

    return (
        <div className="w-full mx-auto p-2 md:p-4 bg-bg-card rounded-lg mt-6">
            <Tabs
                defaultValue="1"
                items={items}
                onChange={onChange}
            />
        </div>
    );
}
