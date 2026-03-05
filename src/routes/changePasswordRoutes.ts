import { Router, Request, Response } from 'express';
import {
  getAdminToken,
  createAdminApi,
  findUserByUsername,
  verifyCurrentPassword,
  setUserPassword,
  removeRequiredAction,
} from '../services/keycloakAdmin';

const router = Router();

interface ChangePasswordBody {
  username?: string;
  currentPassword?: string;
  newPassword?: string;
}

router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  const { username, currentPassword, newPassword } = (req.body ?? {}) as ChangePasswordBody;

  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ message: 'El usuario es requerido.' });
    return;
  }
  if (!currentPassword || typeof currentPassword !== 'string') {
    res.status(400).json({ message: 'La contraseña actual es requerida.' });
    return;
  }
  if (!newPassword || typeof newPassword !== 'string') {
    res.status(400).json({ message: 'La nueva contraseña es requerida.' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  const userLogin = username.trim();

  try {
    const valid = await verifyCurrentPassword(userLogin, currentPassword);
    if (!valid) {
      res.status(401).json({ message: 'Contraseña actual incorrecta.' });
      return;
    }

    const token = await getAdminToken();
    const api = createAdminApi(token);
    const user = await findUserByUsername(api, userLogin);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado.' });
      return;
    }

    await setUserPassword(api, user.id, newPassword, false);
    await removeRequiredAction(api, user.id, 'UPDATE_PASSWORD');

    res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err: any) {
    console.error('change-password error:', err?.message, err?.response?.data);
    if (err?.response) {
      const status = err.response.status ?? 500;
      const data = err.response.data as Record<string, unknown>;
      const msg =
        (data?.errorMessage as string) ??
        (data?.error_description as string) ??
        (data?.message as string) ??
        'Error en Keycloak.';
      res.status(status).json({ message: msg });
      return;
    }
    res.status(500).json({
      message: err?.message ?? 'No se pudo cambiar la contraseña. Intenta más tarde.',
    });
  }
});

export default router;
