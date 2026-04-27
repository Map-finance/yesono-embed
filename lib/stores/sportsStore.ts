// Simple zustand store for sports navigation state
// Stores which menu is selected so UI can prefer store state over route-based checks.

import create from "zustand";

export type MenuKey = `sport:${string}` | "live" | "futures" | null;

interface SportsStore {
    selectedMenu: MenuKey;
    setSelectedMenu: (menu: MenuKey) => void;
}

const useSportsStore = create<SportsStore>((set) => ({
    selectedMenu: null,
    setSelectedMenu: (menu) => set({ selectedMenu: menu }),
}));

export default useSportsStore;
