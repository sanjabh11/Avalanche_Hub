import React, { useState, useEffect } from 'react';
import { getDb, getStorageClient, getAuthClient } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, MapPin, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FieldReportProps {
  onClose: () => void;
}

export const FieldReportForm: React.FC<FieldReportProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isManual) return;
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setIsManual(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setLocation(coords);
        setManualLng(coords[0].toFixed(6));
        setManualLat(coords[1].toFixed(6));
        setError(null);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('GPS blocked or unavailable. Please enter coordinates manually.');
        setIsManual(true);
        // Fallback to map center
        const fallback: [number, number] = [77.1892, 32.2432];
        setLocation(fallback);
        setManualLng(fallback[0].toFixed(6));
        setManualLat(fallback[1].toFixed(6));
      },
      { timeout: 10000 }
    );
  }, [isManual]);

  const handleManualChange = () => {
    const lng = parseFloat(manualLng);
    const lat = parseFloat(manualLat);
    if (!isNaN(lng) && !isNaN(lat)) {
      setLocation([lng, lat]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getAuthClient();
    const db = getDb();
    const storage = getStorageClient();
    const uid = auth.currentUser?.uid || 'anonymous';
    if (!location) return;
    setLoading(true);

    try {
      let imageUrl = '';
      if (image) {
        const storageRef = ref(storage, `field_reports/${Date.now()}_${image.name}`);
        await uploadBytes(storageRef, image);
        imageUrl = await getDownloadURL(storageRef);
      }

      const reportRef = await addDoc(collection(db, 'field_reports'), {
        uid,
        timestamp: new Date().toISOString(),
        location: { type: 'Point', coordinates: location },
        imageUrl,
        description,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Trigger enrichment via API
      fetch('/api/field-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: reportRef.id, description })
      }).catch(console.error);

      toast.success('Report submitted successfully!');
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (error: any) {
      console.error('Upload failed:', error);
      setError(error.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 bg-zinc-900 rounded-lg border border-zinc-800">
        <CheckCircle className="w-12 h-12 text-green-500" />
        <h3 className="text-xl font-bold">Report Submitted</h3>
        <p className="text-sm text-gray-400">Your report is being processed by the enrichment queue.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
          <Camera className="w-5 h-5 text-red-600" /> Field Report
        </h3>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase font-bold text-gray-500">Description</label>
        <textarea 
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the avalanche (size, type, impact)..."
          className="bg-black border border-zinc-800 rounded p-2 text-sm focus:border-red-600 outline-none h-24 resize-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase font-bold text-gray-500">Photo Evidence</label>
        <input 
          type="file" 
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
          className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 border border-red-500 rounded text-red-200 text-[10px] flex items-start gap-2">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="p-3 bg-black border border-zinc-800 rounded flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-600" />
            <p className="text-[10px] font-bold uppercase text-gray-500">Location</p>
          </div>
          <button 
            type="button"
            onClick={() => setIsManual(!isManual)}
            className="text-[8px] uppercase font-bold text-red-500 hover:text-red-400"
          >
            {isManual ? 'Use GPS' : 'Edit Manually'}
          </button>
        </div>
        
        {isManual ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[8px] text-gray-600 uppercase">Longitude</label>
              <input 
                type="number" 
                step="0.000001"
                value={manualLng}
                onChange={(e) => {
                  setManualLng(e.target.value);
                  handleManualChange();
                }}
                className="bg-zinc-900 border border-zinc-800 rounded p-1 text-xs font-mono outline-none focus:border-red-600"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[8px] text-gray-600 uppercase">Latitude</label>
              <input 
                type="number" 
                step="0.000001"
                value={manualLat}
                onChange={(e) => {
                  setManualLat(e.target.value);
                  handleManualChange();
                }}
                className="bg-zinc-900 border border-zinc-800 rounded p-1 text-xs font-mono outline-none focus:border-red-600"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono">{location ? `${location[1].toFixed(4)}, ${location[0].toFixed(4)}` : 'Detecting...'}</p>
        )}
      </div>

      <button 
        disabled={loading || !location}
        className="mt-2 w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 text-white font-bold rounded flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        SUBMIT REPORT
      </button>
    </form>
  );
};
