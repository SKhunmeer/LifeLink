import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthTokenPayload } from '../services/authService.js';
import { UserRole } from '@bloodlink/shared';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload) {
      req.user = payload;
      return next();
    }
  }

  return res.status(401).json({ error: 'Authentication required. Invalid or expired token.' });
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access forbidden. Required role: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}.`
      });
    }

    next();
  };
}
