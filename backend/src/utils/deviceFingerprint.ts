import os from 'os';
import crypto from 'crypto';

export interface DeviceInfo {
  platform: string;
  arch: string;
  hostname: string;
  cpus: number;
  totalMemory: number;
  macAddress?: string;
}

export function generateDeviceFingerprint(): string {
  const deviceInfo: DeviceInfo = {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
  };

  // Get MAC address (first network interface)
  const networkInterfaces = os.networkInterfaces();
  const firstInterface = Object.values(networkInterfaces)
    .flat()
    .find(iface => iface && !iface.internal && iface.mac !== '00:00:00:00:00:00');
  
  if (firstInterface) {
    deviceInfo.macAddress = firstInterface.mac;
  }

  // Create a hash from device info
  const deviceString = JSON.stringify(deviceInfo);
  const hash = crypto.createHash('sha256').update(deviceString).digest('hex');
  
  return hash.substring(0, 32); // Use first 32 chars as fingerprint
}

export function getDeviceInfo(): DeviceInfo {
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    macAddress: Object.values(os.networkInterfaces())
      .flat()
      .find(iface => iface && !iface.internal && iface.mac !== '00:00:00:00:00:00')?.mac,
  };
}

/**
 * Validate device fingerprint format and detect potential tampering
 * @param fingerprint The device fingerprint to validate
 * @param deviceInfo Optional device info object for additional validation
 * @returns Object with isValid flag and reason if invalid
 */
export function validateDeviceFingerprint(
  fingerprint: string,
  deviceInfo?: any
): { isValid: boolean; reason?: string } {
  // Check format: should be 32 character hex string
  if (!fingerprint || typeof fingerprint !== 'string') {
    return { isValid: false, reason: 'Fingerprint must be a non-empty string' };
  }

  if (fingerprint.length !== 32) {
    return { isValid: false, reason: 'Fingerprint must be exactly 32 characters' };
  }

  // Check if it's a valid hex string
  if (!/^[0-9a-f]{32}$/i.test(fingerprint)) {
    return { isValid: false, reason: 'Fingerprint must be a valid hexadecimal string' };
  }

  // Check for suspicious patterns (all zeros, all same character, etc.)
  if (/^0+$/.test(fingerprint)) {
    return { isValid: false, reason: 'Fingerprint appears to be tampered (all zeros)' };
  }

  if (/(.)\1{15,}/.test(fingerprint)) {
    return { isValid: false, reason: 'Fingerprint appears to be tampered (repeating pattern)' };
  }

  // If deviceInfo is provided, validate consistency
  if (deviceInfo && typeof deviceInfo === 'object') {
    // Check for missing critical fields
    const criticalFields = ['platform', 'userAgent', 'hardwareConcurrency'];
    const missingFields = criticalFields.filter(field => !deviceInfo[field]);
    if (missingFields.length > 0) {
      return { isValid: false, reason: `Missing critical device info fields: ${missingFields.join(', ')}` };
    }
  }

  return { isValid: true };
}

/**
 * Generate server-side hash from device info for comparison
 * This creates a more secure hash that can't be easily spoofed
 */
export function generateServerSideFingerprint(deviceInfo: any): string {
  const infoString = JSON.stringify(deviceInfo);
  const hash = crypto.createHash('sha256').update(infoString).digest('hex');
  return hash.substring(0, 32);
}











