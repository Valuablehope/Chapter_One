// Node file APIs do not exist on device; callers (env lookup, legacy upload migration) must fall through.
const no = () => false;
export const existsSync = no;
export const mkdirSync = () => undefined;
export const readdirSync = () => [] as string[];
export const readFileSync = () => { throw new Error('fs is not available on device'); };
export const writeFileSync = () => undefined;
export const copyFileSync = () => undefined;
export const unlinkSync = () => undefined;
export const statSync = () => { throw new Error('fs is not available on device'); };
export default { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, statSync };
