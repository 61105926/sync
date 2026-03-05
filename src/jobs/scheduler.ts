import cron from 'node-cron';
import { spawn } from 'child_process';

// Ejecuta `npm run sync-users` y muestra la salida en la misma consola.
function runSyncUsersJob() {
  console.log('[scheduler] Ejecutando sincronización automática: npm run sync-users');

  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(cmd, ['run', 'sync-users'], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    console.log('[scheduler] sync-users terminó con código', code);
  });
}

// Programar la sincronización todos los días a las 02:00 (hora del servidor)
cron.schedule('0 2 * * *', () => {
  runSyncUsersJob();
});

// Opcional: primera ejecución pocos segundos después de arrancar el servidor
setTimeout(() => {
  console.log('[scheduler] Primera sincronización automática al iniciar el servidor');
  runSyncUsersJob();
}, 10_000);

