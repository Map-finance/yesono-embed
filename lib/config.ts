import { getAppEnvironment } from "@/lib/env";

export const isProduction = (): boolean => {
  return getAppEnvironment() === "production";
};

export const getBasescanUrl = {
  transaction: (txHash: string) =>
    `${process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? ""}/tx/${txHash}`,
  address: (address: string) =>
    `${process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? ""}/address/${address}`,
  block: (blockNumber: string | number) =>
    `${process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? ""}/block/${blockNumber}`,
};
