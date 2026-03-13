import path from 'path';
import axios from 'axios';
import promiseRetry from 'promise-retry';
import { mkdirSync, existsSync, createWriteStream, readFileSync, readdirSync, statSync } from 'fs';
import type { Stats } from 'fs';

import config from '../config.json';

const { maxSize, exts, maxRetryCount, kb2byteMuti } = config;

export const kb2byte = (kb: number): number => kb * kb2byteMuti;

export interface ImageFile {
  name: string;
  size: number;
}

export interface CompressOutput {
  url: string;
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
  onError?: (name: string, error: unknown) => void;
}

const getRandomIP = (): string =>
  Array.from(Array(4)).map(() => Math.floor(Math.random() * 255)).join('.');

const getAjaxOptions = (IP: string) => ({
  method: 'POST' as const,
  url: 'https://tinify.cn/backend/opt/shrink',
  headers: {
    rejectUnauthorized: false,
    'X-Forwarded-For': IP,
    'Postman-Token': Date.now(),
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
  },
});

const getTinyImageName = (filename: string): string => {
  const reg = new RegExp(`(.+)(?=\\.(${exts.join('|')})$)`);
  return filename.replace(reg, old => `${old}.tiny`);
};

const splitDirAndName = (p: string) => ({
  dir: path.dirname(p),
  name: path.basename(p),
});

const streamToPromise = (stream: NodeJS.ReadableStream | NodeJS.WritableStream): Promise<void> =>
  new Promise((resolve, reject) => {
    (stream as NodeJS.EventEmitter).on('finish', resolve);
    (stream as NodeJS.EventEmitter).on('error', reject);
  });

export const commonFilter = (filename: string, stats: Stats): boolean =>
  stats.size <= kb2byte(maxSize) &&
  stats.isFile() &&
  exts.includes(path.extname(filename).slice(1).toLowerCase());

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

const download = async (url: string, dir: string, imageName: string): Promise<void> => {
  const outputPath = path.join(dir, imageName);
  const response = await axios({ method: 'get', url, responseType: 'stream' });
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const writer = createWriteStream(outputPath);
  response.data.pipe(writer);
  await streamToPromise(writer);
};

export const fileCompress = (
  { name: filename, size: originSize }: ImageFile,
  { retain, output }: CompressOptions,
  callbacks: CompressCallbacks = {},
): Promise<CompressResult | undefined> => {
  const { onRetry = () => {}, onSuccess = () => {}, onError = () => {} } = callbacks;
  return promiseRetry(async (retry, number) => {
    const { dir, name } = splitDirAndName(filename);
    if (number > 1) {
      onRetry(name, number);
    }
    try {
      const ajaxOptions = getAjaxOptions(getRandomIP());
      const { data } = await axios({ ...ajaxOptions, data: readFileSync(filename) });
      if (data.error) {
        retry(new Error(data.error));
        return;
      }
      const result: CompressResult = { name, originSize, output: data.output };
      onSuccess(result);
      await download(
        data.output.url,
        output ? path.join(dir, output) : dir,
        retain ? getTinyImageName(name) : name,
      );
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
