import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { CompanyRole, PlatformRole } from '../shared-types';

export interface TokenPayload {
  userId: string;
  email: string;
  companyId: string;
  companyRole: CompanyRole;
  platformRole: PlatformRole;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('[FATAL_SECURITY_CONFIG] JWT_SECRET biến môi trường bắt buộc chưa được thiết lập. Hệ thống từ chối chạy với secret fallback!');
  }
  if (secret.length < 32) {
    throw new Error('[FATAL_SECURITY_CONFIG] JWT_SECRET quá ngắn. Bắt buộc có độ dài tối thiểu 32 ký tự.');
  }
  return secret.trim();
};

const JWT_ISSUER = 'workcore-auth-service';
const JWT_AUDIENCE = 'workcore-client-ecosystem';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '8h') as any;

/**
 * Ký và phát hành Access Token chuẩn JWT với Issuer, Audience và Algorithm chỉ định
 */
export const signJwtToken = (payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string => {
  const secret = getJwtSecret();
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
  return jwt.sign(payload, secret, options);
};

/**
 * Xác thực và giải mã JWT token server-side với thuật toán và Issuer/Audience chặt chẽ
 */
export const verifyJwtToken = (token: string): TokenPayload => {
  const secret = getJwtSecret();
  const options: VerifyOptions = {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
  return jwt.verify(token, secret, options) as TokenPayload;
};

/**
 * Trích xuất token từ header Authorization: Bearer <token>
 */
export const extractBearerToken = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7).trim();
};
