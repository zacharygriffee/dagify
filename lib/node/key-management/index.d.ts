export type KeyGenerator = () => Uint8Array;

export declare let currentKeyGenerator: KeyGenerator;

export declare function registerKeyGenerator(
  name: string,
  generator: KeyGenerator
): void;

export declare function useKeyGenerator(name?: string): void;

export declare function useKeyGeneratorWhile(
  name: string,
  cb: () => void
): void;
