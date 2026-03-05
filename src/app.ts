import express from 'express';
import session from 'express-session';
import Keycloak = require('keycloak-connect');
import { env } from './config/env';
import { cors } from './middleware/cors';
import { createRoutes } from './routes';

const { keycloak: cfg } = env;

const memoryStore = new session.MemoryStore();

const keycloakConfig = {
  realm: cfg.realm,
  'auth-server-url': cfg.serverUrl + '/',
  'ssl-required': 'external',
  resource: cfg.clientId,
  'public-client': true,
  'confidential-port': 0,
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

const app = express();
app.use(express.json());
app.use(cors);
app.use(
  session({
    secret: cfg.sessionSecret,
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
  })
);
app.use(keycloak.middleware());
app.use(createRoutes(keycloak));

export { app, keycloak };
export default app;
