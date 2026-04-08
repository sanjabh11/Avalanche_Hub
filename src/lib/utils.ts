import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}

export function getRiskColor(score: number) {
  const colors = [
    '#10b981', // 1: Low (Green)
    '#facc15', // 2: Moderate (Yellow)
    '#f97316', // 3: Considerable (Orange)
    '#ef4444', // 4: High (Red)
    '#7f1d1d', // 5: Extreme (Dark Red)
  ];
  return colors[Math.min(Math.max(Math.floor(score) - 1, 0), 4)];
}
