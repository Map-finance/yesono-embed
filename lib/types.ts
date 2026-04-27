export interface User {
    id: string;
    email: string;
    name: string;
    profileImage?: string;
    wallets?: Array<{
        public_key: string;
        type: string;
        curve: string;
    }>;
}

export interface League {
    id: string | number;
    name: string;
    displayName?: string;
    code?: string;
    country?: string;
    logo?: string;
    isActive?: boolean;
    sortOrder?: number;
}

export interface LoginRequest {
    accessToken: string;
    identityToken: string;
    smartAccountAddress?: string;
    dydxAddress?: string;
}

export interface TokenInfo {
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    expiresIn: number;
    refreshExpiresIn?: number;
}

export interface UserInfo {
    userId: string;
    username: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
    avatarGradient: string;
    bio: string | null;
    smartAccountAddress: string;
    walletAddress: string;
    joinedDate: string;
    profileViews: number;
}

export interface LoginResponse {
    success: boolean;
    token: TokenInfo;
    user: UserInfo;
    isNewUser: boolean;
    message: string;
}

export interface UpdateUserRequest {
    name?: string;
    email?: string;
    profileImage?: string;
}

export interface UserOrder {
    id: number;
    marketId: number;
    optionId: number;
    userId: number;
    email: string;
    amount: number;
    txHash: string;
    address: string;
    chainTimestamp: number;
    status: "SUCCESS" | "PENDING" | "FAIL";
    type: "stake" | "claim";
    createdAt: number;
    username: string;
    avatar: string;
    smartAccount: string;
}

export interface ApiUserOrdersResponse {
    records: UserOrder[];
    total: number;
    page: number;
    size: number;
}

export type Fidelity = "1MIN" | "5MINS" | "15MINS" | "30MINS" | "1HOUR" | "4HOURS" | "1DAY";

export type PriceHistoryResponse = {
  
}
