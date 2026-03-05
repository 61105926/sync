import { Router } from 'express';
import { createSiteRoutes } from './siteRoutes';
import changePasswordRoutes from './changePasswordRoutes';

export function createRoutes(keycloak: { protect: (role?: string) => (req: any, res: any, next: () => void) => void }): Router {
  const router = Router();
  router.use(createSiteRoutes(keycloak));
  router.use(changePasswordRoutes);
  return router;
}
