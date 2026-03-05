/**
 * Sincroniza usuarios desde la API Survey hacia Keycloak.
 * Uso: npm run sync-users | npm run delete-old-users | npm run sync-users -- --dry-run
 */
import dotenv from 'dotenv';
import axios, { AxiosInstance } from 'axios';
import type { Empleado, SurveyApiItem } from '../types/sync';
import type { KeycloakUser } from '../types/keycloak';

dotenv.config();

const SURVEY_API_URL = (process.env.SURVEY_API_URL ?? 'http://190.171.225.68:8006/api/survey').trim();
const KEYCLOAK_BASE = (process.env.KEYCLOAK_SERVER_URL ?? 'https://auth.minoil.com.bo/').replace(/\/$/, '');
const REALM = process.env.KEYCLOAK_REALM ?? 'minoil';
const ADMIN_USER = (process.env.KEYCLOAK_ADMIN ?? 'admin').trim();
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? '';
const ADMIN_TOKEN_STATIC = (process.env.KEYCLOAK_ADMIN_TOKEN ?? '').trim();
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? 'minoil-client';
const CLIENT_SECRET = (process.env.KEYCLOAK_CLIENT_SECRET ?? '').trim();
const ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'admin-cli';
const MASTER_REALM = 'master';
const DEFAULT_PASSWORD = process.env.KEYCLOAK_TEMP_PASSWORD ?? 'Minoil123';

const CARGO_ROLES: Record<string, string[]> = {
  Chofer: ['ROLE_LOGISTICA', 'VIEW_DELIVERIES'],
  Mercaderista: ['ROLE_LOGISTICA'],
  'Mercaderista E Impul': ['ROLE_LOGISTICA'],
  'Ejecutivo De Ventas': ['ROLE_VENTAS'],
  'Ejecutivo de ventas': ['ROLE_VENTAS'],
  'Ejecutivo de Ventas': ['ROLE_VENTAS'],
  'Jefe reg. de distrib': ['ROLE_LOGISTICA', 'ROLE_VENTAS'],
  'Supervisor de carter': ['ROLE_VENTAS'],
  'Category Manager': ['ROLE_VENTAS'],
  'Jefe de Contabilidad': ['ROLE_ADMIN'],
  'Analista de RRHH': ['ROLE_ADMIN'],
  'Gerente de sistemas': ['ROLE_ADMIN'],
  'Jefe Adm. Regional': ['ROLE_ADMIN'],
  'Gerente General': ['ROLE_ADMIN'],
  'Aux. De Auditoria': ['ROLE_ADMIN'],
  'Aux. de auditoria': ['ROLE_ADMIN'],
  Picking: ['ROLE_LOGISTICA'],
  Fiambrera: ['ROLE_LOGISTICA'],
  Reponedor: ['ROLE_LOGISTICA'],
  Estibador: ['ROLE_LOGISTICA'],
  Gestionador: ['ROLE_VENTAS'],
  Secretaria: ['ROLE_ADMIN'],
  'Encargado De Manteni': ['ROLE_LOGISTICA'],
  'Encargado de linea': ['ROLE_LOGISTICA'],
  'Encargado de Linea': ['ROLE_LOGISTICA'],
};
const DEFAULT_ROLES = ['user'];

function getRolesForCargo(cargo: string | undefined): string[] {
  const normalized = (cargo ?? '').trim();
  return CARGO_ROLES[normalized] ?? DEFAULT_ROLES;
}

/** Username en Keycloak: prioriza AD si existe, caso contrario el CI */
function getUsername(emp: Empleado): string {
  if (emp.AD && typeof emp.AD === 'string' && emp.AD.trim() !== '') {
    return emp.AD.trim();
  }
  return String(emp.ci ?? '').trim();
}

function splitFullName(fullName: string | undefined): { firstName: string; lastName: string } {
  const s = (fullName ?? '').trim();
  const i = s.indexOf(' ');
  if (i <= 0) return { firstName: s || '', lastName: '' };
  return { firstName: s.slice(0, i), lastName: s.slice(i + 1).trim() };
}

async function getTokenClientCredentials(): Promise<string> {
  const url = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await axios.post<{ access_token: string }>(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  return res.data.access_token;
}

async function getTokenRealmAdmin(): Promise<string> {
  const url = `${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token`;
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: CLIENT_ID,
    username: ADMIN_USER,
    password: ADMIN_PASSWORD,
  });
  const res = await axios.post<{ access_token: string }>(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  return res.data.access_token;
}

async function getTokenMasterAdmin(): Promise<string> {
  const url = `${KEYCLOAK_BASE}/realms/${MASTER_REALM}/protocol/openid-connect/token`;
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: ADMIN_CLIENT_ID,
    username: ADMIN_USER,
    password: ADMIN_PASSWORD,
  });
  const res = await axios.post<{ access_token: string }>(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  return res.data.access_token;
}

async function getAdminToken(): Promise<string> {
  if (ADMIN_TOKEN_STATIC) return ADMIN_TOKEN_STATIC;
  if (CLIENT_SECRET.trim()) return getTokenClientCredentials();
  try {
    return await getTokenRealmAdmin();
  } catch (e: any) {
    if (e?.response?.status === 401) {
      try {
        return await getTokenMasterAdmin();
      } catch (e2) {
        throw e2;
      }
    }
    throw e;
  }
}

async function fetchEmpleados(): Promise<Empleado[]> {
  const res = await axios.get<SurveyApiItem[] | Empleado[]>(SURVEY_API_URL, { timeout: 30000 });
  const list = Array.isArray(res.data) ? res.data : [];
  const raw = list.map((item: SurveyApiItem | Empleado): Empleado | undefined => {
    if ('data' in item && item.data) return item.data as Empleado;
    return item as Empleado;
  });
  // Solo sincronizar usuarios que tengan CI (si no hay CI, no se crea)
  return raw.filter((e): e is Empleado => !!e && (e.ci != null && String(e.ci).trim() !== ''));
}

async function findUser(api: AxiosInstance, username: string): Promise<KeycloakUser | null> {
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users`;
  const r = await api.get<KeycloakUser[]>(url, { params: { username, exact: true } });
  return r.data?.length ? r.data[0] : null;
}

async function createUser(api: AxiosInstance, emp: Empleado): Promise<string | null> {
  const username = getUsername(emp);
  const { firstName, lastName } = splitFullName(emp.fullName);
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users`;
  const body = {
    username,
    enabled: true,
    firstName: firstName || username,
    lastName: lastName || '',
    attributes: {
      ci: [emp.ci].filter(Boolean),
      phone: [emp.phone].filter(Boolean),
      regional: [emp.regional].filter(Boolean),
      cargo: [emp.cargo].filter(Boolean),
      empID: [String(emp.empID)].filter(Boolean),
    },
    credentials: [{ type: 'password', value: DEFAULT_PASSWORD, temporary: true }],
  };
  const res = await api.post(url, body);
  const location = (res.headers?.location ?? res.headers?.Location) as string | undefined;
  const id = location ? location.replace(/.*\//, '').replace(/\?.*$/, '') : null;
  return id;
}

async function updateUser(api: AxiosInstance, userId: string, emp: Empleado): Promise<void> {
  const { firstName, lastName } = splitFullName(emp.fullName);
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users/${userId}`;

  // Obtener el usuario actual para preservar sus atributos y propiedades existentes
  // (CRÍTICO: Para usuarios de Active Directory (Federated), si no se envían de vuelta campos
  // como 'federationLink', Keycloak ignora o bloquea la actualización de atributos externos).
  const currentUserRes = await api.get<KeycloakUser>(url);
  const currentUser = currentUserRes.data;
  const existingAttributes = currentUser.attributes || {};

  // Formar el payload de actualización MERGEANDO con el usuario actual entero.
  const payload = {
    ...currentUser, // <-- enviamos todo tal cual como llegó de Keycloak primero
    firstName: firstName || currentUser.firstName || '',
    lastName: lastName || currentUser.lastName || '',
    enabled: true,
    attributes: {
      ...existingAttributes, // <-- LDAP_ID y LDAP_ENTRY_DN se conservan
      ci: [String(emp.ci || '')].filter(Boolean),
      phone: [emp.phone].filter(Boolean),
      regional: [emp.regional].filter(Boolean),
      cargo: [emp.cargo].filter(Boolean),
      empID: [String(emp.empID || '')].filter(Boolean),
    },
  };

  await api.put(url, payload);
}

async function assignRealmRoles(api: AxiosInstance, userId: string, roleNames: string[]): Promise<void> {
  if (!roleNames.length) return;
  const rolesUrl = `${KEYCLOAK_BASE}/admin/realms/${REALM}/roles`;
  const allRoles = await api.get<{ id: string; name: string }[]>(rolesUrl);
  const toAssign = allRoles.data.filter((r) => roleNames.includes(r.name));
  if (!toAssign.length) return;
  const mappingUrl = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`;
  await api.post(mappingUrl, toAssign);
}

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_OLD = process.argv.includes('--delete-old');

function isOldUsername(username: unknown): boolean {
  return typeof username === 'string' && /^\d+$/.test(username.trim());
}

async function deleteOldUsers(api: AxiosInstance): Promise<number> {
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users`;
  const maxPerPage = 500;
  let first = 0;
  let totalDeleted = 0;
  let list: { data: KeycloakUser[] };
  do {
    list = await api.get<KeycloakUser[]>(url, { params: { first, max: maxPerPage } });
    const users = list.data ?? [];
    for (const user of users) {
      if (!isOldUsername(user.username)) continue;
      if (user.federationLink) continue; // No borrar si es cuenta de Active Directory (federada)
      try {
        await api.delete(`${KEYCLOAK_BASE}/admin/realms/${REALM}/users/${user.id}`);
        totalDeleted++;
        console.log('  Borrado (username numérico):', user.username, user.firstName ?? user.username);
      } catch (err: any) {
        console.error('  Error al borrar', user.username, err?.response?.data?.errorMessage ?? err?.message);
      }
    }
    first += users.length;
  } while (list.data && list.data.length === maxPerPage);
  return totalDeleted;
}

/** Borra de Keycloak los usuarios cuyo username NO está en la lista de la API (solo quedan usuarios de la API). No toca al usuario admin. */
async function pruneUsersNotInApi(api: AxiosInstance, validUsernames: Set<string>): Promise<number> {
  const url = `${KEYCLOAK_BASE}/admin/realms/${REALM}/users`;
  const maxPerPage = 500;
  let first = 0;
  let totalDeleted = 0;
  let list: { data: KeycloakUser[] };
  do {
    list = await api.get<KeycloakUser[]>(url, { params: { first, max: maxPerPage } });
    const users = list.data ?? [];
    for (const user of users) {
      const uname = (user.username ?? '').trim();
      if (!uname) continue;
      if (validUsernames.has(uname)) continue;
      if (uname === ADMIN_USER) continue; // no borrar al admin que usa el script

      // Evitar borrar usuarios importados de Active Directory (federados)
      // o usuarios creados manualmente (que no tienen el atributo 'ci' que nuestro script añade)
      const isFederated = !!user.federationLink;
      const isApiUser = !!(user.attributes && user.attributes.ci && user.attributes.ci.length > 0);

      if (isFederated || !isApiUser) {
        continue; // Es un usuario de AD o un admin/manual, ignorarlo
      }

      try {
        await api.delete(`${KEYCLOAK_BASE}/admin/realms/${REALM}/users/${user.id}`);
        totalDeleted++;
        console.log('  Eliminado (no está en API):', uname, user.firstName ?? '');
      } catch (err: any) {
        console.error('  Error al eliminar', uname, err?.response?.data?.errorMessage ?? err?.message);
      }
    }
    first += users.length;
  } while (list.data && list.data.length === maxPerPage);
  return totalDeleted;
}

function printCurlTokenHint(): void {
  console.error('');
  console.error('Para obtener un token: KEYCLOAK_ADMIN_TOKEN en .env o ejecutá:');
  console.error(`  curl -s -X POST "${KEYCLOAK_BASE}/realms/${REALM}/protocol/openid-connect/token" \\`);
  console.error(`    -d "grant_type=password" -d "client_id=${CLIENT_ID}" -d "username=USER" -d "password=PASS" \\`);
  console.error(`    -H "Content-Type: application/x-www-form-urlencoded" | jq -r .access_token`);
}

async function main(): Promise<void> {
  console.log('Configuración:');
  console.log('  Survey API:', SURVEY_API_URL);
  console.log('  Keycloak: ', KEYCLOAK_BASE);
  console.log('  Realm:    ', REALM);
  const authDesc = ADMIN_TOKEN_STATIC
    ? 'Token (KEYCLOAK_ADMIN_TOKEN)'
    : CLIENT_SECRET
      ? `Client credentials (${CLIENT_ID})`
      : `Usuario ${ADMIN_USER} (realm ${REALM} o master)`;
  console.log('  Auth:     ', authDesc);
  if (DRY_RUN) console.log('  Modo:     --dry-run');
  if (DELETE_OLD) console.log('  Modo:     --delete-old');
  console.log('');

  if (DELETE_OLD) {
    let token: string;
    try {
      if (!ADMIN_TOKEN_STATIC) console.log('Obteniendo token de administrador...');
      token = await getAdminToken();
      if (!ADMIN_TOKEN_STATIC) console.log('Token obtenido.');
    } catch (err: any) {
      console.error('Error al obtener token de Keycloak.');
      if (err?.response) console.error('Respuesta:', err.response.status, err.response.data);
      printCurlTokenHint();
      process.exit(1);
    }
    const api = axios.create({
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
      validateStatus: () => true,
    });
    console.log('Buscando y borrando usuarios con username numérico...');
    const deleted = await deleteOldUsers(api);
    console.log('');
    console.log('Listo. Usuarios borrados:', deleted);
    return;
  }

  let empleados: Empleado[];
  try {
    console.log('Obteniendo empleados desde la API Survey...');
    empleados = await fetchEmpleados();
    console.log('Empleados obtenidos:', empleados.length);
  } catch (err: any) {
    console.error('Error al obtener empleados:', err?.message);
    if (err?.response) console.error('Status:', err.response.status);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('');
    console.log(
      'Muestra (primeros 3):',
      JSON.stringify(
        empleados.slice(0, 3).map((e) => ({ username: getUsername(e), fullName: e.fullName, cargo: e.cargo })),
        null,
        2
      )
    );
    console.log('');
    printCurlTokenHint();
    return;
  }

  let token: string;
  try {
    if (!ADMIN_TOKEN_STATIC) console.log('Obteniendo token de administrador...');
    token = await getAdminToken();
    if (!ADMIN_TOKEN_STATIC) console.log('Token obtenido.');
  } catch (err: any) {
    console.error('Error al obtener token de Keycloak (realm "%s" y master).', REALM);
    console.error('  Usuario "%s" y cliente %s con Direct access grants, o KEYCLOAK_ADMIN_TOKEN / KEYCLOAK_CLIENT_SECRET.', ADMIN_USER, CLIENT_ID);
    if (err?.response) console.error('  Respuesta:', err.response.status, err.response.data);
    else console.error('  ', err?.message);
    printCurlTokenHint();
    process.exit(1);
  }

  const api = axios.create({
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
    validateStatus: () => true,
  });

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < empleados.length; i++) {
    const emp = empleados[i];
    const username = getUsername(emp);
    if (!username) {
      console.warn(`[${i + 1}/${empleados.length}] Sin CI, se omite: ${emp.fullName}`);
      continue;
    }
    try {
      let user = await findUser(api, username);
      let userId: string | null = null;
      if (!user) {
        // Si el usuario viene de Active Directory y NO existe en Keycloak local,
        // no lo creamos. AD debe sincronizar el usuario primero a Keycloak.
        if (emp.AD) {
          console.log(`[${i + 1}/${empleados.length}] Omitido (Aún no ha ingresado por AD): ${username} (${emp.fullName})`);
          continue;
        }

        userId = await createUser(api, emp);
        if (userId) {
          created++;
          console.log(`[${i + 1}/${empleados.length}] Creado: ${username} (${emp.fullName})`);
        } else {
          user = await findUser(api, username);
          userId = user?.id ?? null;
          if (userId) created++;
        }
      } else {
        userId = user.id;
        await updateUser(api, userId, emp);
        updated++;
        console.log(`[${i + 1}/${empleados.length}] Actualizado: ${username} (${emp.fullName})`);
      }
      if (userId) {
        const roles = getRolesForCargo(emp.cargo);
        await assignRealmRoles(api, userId, roles);
      }
    } catch (err: any) {
      errors++;
      const msg = err?.response?.data?.errorMessage ?? err?.response?.data?.error ?? err?.message;
      console.error(`[${i + 1}/${empleados.length}] Error con ${username}:`, msg);
    }
  }

  // Solo pueden existir usuarios de la API: borrar en Keycloak los que ya no están en la Survey
  const validUsernames = new Set(empleados.map((e) => getUsername(e)).filter(Boolean));
  validUsernames.add(ADMIN_USER); // no borrar nunca al admin
  console.log('');
  console.log('Eliminando usuarios de Keycloak que no están en la API...');
  const pruned = await pruneUsersNotInApi(api, validUsernames);

  console.log('');
  console.log('Resumen: creados', created, '| actualizados', updated, '| errores', errors, '| eliminados (no en API)', pruned);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
