import { createMicroservice } from '../../packages/shared-config/serverHelper';
import { dbPool } from '../../packages/shared-config/db';

createMicroservice({
  serviceName: 'project-service',
  port: 9004,
  routes: async (req, res, context) => {
    const url = req.url || '';

    // 1. Lấy danh sách dự án THẬT từ PostgreSQL, tự động lọc theo context.companyId
    if (url === '/api/v1/projects' && req.method === 'GET') {
      try {
        const query = `
          SELECT id, code, name, client, location, contract_value, progress_percent, status, company_id, created_at
          FROM public.projects
          WHERE company_id = $1
          ORDER BY created_at DESC
        `;
        const result = await dbPool.query(query, [context.companyId]);

        res.writeHead(200);
        res.end(
          JSON.stringify({
            success: true,
            companyId: context.companyId,
            total: result.rowCount,
            data: result.rows,
            queriedFromRealDb: true,
            timestamp: new Date().toISOString(),
          })
        );
        return true;
      } catch (err: any) {
        console.error('[ProjectService] DB error:', err);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: 'DATABASE_ERROR',
            message: 'Lỗi truy vấn danh sách dự án từ database.',
          })
        );
        return true;
      }
    }

    return false;
  },
});
