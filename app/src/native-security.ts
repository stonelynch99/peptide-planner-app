import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

// Install before importing the application/Supabase. Web keeps its browser WebCrypto.
if (Platform.OS !== 'web') {
  const target = globalThis as unknown as { crypto?: Crypto };
  const current = target.crypto ?? ({} as Crypto);
  Object.defineProperty(current, 'getRandomValues', {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (!array || !ArrayBuffer.isView(array) || array instanceof DataView ||
          array instanceof Float32Array || array instanceof Float64Array) {
        throw new TypeError('An integer typed array is required.');
      }
      if (array.byteLength > 65536) throw new RangeError('Random request exceeds 65536 bytes.');
      ExpoCrypto.getRandomValues(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
      return array;
    },
  });
  Object.defineProperty(current, 'randomUUID', {
    configurable: true,
    value: () => ExpoCrypto.randomUUID(),
  });
  const subtle = current.subtle ?? ({} as SubtleCrypto);
  Object.defineProperty(subtle, 'digest', {
    configurable: true,
    value: async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
      if (name?.toUpperCase() !== 'SHA-256') throw new Error('Unsupported digest algorithm.');
      if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
        throw new TypeError('Digest input must be bytes.');
      }
      const bytes = data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      // Copy exactly the view; never digest bytes outside a caller's slice.
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
    },
  });
  Object.defineProperty(current, 'subtle', { configurable: true, value: subtle });
  if (!target.crypto) Object.defineProperty(globalThis, 'crypto', { configurable: true, value: current });
}
