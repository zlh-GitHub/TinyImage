import sharp from 'sharp';
import { ICompressor, CompressorOutput } from './types';

export interface MozJPEGOptions {
  /** JPEG quality (1–100, default: 75) */
  quality?: number;
  /**
   * Minimum quality floor when doing adaptive retry (default: 60).
   * The compressor will try quality, quality-5, quality-10 ... until the
   * result is smaller than the input or this floor is reached.
   */
  minQuality?: number;
}

export class MozJPEGCompressor implements ICompressor {
  readonly name = 'mozjpeg';
  readonly supportedExtensions = ['jpg', 'jpeg'];

  private readonly quality: number;
  private readonly minQuality: number;

  constructor({ quality = 75, minQuality = 60 }: MozJPEGOptions = {}) {
    this.quality = quality;
    this.minQuality = minQuality;
  }

  async compress(inputBuffer: Buffer): Promise<CompressorOutput> {
    // Try decreasing quality in steps until the output is smaller than the
    // input or we reach the minQuality floor. Each step uses mozjpeg-specific
    // optimizations (trellis quantisation + scan optimisation) for maximum
    // compression at a given quality level.
    let q = this.quality;
    while (q >= this.minQuality) {
      const compressed = await sharp(inputBuffer)
        .jpeg({ quality: q, mozjpeg: true, optimiseScans: true, trellisQuantisation: true })
        .toBuffer();

      if (compressed.length < inputBuffer.length) {
        return {
          buffer: compressed,
          size: compressed.length,
          ratio: compressed.length / inputBuffer.length,
        };
      }
      q -= 5;
    }

    // All attempts produced a larger file — return the last result so that
    // core.ts can trigger the onSkip path.
    const fallback = await sharp(inputBuffer)
      .jpeg({ quality: this.minQuality, mozjpeg: true, optimiseScans: true, trellisQuantisation: true })
      .toBuffer();
    return {
      buffer: fallback,
      size: fallback.length,
      ratio: fallback.length / inputBuffer.length,
    };
  }
}
