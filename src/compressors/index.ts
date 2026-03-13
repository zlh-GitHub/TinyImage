export type { ICompressor, CompressorOutput } from './types';
export { CompressorRegistry } from './registry';
export { TinyPNGCompressor } from './tinypng';
export { MozJPEGCompressor } from './mozjpeg';

import { CompressorRegistry } from './registry';
import { TinyPNGCompressor } from './tinypng';
import { MozJPEGCompressor } from './mozjpeg';

/**
 * Default registry with built-in compressors.
 * To add support for a new format, implement ICompressor and call
 * defaultRegistry.register(new MyCompressor()).
 *
 * Built-in compressors:
 *   png        → TinyPNGCompressor (remote API)
 *   jpg/jpeg   → MozJPEGCompressor (local, via sharp + mozjpeg)
 *
 * Planned:
 *   svg        → SVGCompressor (svgo)
 *   webp       → WebPCompressor (sharp)
 */
export const defaultRegistry = new CompressorRegistry()
  .register(new TinyPNGCompressor())
  .register(new MozJPEGCompressor());
