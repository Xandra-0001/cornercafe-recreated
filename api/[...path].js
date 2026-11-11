import { createApp } from '../backend/src/app.js';
import { loadConfig } from '../backend/src/config/env.js';
import { runMigrations } from '../backend/src/database/migrations.js';
import { createPool } from '../backend/src/database/pool.js';
import { bootstrapInitialOwner } from '../backend/src/services/auth.js';

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const config = loadConfig();
      const pool = createPool({ ...config, poolMax: Math.min(config.poolMax, 2) });
      try {
        await runMigrations(pool);
        if (await bootstrapInitialOwner(pool)) console.info(JSON.stringify({ event: 'initial_owner_created' }));
        return createApp({ pool, config });
      } catch (error) {
        await pool.end().catch(() => {});
        throw error;
      }
    })().catch((error) => {
      appPromise = undefined;
      throw error;
    });
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    const requestUrl = new URL(req.url || '/', 'https://vercel.invalid');
    if (!requestUrl.pathname.startsWith('/api/')) {
      requestUrl.pathname = `/api${requestUrl.pathname.startsWith('/') ? '' : '/'}${requestUrl.pathname}`;
      req.url = `${requestUrl.pathname}${requestUrl.search}`;
    }
    return app(req, res);
  } catch (error) {
    console.error(JSON.stringify({ event: 'serverless_initialization_failed', code: error?.code || 'API_INIT_FAILED' }));
    if (!res.headersSent) {
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The reservation service is temporarily unavailable. Please try again.' } });
    }
  }
}
