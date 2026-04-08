import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { computeService } from './src/services/computeService.ts';
import { getAdminDb } from './src/firebaseAdmin.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Compute Service
  await computeService.init();

  // Initialize System Config if missing
  try {
    const db = getAdminDb();
    const configSnap = await db.collection('system_config').limit(1).get();
    if (configSnap.empty) {
      await db.collection('system_config').add({
        geminiUsage: 0,
        geminiSpendCap: 5000,
        lastEnrichment: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      console.log('System configuration initialized.');
    }

    // Initialize Model Status if missing
    const modelSnap = await db.collection('model_status').limit(1).get();
    if (modelSnap.empty) {
      await db.collection('model_status').add({
        version: 'v0.1',
        lastTrained: new Date().toISOString(),
        f1Score: 0.82,
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      console.log('Model status initialized.');
    }
  } catch (err) {
    console.error('Failed to initialize system config or model status:', err);
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Run Forecast endpoint
  app.post('/api/forecast', async (req, res) => {
    const { bbox, time } = req.body;
    
    try {
      const db = getAdminDb();
      const jobDoc = await db.collection('compute_jobs').add({
        type: 'region_inference',
        status: 'queued',
        bbox,
        time,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Trigger inference in background
      computeService.runInferenceJob(jobDoc.id, bbox, time).catch(console.error);
      
      res.json({ jobId: jobDoc.id, status: 'queued' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Field Report endpoint
  app.post('/api/field-report', async (req, res) => {
    const { reportId, description } = req.body;
    try {
      const db = getAdminDb();
      const jobDoc = await db.collection('compute_jobs').add({
        type: 'field_report_enrichment',
        status: 'queued',
        reportId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Trigger extraction in background
      computeService.runFieldReportEnrichment(jobDoc.id, reportId, description).catch(console.error);
      
      res.json({ jobId: jobDoc.id, status: 'queued' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Daily Cron Job (Midnight UTC) - Groundsource Enrichment
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Triggering daily Groundsource enrichment...');
    try {
      const db = getAdminDb();
      const jobDoc = await db.collection('compute_jobs').add({
        type: 'daily_enrichment',
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      computeService.runDailyEnrichment(jobDoc.id).catch(err => {
        console.error(`[CRON] Enrichment job ${jobDoc.id} failed:`, err);
      });
    } catch (err) {
      console.error('[CRON] Failed to queue enrichment job:', err);
    }
  });

  // Weekly Fine-tune Job (Sunday 02:00 UTC) - Model Retraining
  cron.schedule('0 2 * * 0', async () => {
    console.log('[CRON] Triggering weekly model fine-tuning...');
    try {
      const db = getAdminDb();
      const jobDoc = await db.collection('compute_jobs').add({
        type: 'weekly_fine_tune',
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      computeService.runWeeklyFineTune(jobDoc.id).catch(err => {
        console.error(`[CRON] Fine-tune job ${jobDoc.id} failed:`, err);
      });
    } catch (err) {
      console.error('[CRON] Failed to queue fine-tune job:', err);
    }
  });

  // Manual Trigger for Sentinel-1 Refresh
  app.post('/api/admin/trigger-sentinel-refresh', async (req, res) => {
    const db = getAdminDb();
    const jobDoc = await db.collection('compute_jobs').add({
      type: 'sentinel_refresh',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    computeService.runSentinelRefresh(jobDoc.id).catch(console.error);
    res.json({ jobId: jobDoc.id, status: 'queued' });
  });

  // Manual Trigger for Weekly Fine-tune
  app.post('/api/admin/trigger-fine-tune', async (req, res) => {
    const db = getAdminDb();
    const jobDoc = await db.collection('compute_jobs').add({
      type: 'weekly_fine_tune',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    computeService.runWeeklyFineTune(jobDoc.id).catch(console.error);
    res.json({ jobId: jobDoc.id, status: 'queued' });
  });

  // Manual Trigger for Static Pre-compute
  app.post('/api/admin/trigger-static-compute', async (req, res) => {
    const db = getAdminDb();
    const jobDoc = await db.collection('compute_jobs').add({
      type: 'static_precompute',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    computeService.runStaticPreCompute(jobDoc.id).catch(console.error);
    res.json({ jobId: jobDoc.id, status: 'queued' });
  });

  // Manual Trigger for Demo
  app.post('/api/admin/trigger-enrichment', async (req, res) => {
    const db = getAdminDb();
    const jobDoc = await db.collection('compute_jobs').add({
      type: 'daily_enrichment',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    computeService.runDailyEnrichment(jobDoc.id).catch(console.error);
    res.json({ jobId: jobDoc.id, status: 'queued' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
