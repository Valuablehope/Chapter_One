// Rate limiting protects a network-facing server; the on-device API has no remote callers.
export default function rateLimit() { return (_req: any, _res: any, next: () => void) => next(); }
export const ipKeyGenerator = (ip: string) => ip;
