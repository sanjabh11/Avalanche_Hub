import React, { useState, useEffect } from 'react';
import { getDb, getAuthClient } from './firebase';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, where, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { AvalancheMap } from './components/Map';
import { RiskDashboard } from './components/RiskDashboard';
import { TimeSlider } from './components/TimeSlider';
import { FieldReportForm } from './components/FieldReportForm';
import { AdminDashboard } from './components/AdminDashboard';
import { AvalancheEvent, Forecast, FieldReport } from './types';
import { cn } from './lib/utils';
import { ShieldAlert, Info, LogIn, LogOut, LayoutDashboard, Database, AlertCircle, Camera, Settings, Mountain, Activity, Loader2 } from 'lucide-react';

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

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<AvalancheEvent[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBbox, setSelectedBbox] = useState<[number, number, number, number] | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [showExposureOverlay, setShowExposureOverlay] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuthClient(), (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    const path = 'avalanche_events';
    const q = query(collection(getDb(), path), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AvalancheEvent));
      setEvents(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, []);

  // Listen for forecast job completion
  useEffect(() => {
    const q = query(
      collection(getDb(), 'compute_jobs'), 
      where('type', '==', 'region_inference'),
      where('status', '==', 'completed'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const job = snapshot.docs[0].data();
        const forecastId = job.result?.forecastId;
        if (forecastId) {
          const forecastSnap = await getDoc(doc(getDb(), 'forecasts', forecastId));
          if (forecastSnap.exists()) {
            setForecast({ id: forecastSnap.id, ...forecastSnap.data() } as Forecast);
            setLoading(false);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Playback Logic
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => (prev + 1) % 25);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Auto-refresh forecast on time change
  useEffect(() => {
    if (forecast && isPlaying) {
      runForecast();
    }
  }, [currentTime]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(getAuthClient(), provider);
  };

  const handleLogout = async () => {
    try {
      await signOut(getAuthClient());
      setUser(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const runForecast = async () => {
    const bbox = selectedBbox || [77.1, 32.2, 77.3, 32.3];
    setLoading(true);
    
    try {
      const response = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, time: currentTime })
      });
      
      if (!response.ok) throw new Error('Failed to queue forecast');
      // Loading state will be cleared by the onSnapshot listener when the job completes
    } catch (error) {
      console.error('Forecast failed:', error);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-black text-white overflow-hidden">
      {/* Sidebar - Collapsible on mobile */}
      <aside className="w-full lg:w-96 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800 bg-black z-20">
        <header className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <h1 className="text-xl font-black uppercase tracking-tighter">Avalanche Hub</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "p-2 rounded transition-colors",
                activeTab === 'dashboard' ? "bg-zinc-800 text-red-500" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={cn(
                "p-2 rounded transition-colors",
                activeTab === 'admin' ? "bg-zinc-800 text-red-500" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
            {user ? (
              <button onClick={handleLogout} className="p-2 hover:bg-zinc-800 rounded transition-colors">
                <LogOut className="w-4 h-4 text-gray-400" />
              </button>
            ) : (
              <button onClick={handleLogin} className="p-2 hover:bg-zinc-800 rounded transition-colors">
                <LogIn className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'dashboard' ? (
            <div className="h-full flex flex-col">
              <RiskDashboard 
                forecast={forecast} 
                loading={loading} 
                onRunForecast={runForecast}
                showExposureOverlay={showExposureOverlay}
                onToggleExposure={() => setShowExposureOverlay(!showExposureOverlay)}
              />
              {forecast && (
                <div className="p-4 bg-red-950/30 border-t border-red-900/50">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="text-[10px] leading-tight">
                      <p className="font-bold uppercase mb-1">Survival-Curve Disclaimer</p>
                      <p>This forecast is a statistical approximation. Avalanche probability follows a non-linear survival curve; even "Low" risk does not mean zero risk. Always carry a beacon, probe, and shovel.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            user ? <AdminDashboard /> : (
              <div className="p-8 flex flex-col items-center justify-center h-full text-center gap-4">
                <ShieldAlert className="w-12 h-12 text-zinc-800" />
                <h3 className="text-lg font-bold uppercase">Admin Access Restricted</h3>
                <p className="text-xs text-gray-500">Please sign in with an authorized account to access system controls and model telemetry.</p>
                <button 
                  onClick={handleLogin}
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded transition-colors"
                >
                  SIGN IN
                </button>
              </div>
            )
          )}
        </div>

        <footer className="p-4 border-t border-zinc-800 flex items-center justify-between text-[8px] text-gray-600 font-mono uppercase tracking-widest">
          <span>v1.0.0-PROD</span>
          <span className="flex items-center gap-1"><AlertCircle className="w-2 h-2" /> DATA-SCARCE REGION MODE</span>
        </footer>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        <div className="flex-1 relative">
          <AvalancheMap 
            events={events} 
            forecasts={forecast ? [forecast] : []} 
            onRegionSelect={setSelectedBbox}
            showExposureOverlay={showExposureOverlay}
          />
          
          {/* Map Overlays */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <button 
              onClick={runForecast}
              disabled={loading}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold rounded flex items-center gap-2 shadow-2xl transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 text-red-500" />}
              RUN 24H FORECAST
            </button>
            
            <button 
              onClick={() => setShowReportForm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded flex items-center gap-2 shadow-2xl transition-colors"
            >
              <Camera className="w-4 h-4" /> REPORT AVALANCHE
            </button>
            
            <div className="p-3 bg-black/80 backdrop-blur border border-zinc-800 rounded shadow-2xl">
              <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-2">Legend</h4>
              <div className="flex flex-col gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div key={level} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ['#10b981', '#facc15', '#f97316', '#ef4444', '#7f1d1d'][level-1] }}></div>
                    <span className="text-[9px] uppercase">{['Low', 'Moderate', 'Considerable', 'High', 'Extreme'][level-1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showReportForm && (
            <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md">
                <FieldReportForm onClose={() => setShowReportForm(false)} />
              </div>
            </div>
          )}
        </div>

        <TimeSlider 
          currentTime={currentTime} 
          onChange={setCurrentTime} 
          isPlaying={isPlaying} 
          onTogglePlay={() => setIsPlaying(!isPlaying)} 
          onReset={() => setCurrentTime(0)} 
        />
      </main>
    </div>
  );
}
