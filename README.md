# Keycloak + Node (TypeScript)

Aplicación en TypeScript con Express y Keycloak: rutas protegidas, API de cambio de contraseña y script de sincronización de usuarios desde la API Survey.

## Estructura

```
src/
  config/
    env.ts           # Variables de entorno
  middleware/
    cors.ts          # CORS para API (ej. Flutter)
  routes/
    index.ts         # Montaje de rutas
    siteRoutes.ts    # /, /public, /protected, /admin, /logout
    changePasswordRoutes.ts  # POST /change-password
  services/
    keycloakAdmin.ts # Token admin, buscar usuario, reset password
  scripts/
    sync-keycloak-users.ts  # Sincronizar usuarios Survey → Keycloak
  types/
    keycloak.ts
    keycloak-connect.d.ts
    sync.ts
  app.ts             # Express + Keycloak
  index.ts           # Entrada del servidor
```

## Comandos

| Comando | Descripción |
|--------|-------------|
| `npm run dev` | Servidor en desarrollo (ts-node-dev) |
| `npm run build` | Compilar TypeScript → `dist/` |
| `npm start` | Servidor en producción (`node dist/index.js`) |
| `npm run sync-users` | Sincronizar empleados (Survey → Keycloak) |
| `npm run sync-users-dry-run` | Solo probar Survey, sin Keycloak |
| `npm run delete-old-users` | Borrar usuarios con username numérico (antiguos empID) |

## Configuración (.env)

- `KEYCLOAK_SERVER_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` (o `KEYCLOAK_CLIENT_SECRET`)
- `SURVEY_API_URL` (para sync, opcional)
- `KEYCLOAK_TEMP_PASSWORD` (contraseña por defecto nuevos usuarios, ej. Minoil123)

## API

- **POST /change-password**  
  Body: `{ "username", "currentPassword", "newPassword" }`  
  Para que la app Flutter (u otra) permita cambiar contraseña temporal en Keycloak.
