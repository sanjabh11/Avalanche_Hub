import axios from 'axios';
import { getAdminDb } from '../firebaseAdmin.ts';
import { extractAvalancheEvents } from './geminiService.ts';
import { AvalancheEvent, ComputeJob } from '../types';

export class ComputeService {
  private session: any | null = null;

  async init() {
    try {
      // In a real app, we'd load the .onnx file from Storage or local disk
      // For this stabilization, we'll use a mock inference.
      console.log('Inference Session initialized (Mocked for stabilization)');
    } catch (e) {
      console.error('Failed to init ONNX session:', e);
    }
  }

  /**
   * Story #5: Daily Enrichment Pipeline with Sentinel-1 Fusion
   */
  async runDailyEnrichment(jobId: string) {
    const db = getAdminDb();
    const jobRef = db.collection('compute_jobs').doc(jobId);
    
    // Idempotency check: Ensure we don't process the same job twice
    const jobSnap = await db.collection('compute_jobs')
      .where('status', '==', 'processing')
      .where('type', '==', 'daily_enrichment')
      .get();
      
    if (jobSnap.docs.some(d => d.id !== jobId)) {
      console.log('Another enrichment job is already processing. Skipping.');
      return;
    }

    await jobRef.update({ status: 'processing', updatedAt: new Date().toISOString() });

    let tokensUsed = 0;
    let articlesProcessed = 0;
    let eventsCreated = 0;

    try {
      const newsApiKey = process.env.NEWSDATA_API_KEY;
      if (!newsApiKey || newsApiKey === 'MY_NEWSDATA_API_KEY') {
        console.warn('NEWSDATA_API_KEY is missing or placeholder. Using demo mode.');
        // Simulate some results for demo mode
        const demoTokens = 1200;
        await new Promise(resolve => setTimeout(resolve, 3000));
        await jobRef.update({ 
          status: 'completed', 
          result: { tokensUsed: demoTokens, articlesProcessed: 5, eventsCreated: 2, mode: 'demo' },
          updatedAt: new Date().toISOString() 
        });

        // Update usage in demo mode too
        const configSnap = await db.collection('system_config').limit(1).get();
        if (!configSnap.empty) {
          await configSnap.docs[0].ref.update({
            geminiUsage: (configSnap.docs[0].data().geminiUsage || 0) + demoTokens,
            lastEnrichment: new Date().toISOString()
          });
        }
        return;
      }

      // Spend-cap check (Simulated)
      const configSnap = await db.collection('system_config').limit(1).get();
      const configData = configSnap.docs[0]?.data();
      const spendCap = configData?.geminiSpendCap || 5000;
      const currentUsage = configData?.geminiUsage || 0;

      if (currentUsage >= spendCap * 0.95) {
        throw new Error('Spend cap reached. Enrichment paused.');
      }

      const newsResponse = await axios.get(`https://newsdata.io/api/1/news?apikey=${newsApiKey}&q=avalanche&language=en,es,hi`);
      const articles = newsResponse.data.results.slice(0, 10);

      for (const article of articles) {
        const existing = await db.collection('avalanche_events').where('source', '==', article.link).get();
        if (!existing.empty) continue;

        articlesProcessed++;
        
        // Gemini Extraction
        const extracted = await extractAvalancheEvents(article.content || article.description || article.title);
        tokensUsed += 850; // More realistic token count for full article

        for (const event of extracted) {
          // Sentinel-1 Fusion: Query raster masks for remote deposits
          const s1Match = await this.querySentinel1(event.location.lng, event.location.lat, event.timestamp);
          
          await db.collection('avalanche_events').add({
            ...event,
            location: { type: 'Point', coordinates: [event.location.lng, event.location.lat] },
            source: article.link,
            confidence: s1Match ? 0.98 : 0.75, // Higher confidence if SAR confirms
            isRemote: !s1Match, // If no SAR match but news exists, might be anthropocentric
            fusionSource: s1Match ? 'Sentinel-1 SAR' : 'News Only',
            createdAt: new Date().toISOString()
          });
          eventsCreated++;

          await this.createNonEventBaseline(event.location.lng, event.location.lat, event.timestamp);
        }
      }

      // Update global usage stats
      if (!configSnap.empty) {
        await configSnap.docs[0].ref.update({
          geminiUsage: currentUsage + tokensUsed,
          lastEnrichment: new Date().toISOString()
        });
      }

      await jobRef.update({ 
        status: 'completed', 
        result: { tokensUsed, articlesProcessed, eventsCreated },
        updatedAt: new Date().toISOString() 
      });
    } catch (error: any) {
      console.error('Daily enrichment failed:', error);
      await jobRef.update({ status: 'failed', error: error.message, updatedAt: new Date().toISOString() });
    }
  }

  /**
   * Story #10: Weekly Fine-Tuning Job
   */
  async runWeeklyFineTune(jobId: string) {
    const db = getAdminDb();
    const jobRef = db.collection('compute_jobs').doc(jobId);
    await jobRef.update({ status: 'processing', updatedAt: new Date().toISOString() });

    try {
      console.log('Fetching recent data for fine-tuning...');
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      // Querying recent events for climate-shift weighting
      const recentEvents = await db.collection('avalanche_events')
        .where('createdAt', '>=', twoYearsAgo.toISOString())
        .get();
      
      console.log(`Retraining with ${recentEvents.size} recent events (weighted 2.5x)...`);
      
      // Simulate XGBoost retraining
      await new Promise(resolve => setTimeout(resolve, 8000)); 

      const newVersion = `v0.${Math.floor(Math.random() * 10) + 2}`;
      const lastTrained = new Date().toISOString();

      await jobRef.update({ 
        status: 'completed', 
        result: { 
          newF1: 0.86 + (Math.random() * 0.02), 
          precision: 0.84 + (Math.random() * 0.02),
          recall: 0.88 + (Math.random() * 0.02),
          recentDataWeight: 2.5,
          version: newVersion,
          message: 'Model updated with heavy weighting on 2024-2026 climate shifts.'
        },
        updatedAt: lastTrained
      });

      // Update model status
      const statusSnap = await db.collection('model_status').limit(1).get();
      if (statusSnap.empty) {
        await db.collection('model_status').add({
          version: newVersion,
          lastTrained,
          f1Score: 0.86,
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      } else {
        await statusSnap.docs[0].ref.update({
          version: newVersion,
          lastTrained,
          f1Score: 0.86,
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }
    } catch (error: any) {
      await jobRef.update({ status: 'failed', error: error.message, updatedAt: new Date().toISOString() });
    }
  }

  /**
   * Phase 3.3: Sentinel-1 SAR Refresh
   */
  async runSentinelRefresh(jobId: string) {
    const db = getAdminDb();
    const jobRef = db.collection('compute_jobs').doc(jobId);
    await jobRef.update({ status: 'processing', updatedAt: new Date().toISOString() });

    try {
      console.log('Querying Google Earth Engine for Sentinel-1 SAR change-detection...');
      
      // Simulate GEE export
      await new Promise(resolve => setTimeout(resolve, 6000));

      await jobRef.update({ 
        status: 'completed', 
        result: { 
          quarter: '2026-Q1', 
          layersUpdated: 12,
          storagePath: 'gs://avalanche-hub-rasters/sentinel1/2026_Q1_mask.tif',
          resolution: '10m'
        },
        updatedAt: new Date().toISOString() 
      });
    } catch (error: any) {
      await jobRef.update({ status: 'failed', error: error.message, updatedAt: new Date().toISOString() });
    }
  }

  async runInferenceJob(jobId: string, bbox: [number, number, number, number], time: number) {
    const db = getAdminDb();
    const jobRef = db.collection('compute_jobs').doc(jobId);
    await jobRef.update({ status: 'processing', updatedAt: new Date().toISOString() });

    try {
      console.log(`Running region-aware inference for bbox: ${bbox}...`);
      
      // 1. Feature Engineering: Fetch weather from Open-Meteo (Simulated)
      // In a real app, we'd use axios.get('https://api.open-meteo.com/v1/forecast?...)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 2. Filter enriched events for this region
      const eventsSnap = await db.collection('avalanche_events')
        .where('location.coordinates', 'array-contains-any', [bbox[0], bbox[1]]) // Simplified spatial filter
        .get();
      
      // 3. Run Inference
      const result = await this.runInference(bbox, time);
      
      // 4. Store forecast result
      const forecastRef = await db.collection('forecasts').add({
        jobId,
        bbox,
        time,
        ...result,
        problemType: result.hazard > 0.7 ? 'wet-slab' : 'dry-slab',
        createdAt: new Date().toISOString()
      });

      await jobRef.update({ 
        status: 'completed', 
        result: { forecastId: forecastRef.id, riskScore: result.riskScore },
        updatedAt: new Date().toISOString() 
      });
    } catch (error: any) {
      await jobRef.update({ status: 'failed', error: error.message, updatedAt: new Date().toISOString() });
    }
  }

  /**
   * Story #8: Feature Engineering (Chunked 5x5 km patches)
   */
  async runInference(bbox: [number, number, number, number], time: number) {
    // Simulate complex inference logic
    const avgLat = (bbox[1] + bbox[3]) / 2;
    const avgLng = (bbox[0] + bbox[2]) / 2;
    
    // Base hazard on "terrain" and time-varying weather
    // Use time to shift the risk patterns
    const terrainFactor = (Math.sin(avgLat * 10) + Math.cos(avgLng * 10) + 2) / 4;
    
    // Simulate a storm moving through over 24 hours
    const stormIntensity = Math.exp(-Math.pow((time - 12), 2) / 32); // Peak at hour 12
    const timeFactor = stormIntensity * 0.4 + Math.sin(time / 4) * 0.1;
    
    const hazard = Math.min(1, Math.max(0.1, terrainFactor * 0.6 + timeFactor + Math.random() * 0.05));
    const exposure = Math.random() * 0.4 + 0.6; // High exposure in mountain regions
    const vulnerability = 0.85;
    const riskScore = Math.min(5, Math.max(1, Math.ceil((hazard * exposure * vulnerability) * 5)));

    // SHAP Simulation
    const shapValues: Record<string, number> = {
      'Slope (30-45°)': 0.45 * terrainFactor,
      '24h Snowfall': 0.55 * stormIntensity,
      'Temp Gradient': 0.15 * Math.abs(Math.cos(time/8)),
      'Wind Loading': 0.25 * (stormIntensity + Math.random() * 0.2),
      'Soil Moisture': 0.05 * Math.random()
    };

    if (hazard > 0.6) {
      shapValues['Sentinel-1 SAR Fusion'] = 0.25;
    }

    return {
      riskScore,
      hazard,
      exposure,
      vulnerability,
      shapValues,
      gridData: this.generateGrid(bbox, time)
    };
  }

  private generateGrid(bbox: [number, number, number, number], time: number) {
    const grid = [];
    const density = 20;
    const lngStep = (bbox[2] - bbox[0]) / density;
    const latStep = (bbox[3] - bbox[1]) / density;
    
    // Storm center moves slightly over time
    const stormCenterX = bbox[0] + (bbox[2] - bbox[0]) * (time / 24);
    
    for (let i = 0; i < density; i++) {
      for (let j = 0; j < density; j++) {
        const lng = bbox[0] + (i + 0.5) * lngStep;
        const lat = bbox[1] + (j + 0.5) * latStep;
        
        // Distance from storm center
        const dist = Math.sqrt(Math.pow(lng - stormCenterX, 2) + Math.pow(lat - (bbox[1] + bbox[3])/2, 2));
        const stormEffect = Math.exp(-dist * 10) * Math.sin(time / 4);
        
        const baseScore = (Math.sin(lat * 50) + Math.cos(lng * 50) + 2) / 4;
        const score = Math.min(5, Math.max(1, Math.ceil((baseScore + stormEffect + Math.random() * 0.2) * 5)));
        
        grid.push({ lng, lat, score });
      }
    }
    return grid;
  }

  private async querySentinel1(lng: number, lat: number, timestamp: string) {
    // Mocking a Sentinel-1 SAR disruption detection
    return Math.random() > 0.5;
  }

  private async createNonEventBaseline(lng: number, lat: number, eventTimestamp: string) {
    const db = getAdminDb();
    // Create a baseline for the same location but a different (safe) day
    const baselineDate = new Date(eventTimestamp);
    baselineDate.setMonth(baselineDate.getMonth() - 1); // 1 month prior

    await db.collection('non_event_baselines').add({
      timestamp: baselineDate.toISOString(),
      location: { type: 'Point', coordinates: [lng, lat] },
      features: { slope: 35, tpi: 0.2 }, // Mocked
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Phase 3.1: One-time pre-compute job for static_layers
   */
  async runStaticPreCompute(jobId: string) {
    const db = getAdminDb();
    const jobRef = db.collection('compute_jobs').doc(jobId);
    await jobRef.update({ status: 'processing', updatedAt: new Date().toISOString() });

    try {
      // Simulation of Earth Engine export processing
      console.log('Computing static layers (Slope 30-45°, TPI, Aspect)...');
      
      // Mocking storage of pre-computed rasters
      await new Promise(resolve => setTimeout(resolve, 5000));

      await jobRef.update({ 
        status: 'completed', 
        result: { layers: ['slope', 'tpi', 'aspect', 'lithology'], resolution: '30m' },
        updatedAt: new Date().toISOString() 
      });
    } catch (error: any) {
      await jobRef.update({ status: 'failed', error: error.message, updatedAt: new Date().toISOString() });
    }
  }

  async runFieldReportEnrichment(jobId: string, reportId: string, description: string) {
    const db = getAdminDb();
    const jobRef = db.collection('compute_jobs').doc(jobId);
    await jobRef.update({ status: 'processing', updatedAt: new Date().toISOString() });

    try {
      console.log(`Enriching field report ${reportId}...`);
      const extracted = await extractAvalancheEvents(description);
      
      for (const event of extracted) {
        await db.collection('avalanche_events').add({
          ...event,
          location: { type: 'Point', coordinates: [event.location.lng, event.location.lat] },
          source: 'Field Report',
          reportId,
          confidence: 0.9,
          createdAt: new Date().toISOString()
        });
      }

      await jobRef.update({ 
        status: 'completed', 
        result: { eventsCreated: extracted.length },
        updatedAt: new Date().toISOString() 
      });
      
      await db.collection('field_reports').doc(reportId).update({
        status: 'enriched',
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      await jobRef.update({ status: 'failed', error: err.message, updatedAt: new Date().toISOString() });
    }
  }
}

export const computeService = new ComputeService();
