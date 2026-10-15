const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/');
export const sep = '/';
export const join = (...p: string[]) => norm(p.filter(Boolean).join('/'));
export const resolve = (...p: string[]) => norm(p.filter(Boolean).join('/'));
export const dirname = (p: string) => norm(p).replace(/\/[^/]*$/, '') || '/';
export const basename = (p: string, ext?: string) => {
  const b = norm(p).split('/').pop() || '';
  return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
};
export const extname = (p: string) => {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i) : '';
};
export default { sep, join, resolve, dirname, basename, extname };
