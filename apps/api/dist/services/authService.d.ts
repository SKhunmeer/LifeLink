import { UserProfile, UserRole } from '@bloodlink/shared';
export interface AuthTokenPayload {
    userId: string;
    email: string;
    role: UserRole;
    fullName: string;
}
export declare function generateToken(payload: AuthTokenPayload): string;
export declare function verifyToken(token: string): AuthTokenPayload | null;
export declare function getUserById(id: string): UserProfile | null;
export declare function getUserByEmail(email: string): any;
export declare function registerUser(params: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: UserRole;
    bloodGroup?: string;
    hospitalId?: string;
    approxCity?: string;
    lat?: number;
    lng?: number;
    notificationConsent?: boolean;
}): Promise<{
    user: UserProfile;
    token: string;
}>;
export declare function loginUser(email: string, password?: string): Promise<{
    user: UserProfile;
    token: string;
}>;
export declare function getAllDemoAccounts(): any[];
