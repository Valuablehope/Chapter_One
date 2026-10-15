// TCP scale devices are driven by the host PC; not available on a phone/tablet.
export class Socket { constructor() { throw new Error('Network scales are not supported on this device'); } }
export default { Socket };
