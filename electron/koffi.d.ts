declare module "koffi" {
  type KoffiFn = (...args: unknown[]) => unknown;
  const koffi: {
    load: (name: string) => {
      func: (sig: string) => KoffiFn;
    };
    struct: (name: string, fields: Record<string, unknown>) => unknown;
    proto: (sig: string) => unknown;
    pointer: (type: unknown) => unknown;
    register: (fn: KoffiFn, sig: string | unknown) => unknown;
    unregister: (fn: unknown) => void;
    encode: (type: unknown, value: unknown) => Buffer;
    decode: (ptr: unknown, type: unknown) => unknown;
    sizeof: (type: unknown) => number;
    union: (nameOrFields: string | Record<string, unknown>, fields?: Record<string, unknown>) => unknown;
  };
  export default koffi;
}
