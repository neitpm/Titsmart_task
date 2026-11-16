import { createMicroservice } from '../../packages/shared-config/serverHelper';

createMicroservice({
  serviceName: 'tenant-service',
  port: 9002,
  routes: (req, res, context) => {
    if (req.url === '/api/v1/tenants/current') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          companyId: context.companyId,
          status: 'active',
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }
    return false;
  },
});
