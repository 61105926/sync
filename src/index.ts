import { app } from './app';
import { env } from './config/env';
import './jobs/scheduler';

const port = env.port;

app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
  console.log(`Keycloak: ${env.keycloak.serverUrl}`);
  console.log(`Realm: ${env.keycloak.realm}`);
  console.log(`Cliente: ${env.keycloak.clientId}`);
  console.log(`API: POST http://localhost:${port}/change-password { username, currentPassword, newPassword }`);
});
