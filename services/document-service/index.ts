import { createMicroservice } from '../../packages/shared-config/serverHelper';

createMicroservice({
  serviceName: 'document-service',
  port: 9008,
  routes: (req, res, context) => {
    if (req.url === '/api/v1/documents') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          companyId: context.companyId,
          message: 'Document & Storage Service skeleton: enforces storage limits for context.companyId.',
          timestamp: new Date().toISOString(),
        })
      );
      return true;
    }
    return false;
  },
});
