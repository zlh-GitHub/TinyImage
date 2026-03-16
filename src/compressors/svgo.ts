import { optimize } from 'svgo';
import { ICompressor, CompressorOutput } from './types';

export class SVGOCompressor implements ICompressor {
  readonly name = 'svgo';
  readonly supportedExtensions = ['svg'];

  async compress(inputBuffer: Buffer): Promise<CompressorOutput> {
    const input = inputBuffer.toString('utf8');
    const result = optimize(input, {
      multipass: true,
      plugins: ['preset-default'],
    });
    const output = Buffer.from(result.data, 'utf8');
    return {
      buffer: output,
      size: output.length,
      ratio: output.length / inputBuffer.length,
    };
  }
}
