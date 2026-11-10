import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './authHelper';

export interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
    role: 'admin' | 'customer' | 'rider' | 'supplier';
    name: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  req.user = {
    username: payload.username,
    role: payload.role,
    name: payload.name,
  };
  next();
}

export function requireRole(allowedRoles: ('admin' | 'customer' | 'rider' | 'supplier')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// In-memory sliding-window IP rate limiter
const rateLimitWindowMs = 60 * 1000; // 1 minute
const rateLimitMaxRequests = 120; // Max requests per window (accommodates LAN multi-device usage)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const limitInfo = ipRequestCounts.get(ip);

  if (!limitInfo || now > limitInfo.resetTime) {
    ipRequestCounts.set(ip, {
      count: 1,
      resetTime: now + rateLimitWindowMs,
    });
    next();
  } else {
    limitInfo.count++;
    if (limitInfo.count > rateLimitMaxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  }
}
