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











