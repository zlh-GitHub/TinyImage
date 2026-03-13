export interface CompressorOutput {
  buffer: Buffer;
  size: number;
  ratio: number;
}

export interface ICompressor {
  readonly name: string;
  readonly supportedExtensions: string[];
  compress(inputBuffer: Buffer): Promise<CompressorOutput>;
}
