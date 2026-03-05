import dotenv from 'dotenv';
dotenv.config();

// Función que exige que la variable exista, si no, detiene la app
const getRequired = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[CRITICAL] Falta la variable de entorno obligatoria: ${key}`);
  }
  return value.trim();
};

// Función para variables opcionales con fallback
const getOptional = (key: string, fallback: string): string => {
  const value = process.env[key];
  return (value !== undefined && value.trim() !== '') ? value.trim() : fallback;
};

export const env = {
  port: parseInt(getOptional('NODE_PORT', '3000'), 10),
  keycloak: {
    serverUrl: getOptional('KEYCLOAK_SERVER_URL', 'http://localhost:8080').replace(/\/$/, ''),
    realm: getOptional('KEYCLOAK_REALM', 'minoil'),
    clientId: getOptional('KEYCLOAK_CLIENT_ID', 'minoil-client'),

    // VARIABLES CRÍTICAS (Sin valores por defecto, deben estar sí o sí en tu .env)
    clientSecret: getOptional('KEYCLOAK_CLIENT_SECRET', ''), // Opcional dependiendo de tu config
    adminUser: getRequired('KEYCLOAK_ADMIN'),
    adminPassword: getRequired('KEYCLOAK_ADMIN_PASSWORD'),
    sessionSecret: getRequired('SESSION_SECRET'),
  },
} as const;
