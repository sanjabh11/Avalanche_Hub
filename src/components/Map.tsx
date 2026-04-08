import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AvalancheEvent, Forecast } from '../types';
import { getRiskColor } from '../lib/utils';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  events: AvalancheEvent[];
  forecasts: Forecast[];
  onRegionSelect: (bbox: [number, number, number, number]) => void;
  showExposureOverlay?: boolean;
}

function MapEvents({ onRegionSelect }: { onRegionSelect: (bbox: [number, number, number, number]) => void }) {
  const map = useMap();
  
  useEffect(() => {
    map.on('moveend', () => {
      const bounds = map.getBounds();
      onRegionSelect([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ]);
    });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const size = 0.05; // ~5km
      onRegionSelect([
        lng - size,
        lat - size,
        lng + size,
        lat + size
      ]);
      map.setView([lat, lng], 12);
    });
  }, [map, onRegionSelect]);

  return null;
}

export const AvalancheMap: React.FC<MapProps> = ({ events, forecasts, onRegionSelect, showExposureOverlay }) => {
  return (
    <MapContainer
      center={[32.2432, 77.1892]} // Manali, HMA
      zoom={10}
      className="w-full h-full"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      
      {showExposureOverlay && (
        <TileLayer
          url="https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=mock"
          opacity={0.3}
          className="mix-blend-overlay"
        />
      )}
      
      <MapEvents onRegionSelect={onRegionSelect} />

      {/* Forecast Grid */}
      {forecasts.map((f) => {
        const gridDensity = 20; // Increased from 10
        const lngSize = (f.bbox[2] - f.bbox[0]) / gridDensity;
        const latSize = (f.bbox[3] - f.bbox[1]) / gridDensity;
        
        return (
          <React.Fragment key={f.id}>
            {f.gridData.map((cell, idx) => {
              const bounds: [[number, number], [number, number]] = [
                [cell.lat - latSize/2, cell.lng - lngSize/2],
                [cell.lat + latSize/2, cell.lng + lngSize/2]
              ];
              return (
                <Rectangle
                  key={`${f.id}-${idx}`}
                  bounds={bounds}
                  interactive={false}
                  pathOptions={{
                    fillColor: getRiskColor(cell.score),
                    fillOpacity: showExposureOverlay ? 0.6 : 0.3,
                    weight: 0.2,
                    color: '#ffffff11',
                    interactive: false
                  }}
                />
              );
            })}
          </React.Fragment>
        );
      })}

      {/* Historical Events */}
      {events.map((e) => (
        <Marker 
          key={e.id} 
          position={[e.location.coordinates[1], e.location.coordinates[0]]}
        >
          <Popup>
            <div className="p-2 max-w-[200px]">
              <h3 className="font-bold text-sm">{e.type.toUpperCase()}</h3>
              <p className="text-xs text-gray-500">{new Date(e.timestamp).toLocaleDateString()}</p>
              <p className="text-xs mt-1">{e.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] px-1 bg-red-900 text-white rounded">S:{e.severity}</span>
                <span className="text-[10px] px-1 bg-blue-900 text-white rounded">C:{(e.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
