import React from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';

interface TimeSliderProps {
  currentTime: number;
  onChange: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
}

export const TimeSlider: React.FC<TimeSliderProps> = ({ 
  currentTime, 
  onChange, 
  isPlaying, 
  onTogglePlay, 
  onReset 
}) => {
  return (
    <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center gap-6">
      <div className="flex items-center gap-2">
        <button 
          onClick={onTogglePlay}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button 
          onClick={onReset}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 24-Hour Forecast Horizon</span>
          <span className="font-mono text-white">T + {currentTime}H</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="24" 
          step="1" 
          value={currentTime} 
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
        />
        <div className="flex justify-between text-[8px] text-gray-600 font-mono">
          <span>NOW</span>
          <span>+6H</span>
          <span>+12H</span>
          <span>+18H</span>
          <span>+24H</span>
        </div>
      </div>
    </div>
  );
};
