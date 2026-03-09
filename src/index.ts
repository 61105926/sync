import { app } from './app';
import { env } from './config/env';
import './jobs/scheduler';

const port = env.port;

app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor ejecutándose en http://0.0.0.0:${port}`);
  console.log(`Keycloak: ${env.keycloak.serverUrl}`);
  console.log(`Realm: ${env.keycloak.realm}`);
  console.log(`Cliente: ${env.keycloak.clientId}`);
  console.log(`API: POST http://0.0.0.0:${port}/change-password`);
});