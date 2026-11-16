import { createMicroservice } from '../../packages/shared-config/serverHelper';
import { dbPool } from '../../packages/shared-config/db';

createMicroservice({
  serviceName: 'task-service',
  port: 9005,
  routes: async (req, res, context) => {
    const url = req.url || '';

    // 1. Lấy danh sách công việc THẬT từ PostgreSQL, tự động lọc theo context.companyId
    if (url === '/api/v1/tasks' && req.method === 'GET') {
      try {
        const query = `
          SELECT id, stt, code, name, project_code, volume, unit, progress, status, priority, due_date, company_id, created_at
          FROM public.tasks
          WHERE company_id = $1
          ORDER BY created_at DESC
          LIMIT 100
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
        console.error('[TaskService] DB error:', err);
        res.writeHead(500);
        res.end(
          JSON.stringify({
            success: false,
            error: 'DATABASE_ERROR',
            message: 'Lỗi truy vấn danh sách công việc từ database.',
          })
        );
        return true;
      }
    }

    return false;
  },
});
