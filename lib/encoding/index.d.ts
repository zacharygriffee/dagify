export declare function encodeValue<T = unknown>(
  value: T,
  encoder: string
): Uint8Array;

export declare function decodeValue<T = unknown>(
  value: Uint8Array,
  encoder: string
): T;
