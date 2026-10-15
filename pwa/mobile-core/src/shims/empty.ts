// Placeholder for Node-only modules that PGlite references only on its Node code path.
export const createRequire = () => () => { throw new Error('Not available in the browser'); };
export default {};
