import { ICompressor } from './types';

export class CompressorRegistry {
  private readonly compressors = new Map<string, ICompressor>();

  register(compressor: ICompressor): this {
    for (const ext of compressor.supportedExtensions) {
      this.compressors.set(ext.toLowerCase(), compressor);
    }
    return this;
  }

  get(ext: string): ICompressor | undefined {
    return this.compressors.get(ext.toLowerCase());
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.compressors.keys());
  }
}
