export interface LocalRequestInit {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  file?: unknown;
}
export interface LocalResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  cookies: { name: string; value: string; options?: unknown }[];
}
export interface SetupInput {
  storeName: string;
  adminUsername: string;
  adminFullName?: string;
  adminPassword: string;
  mode: 'standalone' | 'linked';
}
export function openDeviceDatabase(opts?: { dataDir?: string }): Promise<unknown>;
export function isDeviceSetUp(): Promise<boolean>;
export function setupDevice(input: SetupInput): Promise<{ storeId: string }>;
export function createLocalApi(): { request(init: LocalRequestInit): Promise<LocalResponse> };
