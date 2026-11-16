import { createMicroservice } from '../../packages/shared-config/serverHelper';

createMicroservice({
  serviceName: 'hr-service',
  port: 9007,
  routes: (req, res, context) => {
    if (req.url === '/api/v1/hr/engineers') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          companyId: context.companyId,
          message: 'HR Service skeleton: manages personnel scoped to context.companyId.',
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }
    return false;
  },
});
