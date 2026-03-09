import dotenv from 'dotenv';

dotenv.config();

const get = (key: string, fallback: string = ''): string =>
  (process.env[key] ?? fallback).trim();

export const env = {
  port: parseInt(process.env.NODE_PORT ?? '3000', 10),
  keycloak: {
    serverUrl: (process.env.KEYCLOAK_SERVER_URL ?? '').replace(/\/$/, ''),
    realm: get('KEYCLOAK_REALM'),
    clientId: get('KEYCLOAK_CLIENT_ID'),
    clientSecret: get('KEYCLOAK_CLIENT_SECRET'),
    adminUser: get('KEYCLOAK_ADMIN'),
    adminPassword: get('KEYCLOAK_ADMIN_PASSWORD'),
    sessionSecret: get('SESSION_SECRET'),
  },
} as const;
