import { createMicroservice } from '../../packages/shared-config/serverHelper';
import { dbPool } from '../../packages/shared-config/db';

createMicroservice({
  serviceName: 'entitlement-service',
  port: 9003,
  routes: async (req, res, context) => {
    const url = req.url || '';

    // 1. Kiểm tra quyền module THẬT từ bảng company_modules và modules trong Database
    if (url.startsWith('/api/v1/entitlements/check')) {
      const parsedUrl = new URL(url, 'http://localhost:9003');
      const moduleKey = (parsedUrl.searchParams.get('module') || '').trim();

      if (!moduleKey) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            success: false,
            error: 'MISSING_MODULE_KEY',
            message: 'Tham số module là bắt buộc để kiểm tra quyền.',
          })
        );
        return true;
      }

      try {
        // Truy vấn database xem module có tồn tại và công ty có được kích hoạt còn hạn hay không
        const query = `
          SELECT cm.is_enabled, cm.start_date, cm.expiry_date, c.plan, c.status as company_status
          FROM public.companies c
          LEFT JOIN public.company_modules cm ON cm.company_id = c.id AND cm.module_id = $2
          WHERE c.id = $1
          LIMIT 1
        `;
        const result = await dbPool.query(query, [context.companyId, moduleKey]);

        if (result.rows.length === 0) {
          res.writeHead(404);
          res.end(
            JSON.stringify({
              success: false,
              hasAccess: false,
              error: 'COMPANY_NOT_FOUND',
              message: 'Không tìm thấy thông tin công ty.',
            })
          );
          return true;
        }

        const comp = result.rows[0];
        const isCompanyActive = comp.company_status === 'active';
        
        // Mặc định gói Enterprise/Professional kích hoạt các module lõi, hoặc xem bảng company_modules
        let hasAccess = false;
        if (isCompanyActive) {
          if (comp.is_enabled === true) {
            const now = new Date();
            const notExpired = !comp.expiry_date || new Date(comp.expiry_date) >= now;
            hasAccess = notExpired;
          } else if (comp.plan === 'enterprise') {
            // Enterprise mặc định có quyền toàn bộ module lõi
            hasAccess = true;
          }
        }

        res.writeHead(200);
        res.end(
          JSON.stringify({
            success: true,
            companyId: context.companyId,
            module: moduleKey,
            hasAccess,
            plan: comp.plan,
            companyStatus: comp.company_status,
            checkedAtDb: true,
            timestamp: new Date().toISOString(),
          })
        );
        return true;
      } catch (err) {
        console.error('[EntitlementService] DB check error:', err);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: 'DATABASE_ERROR',
            message: 'Lỗi kiểm tra quyền thuê bao trong database.',
          })
        );
        return true;
      }
    }

    return false;
  },
});
