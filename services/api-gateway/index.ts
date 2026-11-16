import http from 'http';
import { createMicroservice, getInternalGatewaySecret } from '../../packages/shared-config/serverHelper';
import { verifyJwtToken, extractBearerToken, TokenPayload } from '../../packages/shared-auth/jwt';
import { dbPool } from '../../packages/shared-config/db';

const SERVICE_ROUTING: Record<string, { targetPort: number; requiredModule?: string }> = {
  '/api/v1/auth': { targetPort: 9001 },
  '/api/v1/tenants': { targetPort: 9002 },
  '/api/v1/entitlements': { targetPort: 9003 },
  '/api/v1/projects': { targetPort: 9004, requiredModule: 'PROJECTS' },
  '/api/v1/tasks': { targetPort: 9005, requiredModule: 'TASKS' },
  '/api/v1/finance': { targetPort: 9006, requiredModule: 'EXPENSES' },
  '/api/v1/hr': { targetPort: 9007, requiredModule: 'PERSONNEL' },
  '/api/v1/documents': { targetPort: 9008, requiredModule: 'DOCUMENTS' },
  '/api/v1/notifications': { targetPort: 9009 },
};

/**
 * Kiểm tra trạng thái kích hoạt thực tế của User và Company trong Database
 */
const verifyUserAndCompanyActive = async (userId: string, companyId: string): Promise<{ ok: boolean; reason?: string }> => {
  try {
    const query = `
      SELECT e.is_active as user_active, e.company_id, c.status as company_status
      FROM public.engineers e
      JOIN public.companies c ON c.id = e.company_id
      WHERE e.id = $1 AND c.id = $2
      LIMIT 1
    `;
    const res = await dbPool.query(query, [userId, companyId]);
    if (res.rows.length === 0) {
      return { ok: false, reason: 'Người dùng hoặc công ty không tồn tại trên hệ thống.' };
    }
    const row = res.rows[0];
    if (row.user_active !== true) {
      return { ok: false, reason: 'Tài khoản người dùng đã bị vô hiệu hóa hoặc khóa.' };
    }
    if (row.company_status !== 'active') {
      return { ok: false, reason: 'Công ty hiện đang bị tạm ngưng hoặc đã hết hạn thuê bao.' };
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[Gateway-ActiveCheck] DB error:', err);
    return { ok: false, reason: 'Lỗi kiểm tra tính hợp lệ của người dùng trong DB.' };
  }
};

/**
 * Kiểm tra quyền module trực tiếp từ DB
 */
const checkModuleAccess = async (companyId: string, moduleKey?: string): Promise<boolean> => {
  if (!moduleKey) return true;
  try {
    const query = `
      SELECT cm.is_enabled, cm.expiry_date, c.plan, c.status
      FROM public.companies c
      LEFT JOIN public.company_modules cm ON cm.company_id = c.id AND cm.module_id = $2
      WHERE c.id = $1
      LIMIT 1
    `;
    const res = await dbPool.query(query, [companyId, moduleKey]);
    if (res.rows.length === 0) return false;
    const comp = res.rows[0];
    if (comp.status !== 'active') return false;
    if (comp.is_enabled === true) {
      if (comp.expiry_date && new Date(comp.expiry_date) < new Date()) return false;
      return true;
    }
    // Gói enterprise cho phép toàn bộ module
    return comp.plan === 'enterprise';
  } catch (err) {
    console.error('[Gateway-Entitlement] DB check failed:', err);
    return false;
  }
};

/**
 * Proxy chuyển tiếp request từ Gateway tới downstream service
 */
const proxyToDownstream = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  targetPort: number,
  tokenPayload?: TokenPayload
) => {
  const secret = getInternalGatewaySecret();

  const options: http.RequestOptions = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${targetPort}`,
      // ĐÓNG DẤU CHỮ KÝ NỘI BỘ BẮT BUỘC TỪ GATEWAY:
      'x-gateway-signature': secret,
      // TIÊM THÔNG TIN IDENTITY VÀ TENANT ĐÃ ĐƯỢC VERIFY TỪ JWT TOKEN:
      ...(tokenPayload
        ? {
            'x-user-id': tokenPayload.userId,
            'x-company-id': tokenPayload.companyId,
            'x-company-role': tokenPayload.companyRole,
            'x-platform-role': tokenPayload.platformRole,
            'x-user-email': tokenPayload.email,
          }
        : {}),
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Gateway] Error proxying to port ${targetPort}:`, err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: 'BAD_GATEWAY',
        message: `Không thể kết nối tới microservice nội bộ trên cổng ${targetPort}.`,
      })
    );
  });

  req.pipe(proxyReq);
};

createMicroservice({
  serviceName: 'api-gateway',
  port: 9000,
  routes: async (req, res) => {
    const url = req.url || '/';

    // 1. Cho phép bypass xác thực cho route login công khai
    if (url === '/api/v1/auth/login' && req.method === 'POST') {
      proxyToDownstream(req, res, 9001);
      return true;
    }

    // 2. Tìm route downstream phù hợp
    let matchedRoute: { prefix: string; targetPort: number; requiredModule?: string } | null = null;
    for (const [prefix, info] of Object.entries(SERVICE_ROUTING)) {
      if (url.startsWith(prefix)) {
        matchedRoute = { prefix, ...info };
        break;
      }
    }

    if (!matchedRoute) {
      return false; // Route không xác định -> trả về 404 mặc định
    }

    // 3. BẮT BUỘC XÁC THỰC JWT SERVER-SIDE:
    // Kiểm tra Issuer, Audience, Algorithm, Signature và Expiration
    const authHeader = req.headers['authorization'];
    const token = extractBearerToken(authHeader);

    if (!token) {
      res.writeHead(401);
      res.end(
        JSON.stringify({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'API Gateway từ chối: Thiếu Authorization Bearer token hợp lệ. Không chấp nhận header tenant tự chế.',
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }

    let tokenPayload: TokenPayload;
    try {
      tokenPayload = verifyJwtToken(token);
    } catch (err: any) {
      res.writeHead(401);
      res.end(
        JSON.stringify({
          success: false,
          error: 'INVALID_TOKEN',
          message: `Token xác thực không hợp lệ: ${err.message}`,
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }

    // 4. KIỂM TRA CHẶT TÍNH ACTIVE CỦA USER VÀ COMPANY TRONG DB:
    const activeCheck = await verifyUserAndCompanyActive(tokenPayload.userId, tokenPayload.companyId);
    if (!activeCheck.ok) {
      res.writeHead(403);
      res.end(
        JSON.stringify({
          success: false,
          error: 'ACCOUNT_OR_COMPANY_INACTIVE',
          message: activeCheck.reason,
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }

    // 5. KIỂM TRA QUYỀN THUÊ BAO MODULE THẬT TỪ DATABASE:
    if (matchedRoute.requiredModule) {
      const isAllowed = await checkModuleAccess(tokenPayload.companyId, matchedRoute.requiredModule);
      if (!isAllowed) {
        res.writeHead(403);
        res.end(
          JSON.stringify({
            success: false,
            error: 'MODULE_NOT_ENTITLED',
            message: `Công ty của bạn chưa thuê hoặc đã hết hạn module [${matchedRoute.requiredModule}]. Vui lòng liên hệ quản trị nền tảng.`,
            companyId: tokenPayload.companyId,
            requiredModule: matchedRoute.requiredModule,
            timestamp: new Date().toISOString(),
          })
        );
        return true;
      }
    }

    // 6. Chuyển tiếp an toàn tới Downstream Microservice, đóng dấu signature và tenant context
    proxyToDownstream(req, res, matchedRoute.targetPort, tokenPayload);
    return true;
  },
});
