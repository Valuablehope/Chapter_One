// Uploads on device arrive already read by the app layer (req.file is set by the local client).
function multer() {
  const pass = () => (_req: any, _res: any, next: () => void) => next();
  return { single: pass, array: pass, fields: pass, none: pass, any: pass };
}
multer.diskStorage = () => ({});
multer.memoryStorage = () => ({});
class MulterError extends Error {}
(multer as any).MulterError = MulterError;
export { MulterError };
export default multer;
