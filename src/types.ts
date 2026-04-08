export interface AvalancheEvent {
  id: string;
  timestamp: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  source: string;
  description: string;
  severity: number;
  type: 'dry-slab' | 'wet-snow' | 'glide' | 'loose-snow';
  features: Record<string, any>;
  confidence: number;
  createdAt: string;
}

export interface Forecast {
  id: string;
  timestamp: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  riskScore: number;
  hazard: number;
  exposure: number;
  vulnerability: number;
  problemType: string;
  shapValues: Record<string, number>;
  gridData: {
    lng: number;
    lat: number;
    score: number;
  }[];
  createdAt: string;
}

export interface FieldReport {
  id: string;
  uid: string;
  timestamp: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  imageUrl: string;
  description: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

export interface ComputeJob {
  id: string;
  type: 'daily_enrichment' | 'feature_engineering' | 'weekly_fine_tune';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  payload: any;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
