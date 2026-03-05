import { Router, Request, Response } from 'express';

export function createSiteRoutes(keycloak: { protect: () => (req: Request, res: Response, next: () => void) => void }) {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.send(`
      <h1>Bienvenido a la aplicación de prueba de Keycloak</h1>
      <p>Esta es una ruta pública, no requiere autenticación.</p>
      <ul>
        <li><a href="/public">Ruta pública</a></li>
        <li><a href="/protected">Ruta protegida (requiere login)</a></li>
        <li><a href="/admin">Ruta de administrador</a></li>
        <li><a href="/logout">Cerrar sesión</a></li>
      </ul>
    `);
  });

  router.get('/public', (_req: Request, res: Response) => {
    res.send(`
      <h1>Ruta Pública</h1>
      <p>Cualquiera puede acceder a esta ruta sin autenticación.</p>
      <a href="/">Volver al inicio</a>
    `);
  });

  router.get('/protected', keycloak.protect(), (req: Request, res: Response) => {
    const user = (req as any).kauth?.grant?.access_token?.content;
    res.send(`
      <h1>Ruta Protegida</h1>
      <p>¡Bienvenido! Has iniciado sesión correctamente.</p>
      <h2>Información del usuario:</h2>
      <pre>${JSON.stringify(user, null, 2)}</pre>
      <a href="/">Volver al inicio</a> | <a href="/logout">Cerrar sesión</a>
    `);
  });

  router.get('/admin', (keycloak.protect as (role?: string) => import('express').RequestHandler)('admin'), (req: Request, res: Response) => {
    const user = (req as any).kauth?.grant?.access_token?.content;
    res.send(`
      <h1>Panel de Administrador</h1>
      <p>Solo usuarios con rol 'admin' pueden acceder aquí.</p>
      <h2>Información del usuario:</h2>
      <pre>${JSON.stringify(user, null, 2)}</pre>
      <a href="/">Volver al inicio</a> | <a href="/logout">Cerrar sesión</a>
    `);
  });

  router.get('/logout', keycloak.protect(), (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });

  return router;
}
