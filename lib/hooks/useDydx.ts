export function useDydx() {
    return {
        cancelOrder: async (...params: any[]) => {
            console.log("[useDydx] cancelOrder called with params:", params);
        }
    }
}