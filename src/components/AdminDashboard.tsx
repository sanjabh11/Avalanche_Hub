import React, { useState, useEffect } from 'react';
import { getDb, getAuthClient } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { ComputeJob } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Database, Cpu, CreditCard, Activity, CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { cn } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const auth = getAuthClient();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const AdminDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<ComputeJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [stats, setStats] = useState({
    geminiUsage: 0,
    geminiSpendCap: 5000,
    newsDataCalls: 45,
    totalEvents: 2600000,
    f1Score: 0.82,
    precision: 0.80,
    recall: 0.84,
    modelVersion: 'v0.1',
    lastTrained: new Date().toISOString(),
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  useEffect(() => {
    const q = query(collection(getDb(), 'model_status'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setStats(prev => ({
          ...prev,
          modelVersion: data.version || 'v0.1',
          lastTrained: data.lastTrained || new Date().toISOString(),
          f1Score: data.f1Score || 0.82,
          nextRun: data.nextRun || new Date().toISOString()
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const path = 'compute_jobs';
    const q = query(collection(getDb(), path), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ComputeJob));
      setJobs(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(getDb(), 'system_config'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setStats(prev => ({
          ...prev,
          geminiUsage: data.geminiUsage || 0,
          geminiSpendCap: data.geminiSpendCap || 5000
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  const performanceData = [
    { name: 'Mon', f1: 0.78 },
    { name: 'Tue', f1: 0.80 },
    { name: 'Wed', f1: 0.81 },
    { name: 'Thu', f1: 0.82 },
    { name: 'Fri', f1: 0.82 },
    { name: 'Sat', f1: 0.83 },
    { name: 'Sun', f1: 0.82 },
  ];

  const triggerDailyEnrichment = async () => {
    const promise = fetch('/api/admin/trigger-enrichment', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to queue enrichment');
        return res.json();
      });

    toast.promise(promise, {
      loading: 'Queuing Groundsource Enrichment...',
      success: (data) => `Enrichment job queued: ${data.jobId}`,
      error: (err) => `Failed: ${err.message}`
    });
  };

  const triggerStaticCompute = async () => {
    const promise = fetch('/api/admin/trigger-static-compute', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to queue static compute');
        return res.json();
      });

    toast.promise(promise, {
      loading: 'Queuing Static Pre-compute...',
      success: (data) => `Static compute queued: ${data.jobId}`,
      error: (err) => `Failed: ${err.message}`
    });
  };

  const triggerSentinelRefresh = async () => {
    const promise = fetch('/api/admin/trigger-sentinel-refresh', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to queue refresh');
        return res.json();
      });

    toast.promise(promise, {
      loading: 'Queuing Sentinel-1 Refresh...',
      success: 'Sentinel-1 refresh job queued',
      error: (err) => `Failed: ${err.message}`
    });
  };

  const triggerFineTune = async () => {
    const promise = fetch('/api/admin/trigger-fine-tune', { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to queue fine-tune');
        return res.json();
      });

    toast.promise(promise, {
      loading: 'Queuing Model Fine-tuning...',
      success: 'Model fine-tuning job queued',
      error: (err) => `Failed: ${err.message}`
    });
  };

  return (
    <div className="p-6 flex flex-col gap-8 h-full overflow-y-auto bg-black">
      <Toaster theme="dark" position="top-right" />
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
          <Database className="w-6 h-6 text-red-600" /> System Control & Costs
        </h2>
        <div className="flex flex-wrap gap-2 justify-end">
          <button 
            onClick={triggerSentinelRefresh}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white font-bold rounded uppercase transition-colors"
          >
            Refresh Sentinel-1
          </button>
          <button 
            onClick={triggerFineTune}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white font-bold rounded uppercase transition-colors"
          >
            Fine-Tune Model
          </button>
          <button 
            onClick={triggerStaticCompute}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white font-bold rounded uppercase transition-colors"
          >
            Pre-compute Static
          </button>
          <button 
            onClick={triggerDailyEnrichment}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-[10px] text-white font-bold rounded uppercase transition-colors"
          >
            Trigger Enrichment
          </button>
        </div>
      </header>

      {/* API Success Alert */}
      {successMsg && (
        <div className="p-4 bg-green-900/60 border border-green-500 rounded flex items-center gap-3 text-green-100 mb-4">
          <CheckCircle className="w-5 h-5" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase">Action Successful</p>
            <p className="text-[10px]">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs hover:text-white">✕</button>
        </div>
      )}

      {/* API Error Alert */}
      {error && (
        <div className="p-4 bg-red-900/60 border border-red-500 rounded flex items-center gap-3 text-red-100">
          <AlertCircle className="w-5 h-5" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase">System Communication Error</p>
            <p className="text-[10px]">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-xs hover:text-white">✕</button>
        </div>
      )}

      {/* Spend Cap Alert */}
      {stats.geminiUsage > stats.geminiSpendCap * 0.8 && (
        <div className={cn(
          "p-4 border rounded flex items-center gap-3",
          stats.geminiUsage > stats.geminiSpendCap * 0.95 ? "bg-red-900/60 border-red-500 text-red-100" : "bg-yellow-900/40 border-yellow-600 text-yellow-200"
        )}>
          <AlertCircle className="w-5 h-5" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase">
              {stats.geminiUsage > stats.geminiSpendCap * 0.95 ? "🛑 Critical: Spend Cap Reached" : "⚠️ Warning: Spend Cap Approaching"}
            </p>
            <p className="text-[10px]">
              Gemini API usage is at {((stats.geminiUsage / stats.geminiSpendCap) * 100).toFixed(1)}% of limit. 
              {stats.geminiUsage > stats.geminiSpendCap * 0.95 ? " Automated cron jobs are PAUSED." : " Automated cron jobs will pause at 95%."}
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 bg-red-600/20 text-red-500 text-[8px] font-bold uppercase px-2">Live</div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold mb-2">
            <CreditCard className="w-3 h-3" /> Gemini Credits
          </div>
          <div className="text-2xl font-mono">{stats.geminiUsage.toLocaleString()} / {stats.geminiSpendCap.toLocaleString()}</div>
          <div className="w-full h-1 bg-zinc-800 rounded mt-2">
            <div className="h-full bg-red-600 rounded transition-all duration-500" style={{ width: `${Math.min(100, (stats.geminiUsage / stats.geminiSpendCap) * 100)}%` }}></div>
          </div>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded">
          <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold mb-2">
            <Activity className="w-3 h-3" /> Model {stats.modelVersion}
          </div>
          <div className="text-2xl font-mono">{(stats.f1Score * 100).toFixed(1)}% F1</div>
          <div className="text-[8px] text-gray-500 mt-1 uppercase">Trained: {new Date(stats.lastTrained).toLocaleDateString()}</div>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded">
          <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold mb-2">
            <Cpu className="w-3 h-3" /> Active Jobs
          </div>
          <div className="text-2xl font-mono">{jobs.filter(j => j.status === 'processing').length}</div>
          <div className="text-[10px] text-gray-500 mt-1">Queue: {jobs.filter(j => j.status === 'queued').length}</div>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded">
          <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold mb-2">
            <Database className="w-3 h-3" /> Next Pipeline
          </div>
          <div className="text-2xl font-mono">{Math.max(0, Math.floor((new Date(stats.nextRun).getTime() - Date.now()) / (1000 * 60 * 60)))}h</div>
          <div className="text-[10px] text-gray-500 mt-1">Scheduled Groundsource Run</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 h-[250px]">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4">Model Performance (F1)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis domain={[0.7, 0.9]} tick={{ fontSize: 10, fill: '#888' }} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
              <Line type="monotone" dataKey="f1" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4">Daily Extraction Volume</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
              <YAxis tick={{ fontSize: 10, fill: '#888' }} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
              <Bar dataKey="f1" fill="#333" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Job Queue */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-3 h-3" /> Recent Compute Jobs
        </h3>
        <div className="flex flex-col border border-zinc-800 rounded overflow-hidden">
          {jobs.map((job) => (
            <div key={job.id} className="p-4 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between hover:bg-zinc-900 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-zinc-800 rounded">
                  {job.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-500" /> : 
                   job.status === 'failed' ? <XCircle className="w-4 h-4 text-red-500" /> : 
                   <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />}
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-tighter">{job.type.replace('_', ' ')}</p>
                  <p className="text-[10px] text-gray-500 font-mono">ID: {job.id.substr(0, 8)} • {new Date(job.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-gray-400">
                {job.status.toUpperCase()}
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="p-8 text-center text-xs text-gray-500 font-mono">NO RECENT JOBS IN QUEUE</div>
          )}
        </div>
      </div>
    </div>
  );
};
