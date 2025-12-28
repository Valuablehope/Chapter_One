// Device fingerprint utility for Electron frontend
// Note: This runs in the renderer process, so we can't use Node.js modules directly
// We'll use a simpler approach with available browser APIs

export interface DeviceInfo {
  platform: string;
  userAgent: string;
  language: string;
  screenResolution: string;
  timezone: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
}

export function generateDeviceFingerprint(): string {
  const deviceInfo: DeviceInfo = {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory,
  };

  // Create a hash from device info
  const deviceString = JSON.stringify(deviceInfo);
  
  // Simple hash function (since we can't use crypto in renderer easily)
  let hash = 0;
  for (let i = 0; i < deviceString.length; i++) {
    const char = deviceString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex string and pad to 32 chars
  const hexHash = Math.abs(hash).toString(16).padStart(32, '0');
  return hexHash.substring(0, 32);
}

export function getDeviceInfo(): DeviceInfo {
  return {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory,
  };
}











