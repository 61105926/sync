import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import type { KeycloakUser } from '../types/keycloak';

const { keycloak: cfg } = env;
const KEYCLOAK_BASE = cfg.serverUrl;
const REALM = cfg.realm;
const CLIENT_ID = cfg.clientId;
const CLIENT_SECRET = cfg.clientSecret;
const ADMIN_USER = cfg.adminUser;
const ADMIN_PASSWORD = cfg.adminPassword ?? '';

export async function getAdminToken(): Promise<string> {
  if (CLIENT_SECRET) {
    const url = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    const res = await axios.post<TokenRes>(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    return res.data.access_token;
  }
  if (!ADMIN_USER || !ADMIN_PASSWORD) {
    throw new Error('Configura KEYCLOAK_ADMIN + KEYCLOAK_ADMIN_PASSWORD o KEYCLOAK_CLIENT_SECRET en .env');
  }
  try {
    const url = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
    });
    const res = await axios.post<TokenRes>(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    if (res.data?.access_token) return res.data.access_token;
  } catch {
    // ignore
  }
  const url = `${KEYCLOAK_BASE}/realms/master/protocol/openid-connect/token`;
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: ADMIN_USER,
    password: ADMIN_PASSWORD,
  });
  const res = await axios.post<TokenRes>(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  if (!res.data?.access_token) {
    throw new Error((res.data as { error_description?: string })?.error_description ?? 'No se pudo obtener token de administrador');
  }
  return res.data.access_token;
}

interface TokenRes {
  access_token: string;
  error_description?: string;
}

export function createAdminApi(token: string): AxiosInstance {
  return axios.create({
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
    validateStatus: () => true,
  });
}

export async function findUserByUsername(api: AxiosInstance, username: string): Promise<KeycloakUser | null> {
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users`;
  const res = await api.get<KeycloakUser[]>(url, {
    params: { username, exact: true },
    timeout: 10000,
  });
  const users = res.data ?? [];
  return users.length ? users[0] : null;
}

export async function verifyCurrentPassword(username: string, currentPassword: string): Promise<boolean> {
  const url = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`;
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    username,
    password: currentPassword,
  });
  if (CLIENT_SECRET) params.append('client_secret', CLIENT_SECRET);
  const r = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
    validateStatus: () => true,
  });

  if (r.status === 200) return true; // Token obtenido: contraseña correcta

  // Log de ayuda para depurar respuestas de Keycloak
  // (se parece al servidor JS standalone que compartiste)
  console.log(
    '[verifyCurrentPassword] status=',
    r.status,
    'data=',
    JSON.stringify(r.data)
  );

  const desc = String(
    (r.data as { error_description?: string })?.error_description ??
      (r.data as { error?: string })?.error ??
      ''
  ).toLowerCase();

  const isTempPasswordBlock =
    desc.includes('not fully set up') ||
    desc.includes('account is not fully set up') ||
    desc.includes('user is not fully set up') ||
    desc.includes('required action') ||
    desc.includes('update password') ||
    (desc.includes('temporary') && desc.includes('password')) ||
    (desc.includes('invalid_grant') && desc.includes('account'));

  // Keycloak puede responder 400 o 401 cuando la contraseña es correcta pero temporal
  if ((r.status === 400 || r.status === 401) && isTempPasswordBlock) {
    return true;
  }

  // Credenciales incorrectas
  return false;
}

export async function setUserPassword(
  api: AxiosInstance,
  userId: string,
  newPassword: string,
  temporary: boolean = false
): Promise<void> {
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users/${userId}/reset-password`;
  await api.put(url, {
    type: 'password',
    value: newPassword,
    temporary,
  });
}

export async function removeRequiredAction(
  api: AxiosInstance,
  userId: string,
  action: string = 'UPDATE_PASSWORD'
): Promise<void> {
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users/${userId}`;
  const res = await api.get<KeycloakUser>(url);
  const user = res.data;
  if (!user) throw new Error('Usuario no encontrado');
  const requiredActions = (user.requiredActions ?? []).filter((a) => a !== action);
  await api.put(url, { ...user, requiredActions });
}
