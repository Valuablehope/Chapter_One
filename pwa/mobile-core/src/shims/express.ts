/**
 * Minimal in-process stand-in for Express, covering only what the Chapter One backend routes,
 * controllers and middleware use. It lets the real route files run unchanged on the device.
 */
type Next = (err?: any) => void;
type Handler = (req: any, res: any, next: Next) => any;
type ErrorHandler = (err: any, req: any, res: any, next: Next) => any;

interface Layer {
  method: string | null; // null = middleware (use)
  segments: string[];
  handlers: (Handler | ErrorHandler | RouterImpl)[];
}

const splitPath = (p: string) => p.split('/').filter(Boolean);

function matchSegments(pattern: string[], parts: string[], prefix: boolean): Record<string, string> | null {
  if (prefix ? parts.length < pattern.length : parts.length !== pattern.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const seg = pattern[i];
    if (seg === '*') return params;
    if (seg.startsWith(':')) {
      let name = seg.slice(1);
      if (name.endsWith('?')) name = name.slice(0, -1);
      params[name] = decodeURIComponent(parts[i]);
    } else if (seg !== parts[i]) return null;
  }
  return params;
}

export class RouterImpl {
  stack: Layer[] = [];

  private add(method: string | null, args: any[]) {
    let path = '/';
    if (typeof args[0] === 'string') path = args.shift();
    this.stack.push({ method, segments: splitPath(path), handlers: args.flat() });
    return this;
  }
  use(...args: any[]) { return this.add(null, args); }
  all(...args: any[]) { return this.add('*', args); }
  get(...args: any[]) { return this.add('GET', args); }
  post(...args: any[]) { return this.add('POST', args); }
  put(...args: any[]) { return this.add('PUT', args); }
  patch(...args: any[]) { return this.add('PATCH', args); }
  delete(...args: any[]) { return this.add('DELETE', args); }
  head(...args: any[]) { return this.add('HEAD', args); }
  options() { return this; }
  set() { return this; }

  handle(req: any, res: any, done: Next) {
    const parts = splitPath(req.path);
    // Flatten matching layers into one ordered handler list.
    const chain: { h: any; params: Record<string, string>; strip: number }[] = [];
    for (const layer of this.stack) {
      const isUse = layer.method === null;
      if (!isUse && layer.method !== '*' && layer.method !== req.method) continue;
      const params = matchSegments(layer.segments, parts, isUse);
      if (!params) continue;
      for (const h of layer.handlers) chain.push({ h, params, strip: isUse ? layer.segments.length : 0 });
    }
    let i = 0;
    const next: Next = (err) => {
      const item = chain[i++];
      if (!item) return done(err);
      const { h, params, strip } = item;
      const saved = { path: req.path, params: req.params, baseUrl: req.baseUrl };
      const restore = () => { req.path = saved.path; req.params = saved.params; req.baseUrl = saved.baseUrl; };
      req.params = { ...saved.params, ...params };
      try {
        if (h instanceof RouterImpl) {
          if (err) { restore(); return next(err); }
          req.path = '/' + parts.slice(strip).join('/');
          h.handle(req, res, (e) => { restore(); next(e); });
        } else if (h.length === 4) {
          if (!err) { restore(); return next(); }
          Promise.resolve((h as ErrorHandler)(err, req, res, (e) => { restore(); next(e); })).catch((e) => next(e));
        } else {
          if (err) { restore(); return next(err); }
          Promise.resolve((h as Handler)(req, res, (e) => { restore(); next(e); })).catch((e) => next(e));
        }
      } catch (e) {
        restore();
        next(e);
      }
    };
    next();
  }
}

export interface LocalRequestInit {
  method: string;
  url: string; // path + query, e.g. /api/products?limit=1
  headers?: Record<string, string>;
  body?: any;
  file?: any;
}
export interface LocalResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  cookies: { name: string; value: string; options?: any }[];
}

class App extends RouterImpl {
  /** Dispatch one request through the app and resolve with the response. */
  dispatch(init: LocalRequestInit): Promise<LocalResponse> {
    return new Promise((resolve) => {
      const [path, qs = ''] = init.url.split('?');
      const query: Record<string, any> = {};
      new URLSearchParams(qs).forEach((v, k) => {
        if (k in query) query[k] = ([] as any[]).concat(query[k], v);
        else query[k] = v;
      });
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(init.headers || {})) headers[k.toLowerCase()] = String(v);
      const req: any = {
        method: init.method.toUpperCase(), path, originalUrl: init.url, url: init.url, baseUrl: '',
        query, params: {}, body: init.body ?? {}, headers, cookies: {}, file: init.file, files: undefined,
        secure: true, ip: '127.0.0.1',
        get(name: string) { return headers[name.toLowerCase()]; },
        header(name: string) { return headers[name.toLowerCase()]; },
        socket: { remoteAddress: '127.0.0.1' },
      };
      const out: LocalResponse = { status: 200, headers: {}, body: undefined, cookies: [] };
      let finished = false;
      const finish = () => { if (!finished) { finished = true; resolve(out); } };
      const res: any = {
        statusCode: 200, headersSent: false, locals: {},
        status(c: number) { out.status = c; this.statusCode = c; return this; },
        setHeader(k: string, v: any) { out.headers[k.toLowerCase()] = String(v); return this; },
        set(k: any, v?: any) { if (typeof k === 'object') for (const x in k) this.setHeader(x, k[x]); else this.setHeader(k, v); return this; },
        header(k: string, v: any) { return this.setHeader(k, v); },
        getHeader(k: string) { return out.headers[k.toLowerCase()]; },
        type(t: string) { return this.setHeader('content-type', t); },
        cookie(name: string, value: string, options?: any) { out.cookies.push({ name, value, options }); return this; },
        clearCookie(name: string) { out.cookies.push({ name, value: '', options: { expires: new Date(0) } }); return this; },
        json(b: any) { out.body = b === undefined ? null : JSON.parse(JSON.stringify(b)); this.headersSent = true; finish(); return this; },
        send(b: any) { out.body = b; this.headersSent = true; finish(); return this; },
        end(b?: any) { if (b !== undefined) out.body = b; this.headersSent = true; finish(); return this; },
        redirect(a: any, b?: any) { out.status = typeof a === 'number' ? a : 302; out.headers.location = String(typeof a === 'number' ? b : a); finish(); },
        on() { return this; },
        once() { return this; },
      };
      this.handle(req, res, (err) => {
        if (finished) return;
        out.status = err ? 500 : 404;
        out.body = err ? { error: String(err?.message || err) } : { error: 'Not found', path };
        finish();
      });
    });
  }
}

function express() { return new App(); }
express.Router = () => new RouterImpl();
express.json = () => (_req: any, _res: any, next: Next) => next();
express.urlencoded = () => (_req: any, _res: any, next: Next) => next();
express.static = () => (_req: any, _res: any, next: Next) => next();

export function Router() { return new RouterImpl(); }
export { App };
export default express;
export type Request = any;
export type Response = any;
export type NextFunction = Next;
export type Express = App;
