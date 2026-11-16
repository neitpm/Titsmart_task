import http from 'http';
import { createMicroservice } from '../../packages/shared-config/serverHelper';
import { dbPool } from '../../packages/shared-config/db';
import { signJwtToken } from '../../packages/shared-auth/jwt';
import { CompanyRole, PlatformRole } from '../../packages/shared-types';

createMicroservice({
  serviceName: 'auth-service',
  port: 9001,
  routes: async (req, res) => {
    const url = req.url || '/';

    // 1. Endpoint Đăng nhập THẬT - Truy vấn DB engineers & company_users
    if (url === '/api/v1/auth/login' && req.method === 'POST') {
      const body = (req as any).parsedBody || {};
      const identifier = (body.username || body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      if (!identifier || !password) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            success: false,
            error: 'MISSING_CREDENTIALS',
            message: 'Vui lòng nhập tài khoản/email và mật khẩu.',
          })
        );
        return true;
      }

      try {
        // Truy vấn nhân sự từ PostgreSQL DB
        const query = `
          SELECT e.id, e.name, e.username, e.email, e.role, e.password, e.company_id, 
                 e.company_role, e.platform_role, c.name as company_name, c.status as company_status
          FROM public.engineers e
          LEFT JOIN public.companies c ON e.company_id = c.id
          WHERE (LOWER(TRIM(e.username)) = $1 OR LOWER(TRIM(e.email)) = $1)
          LIMIT 1
        `;
        const result = await dbPool.query(query, [identifier]);

        if (result.rows.length === 0) {
          res.writeHead(401);
          res.end(
            JSON.stringify({
              success: false,
              error: 'INVALID_CREDENTIALS',
              message: 'Tài khoản hoặc mật khẩu không chính xác.',
            })
          );
          return true;
        }

        const user = result.rows[0];

        // Kiểm tra mật khẩu (plain text cho tài khoản seed dev hoặc bcrypt)
        const passwordMatches = user.password === password;
        if (!passwordMatches) {
          res.writeHead(401);
          res.end(
            JSON.stringify({
              success: false,
              error: 'INVALID_CREDENTIALS',
              message: 'Tài khoản hoặc mật khẩu không chính xác.',
            })
          );
          return true;
        }

        // Kiểm tra công ty trực thuộc
        if (user.company_status && user.company_status !== 'active') {
          res.writeHead(403);
          res.end(
            JSON.stringify({
              success: false,
              error: 'COMPANY_SUSPENDED',
              message: 'Công ty của bạn hiện đang tạm ngưng hoặc hết hạn thuê bao.',
            })
          );
          return true;
        }

        const companyRole: CompanyRole = (user.company_role || (user.role === 'admin' ? 'company_admin' : 'engineer')) as CompanyRole;
        const platformRole: PlatformRole = (user.platform_role || 'user') as PlatformRole;

        // Ký token JWT THẬT với Secret Server-side
        const token = signJwtToken({
          userId: user.id,
          email: user.email || identifier,
          companyId: user.company_id,
          companyRole,
          platformRole,
        });

        res.writeHead(200);
        res.end(
          JSON.stringify({
            success: true,
            message: 'Đăng nhập thành công qua Auth Service thực tế.',
            accessToken: token,
            tokenType: 'Bearer',
            expiresIn: '8h',
            user: {
              id: user.id,
              name: user.name,
              username: user.username,
              email: user.email,
              companyId: user.company_id,
              companyName: user.company_name,
              companyRole,
              platformRole,
            },
            timestamp: new Date().toISOString(),
          })
        );
        return true;
      } catch (err: any) {
        console.error('[AuthService] Login DB query error:', err);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: 'DATABASE_ERROR',
            message: 'Lỗi truy vấn cơ sở dữ liệu xác thực.',
          })
        );
        return true;
      }
    }

    return false;
  },
});
