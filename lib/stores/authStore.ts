export function useAuthStore() {
    return {
        user: {} as any,
        accessToken: 'placeholder-token',
        isAuthenticated: true,
    }
}

useAuthStore.getState = () => ({
    user: {} as any,
    accessToken: 'placeholder-token',
    isAuthenticated: true,
});