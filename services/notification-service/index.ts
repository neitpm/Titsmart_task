import { createMicroservice } from '../../packages/shared-config/serverHelper';

createMicroservice({
  serviceName: 'notification-service',
  port: 9009,
  routes: (req, res, context) => {
    if (req.url === '/api/v1/notifications') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          companyId: context.companyId,
          message: 'Notification Service skeleton: handles alerts scoped to context.companyId.',
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }
    return false;
  },
});
