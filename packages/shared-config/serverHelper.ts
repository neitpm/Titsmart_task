import http from 'http';
import { UserContext } from '../../packages/shared-types';
import { checkDatabaseHealth } from './db';

/**
 * Lấy Secret giao tiếp nội bộ giữa Gateway và Downstream.
 * BẮT BUỘC có trong process.env, tuyệt đối không cho phép fallback chuỗi mặc định.
 */
export const getInternalGatewaySecret = (): string => {
  const secret = process.env.INTERNAL_GATEWAY_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('[FATAL_SECURITY_CONFIG] INTERNAL_GATEWAY_SECRET biến môi trường chưa được thiết lập. Dịch vụ từ chối khởi chạy!');
  }
  return secret.trim();
};

export const createMicroservice = (options: {
  serviceName: string;
  port: number;
  bindHost?: string;
  routes?: (req: http.IncomingMessage, res: http.ServerResponse, context: UserContext) => Promise<boolean> | boolean;
}) => {
  const startTime = Date.now();

  const parseRequestBody = (req: http.IncomingMessage): Promise<any> => {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
    });
  };

  const server = http.createServer(async (req, res) => {
    // CORS chặt chẽ: chỉ cho phép client app tin cậy
    const origin = req.headers.origin || '';
    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:3001'];
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gateway-signature, x-user-id, x-company-id, x-company-role, x-platform-role');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '/';

    // 1. Standard Healthcheck Endpoint kiểm tra DATABASE THẬT
    if (url === '/health' || url === '/healthz') {
      const isDbOk = await checkDatabaseHealth();
      res.writeHead(isDbOk ? 200 : 503);
      res.end(
        JSON.stringify({
          service: options.serviceName,
          status: isDbOk ? 'healthy' : 'degraded',
          uptime: Math.floor((Date.now() - startTime) / 1000),
          version: '2.0.0-verified',
          database: isDbOk ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Gắn body vào req để route tiện dùng
    (req as any).parsedBody = await parseRequestBody(req);

    // 2. Chống gọi lậu trực tiếp vào Downstream Services (Bypass Gateway)
    // Nếu không phải là api-gateway hoặc auth-service endpoint public (như /api/v1/auth/login),
    // bắt buộc phải có chữ ký `x-gateway-signature` do chính API Gateway đóng dấu.
    if (options.serviceName !== 'api-gateway' && url !== '/api/v1/auth/login') {
      const internalSecret = getInternalGatewaySecret();
      const incomingSignature = req.headers['x-gateway-signature'];
      if (!incomingSignature || incomingSignature !== internalSecret) {
        res.writeHead(403);
        res.end(
          JSON.stringify({
            success: false,
            error: 'FORBIDDEN_DIRECT_CALL',
            message: `Truy cập bị từ chối: Dịch vụ ${options.serviceName} chỉ nhận request đã qua xác thực từ API Gateway nội bộ. Không chấp nhận gọi trực tiếp.`,
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }
    }

    // 3. Trích xuất context tenant do API Gateway tiêm sau khi verify JWT
    const companyId = req.headers['x-company-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    const companyRole = (req.headers['x-company-role'] as any) || 'staff';
    const platformRole = (req.headers['x-platform-role'] as any) || 'user';
    const email = (req.headers['x-user-email'] as string) || '';

    // Ngoại lệ: api-gateway tự nó chịu trách nhiệm verify JWT từ Authorization header
    // hoặc route public /api/v1/auth/login không yêu cầu x-company-id trước
    if (options.serviceName === 'api-gateway' || url === '/api/v1/auth/login') {
      if (options.routes) {
        await options.routes(req, res, { userId: '', email: '', companyId: '', companyRole: 'staff', platformRole: 'user' });
      }
      return;
    }

    if (!companyId) {
      res.writeHead(400);
      res.end(
        JSON.stringify({
          success: false,
          error: 'MISSING_COMPANY_ID',
          message: `Dịch vụ ${options.serviceName} từ chối: Request thiếu tenant context hợp lệ.`,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    const context: UserContext = {
      userId: userId || '',
      email,
      companyId: companyId.trim(),
      companyRole,
      platformRole,
    };

    // 4. Chuyển vào xử lý route nghiệp vụ
    if (options.routes) {
      const handled = await options.routes(req, res, context);
      if (handled) return;
    }

    res.writeHead(200);
    res.end(
      JSON.stringify({
        success: true,
        service: options.serviceName,
        tenantContext: context,
        timestamp: new Date().toISOString(),
      })
    );
  });

  // Bind vào loopback hoặc host được chỉ định
  const bindHost = options.bindHost || '0.0.0.0';
  server.listen(options.port, bindHost, () => {
    console.log(`[${options.serviceName}] Microservice listening on ${bindHost}:${options.port}`);
  });

  return server;
};
