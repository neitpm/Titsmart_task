import { createMicroservice } from '../../packages/shared-config/serverHelper';

createMicroservice({
  serviceName: 'finance-service',
  port: 9006,
  routes: (req, res, context) => {
    if (req.url === '/api/v1/finance/expenses') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          companyId: context.companyId,
          workflow: '5-step-approval-process',
          message: 'Finance Service skeleton: strictly manages fund requests for context.companyId.',
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }
    return false;
  },
});
