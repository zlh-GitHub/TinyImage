import path from 'path';
import promiseRetry from 'promise-retry';
import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import type { Stats } from 'fs';

import config from '../config.json';
import { defaultRegistry } from './compressors';

const { maxSize, exts, maxRetryCount, kb2byteMuti } = config;

export const kb2byte = (kb: number): number => kb * kb2byteMuti;

export interface ImageFile {
  name: string;
  size: number;
}

export interface CompressOutput {
  size: number;
  ratio: number;
}

export interface CompressResult {
  name: string;
  originSize: number;
  output: CompressOutput;
}

export interface CompressOptions {
  retain: boolean;
  output?: string;
}

export interface CompressCallbacks {
  onRetry?: (name: string, number: number) => void;
  onSuccess?: (result: CompressResult) => void;
  onSkip?: (name: string) => void;
  onError?: (name: string, error: unknown) => void;
}

const getTinyImageName = (filename: string): string => {
  const reg = new RegExp(`(.+)(?=\\.(${exts.join('|')})$)`);
  return filename.replace(reg, old => `${old}.tiny`);
};

const splitDirAndName = (p: string) => ({
  dir: path.dirname(p),
  name: path.basename(p),
});

export const commonFilter = (filename: string, stats: Stats): boolean =>
  stats.size <= kb2byte(maxSize) &&
  stats.isFile() &&
  defaultRegistry.getSupportedExtensions().includes(path.extname(filename).slice(1).toLowerCase());

export const getFileList = (folder: string): string[] =>
  readdirSync(folder).map(file => path.join(folder, file));

export const fileFilter = (filenameArr: string[], minSize = 0, deep?: boolean): ImageFile[] =>
  filenameArr.reduce<ImageFile[]>((res, filename) => {
    const stats = statSync(filename);
    if (stats.size >= kb2byte(minSize) && commonFilter(filename, stats)) {
      return [...res, { name: filename, size: stats.size }];
    } else if (stats.isDirectory() && deep) {
      return [...res, ...fileFilter(getFileList(filename), minSize, deep)];
    }
    return res;
  }, []);

export const fileCompress = (
  { name: filename, size: originSize }: ImageFile,
  { retain, output }: CompressOptions,
  callbacks: CompressCallbacks = {},
): Promise<CompressResult | undefined> => {
  const { onRetry = () => {}, onSuccess = () => {}, onSkip = () => {}, onError = () => {} } = callbacks;
  return promiseRetry(async (retry, number) => {
    const { dir, name } = splitDirAndName(filename);
    if (number > 1) {
      onRetry(name, number);
    }
    try {
      const ext = path.extname(filename).slice(1).toLowerCase();
      const compressor = defaultRegistry.get(ext);
      if (!compressor) {
        throw new Error(`Unsupported format: .${ext}`);
      }

      const inputBuffer = readFileSync(filename);
      const compressed = await compressor.compress(inputBuffer);

      if (compressed.size >= originSize) {
        onSkip(name);
        return undefined;
      }

      const result: CompressResult = {
        name,
        originSize,
        output: { size: compressed.size, ratio: compressed.ratio },
      };
      onSuccess(result);

      const outputDir = output ? path.join(dir, output) : dir;
      const outputName = retain ? getTinyImageName(name) : name;
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      writeFileSync(path.join(outputDir, outputName), compressed.buffer);

      return result;
    } catch (error) {
      if (number < maxRetryCount) {
        retry(error);
      } else {
        onError(name, error);
      }
    }
  });
};
