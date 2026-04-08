import React from 'react';
import { Forecast } from '../types';
import { getRiskColor, cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Info, ShieldAlert, Users, MapPin, Database } from 'lucide-react';

interface DashboardProps {
  forecast: Forecast | null;
  loading: boolean;
  onRunForecast: () => void;
  showExposureOverlay: boolean;
  onToggleExposure: () => void;
}

export const RiskDashboard: React.FC<DashboardProps> = ({ 
  forecast, 
  loading, 
  onRunForecast,
  showExposureOverlay,
  onToggleExposure
}) => {
  if (!forecast && !loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-4">
        <MapPin className="w-12 h-12 text-gray-600" />
        <h2 className="text-xl font-bold">Select a Region to Start</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Navigate the map to your target area and click "Run Forecast" to generate a 24-hour predictive risk assessment.
        </p>
        <button 
          onClick={onRunForecast}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded transition-colors"
        >
          RUN FORECAST
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-mono animate-pulse">ANALYZING GEOSPATIAL TELEMETRY...</p>
      </div>
    );
  }

  const shapData = Object.entries(forecast!.shapValues).map(([name, value]) => ({
    name,
    value: Math.abs(value),
    originalValue: value
  })).sort((a, b) => b.value - a.value).slice(0, 6);

  const handleExport = () => {
    if (!forecast) return;
    try {
      const dataStr = JSON.stringify(forecast, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', `avalanche-forecast-${new Date().toISOString()}.json`);
      linkElement.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto">
      {/* Risk Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded flex items-center justify-center text-2xl font-black"
            style={{ backgroundColor: getRiskColor(forecast!.riskScore) }}
          >
            {forecast!.riskScore}
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter">Risk Level: {forecast!.riskScore}/5</h2>
            <p className="text-xs font-mono text-gray-400">PROBLEM: {forecast!.problemType.toUpperCase()}</p>
          </div>
        </div>
        <button 
          onClick={onRunForecast}
          className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors"
        >
          REFRESH
        </button>
      </div>

      {/* Exposure Toggle & Export */}
      <div className="flex items-center justify-between gap-2">
        <button 
          onClick={onToggleExposure}
          className={cn(
            "flex-1 py-2 border rounded text-[10px] uppercase font-bold transition-all flex items-center justify-center gap-2",
            showExposureOverlay 
              ? "bg-red-600 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
              : "bg-zinc-900 border-zinc-800 text-gray-400 hover:bg-zinc-800"
          )}
        >
          <Users className={cn("w-3 h-3", showExposureOverlay && "animate-pulse")} />
          {showExposureOverlay ? "Overlay Active" : "Exposure Overlay"}
        </button>
        <button 
          onClick={handleExport}
          className="flex-1 py-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] uppercase font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 text-gray-400"
        >
          <Database className="w-3 h-3" /> Export Data
        </button>
      </div>

      {/* Risk Equation */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase font-bold mb-1">
            <ShieldAlert className="w-3 h-3" /> Hazard
          </div>
          <div className="text-lg font-mono">{(forecast!.hazard * 100).toFixed(0)}%</div>
        </div>
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase font-bold mb-1">
            <Users className="w-3 h-3" /> Exposure
          </div>
          <div className="text-lg font-mono">{(forecast!.exposure * 100).toFixed(0)}%</div>
        </div>
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase font-bold mb-1">
            <AlertTriangle className="w-3 h-3" /> Vuln.
          </div>
          <div className="text-lg font-mono">{(forecast!.vulnerability * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* SHAP Explanations */}
      <div className="flex-1 min-h-[200px]">
        <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
          <Info className="w-3 h-3" /> SHAP Feature Contribution
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={shapData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={100} 
              tick={{ fontSize: 10, fill: '#888' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#111', border: '1px solid #333', fontSize: '12px' }}
              itemStyle={{ color: '#ef4444' }}
            />
            <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Survival Curve & Life-Safety Disclaimer */}
      <div className="p-4 bg-red-950/40 border border-red-900 rounded-lg flex flex-col gap-2">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-tighter">Life Safety Warning: Survival Probability</span>
        </div>
        <p className="text-[10px] text-red-200 leading-relaxed">
          Avalanche survival probability drops to <span className="font-bold">30% after 15 minutes</span> of burial. This forecast is a statistical probability model and does not guarantee safety. In regions with high vulnerability (e.g., Himachal Pradesh), exposure to even "Moderate" hazard can result in catastrophic outcomes due to lack of rescue infrastructure.
        </p>
        <div className="h-12 w-full bg-zinc-900 rounded overflow-hidden relative">
          <div className="absolute inset-0 flex items-end px-2 pb-1 justify-between text-[8px] text-zinc-500 uppercase font-bold">
            <span>0m</span>
            <span>15m</span>
            <span>30m</span>
            <span>60m</span>
          </div>
          <div className="h-full bg-red-600/20" style={{ width: '100%' }}></div>
          <div className="absolute top-0 left-0 h-full bg-red-600" style={{ width: '90%', clipPath: 'polygon(0 0, 100% 70%, 100% 100%, 0% 100%)' }}></div>
        </div>
        <p className="text-[8px] text-red-400/60 mt-1 italic">
          Not a substitute for official warnings. This is a predictive model for data-scarce regions. Always consult local authorities.
        </p>
      </div>
    </div>
  );
};
