import { Request, Response, NextFunction } from 'express';
import { AuthTokenPayload } from '../services/authService.js';
import { UserRole } from '@bloodlink/shared';
export interface AuthenticatedRequest extends Request {
    user?: AuthTokenPayload;
}
export declare function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function requireRole(allowedRoles: UserRole[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
