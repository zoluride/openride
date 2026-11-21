import * as Location from 'expo-location';

import { supabase } from './supabase';

// Foreground location streaming. Expo Go only supports foreground; background
// streaming (screen off / app backgrounded) needs a custom dev client with an
// expo-location background task — a later upgrade.
let sub: Location.LocationSubscription | null = null;

export class LocationError extends Error {
  constructor(
    message: string,
    public readonly code: 'permission_denied' | 'push_failed' | 'unknown',
  ) {
    super(message);
    this.name = 'LocationError';
  }
}

export async function startLocationStreaming(driverId: string): Promise<void> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationError('Location permission is required to go online.', 'permission_denied');
  }

  // Push once immediately so the driver appears on the map without waiting.
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await pushLocation(driverId, pos);
  } catch (e) {
    // Log but don't block; the watcher will catch up
    console.warn('Initial location push failed:', e);
  }

  sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 20 },
    (pos) => {
      void pushLocation(driverId, pos).catch((e) => {
        console.warn('Location push failed:', e);
      });
    },
  );
}

export function stopLocationStreaming(): void {
  sub?.remove();
  sub = null;
}

async function pushLocation(driverId: string, pos: Location.LocationObject): Promise<void> {
  const { error } = await supabase.from('driver_location_latest').upsert(
    {
      driver_id: driverId,
      point: `SRID=4326;POINT(${pos.coords.longitude} ${pos.coords.latitude})`,
      recorded_at: new Date(pos.timestamp).toISOString(),
      speed_mps: pos.coords.speed,
      heading_deg: pos.coords.heading,
      accuracy_m: pos.coords.accuracy,
    },
    { onConflict: 'driver_id' },
  );
  if (error) {
    throw new LocationError(`Failed to push location: ${error.message}`, 'push_failed');
  }
}
