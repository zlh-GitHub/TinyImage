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

// ── 文件诊断工具（供 CLI 和 VSCode 插件共用）────────────────────────────

export type RejectReason = 'unsupported' | 'tooSmall' | 'tooLarge' | null;

/** 判断单个文件被过滤掉的原因，通过则返回 null */
export function rejectReason(filePath: string, minSizeKb: number): RejectReason {
  if (!existsSync(filePath)) return null;
  const stats = statSync(filePath);
  if (!stats.isFile()) return null;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!defaultRegistry.getSupportedExtensions().includes(ext)) return 'unsupported';
  if (stats.size > kb2byte(maxSize)) return 'tooLarge';
  if (stats.size < kb2byte(minSizeKb)) return 'tooSmall';
  return null;
}

/** 递归收集目录下所有文件路径 */
export function getAllFilePaths(dir: string, deep: boolean): string[] {
  const result: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      try {
        const s = statSync(full);
        if (s.isFile()) result.push(full);
        else if (s.isDirectory() && deep) result.push(...getAllFilePaths(full, deep));
      } catch { /* skip unreadable entries */ }
    }
  } catch { /* skip unreadable dirs */ }
  return result;
}

/** 根据一批文件路径的拒绝原因，构建人性化提示文案 */
export function buildNoFilesMessage(paths: string[], minSizeKb: number): string {
  const supported = defaultRegistry.getSupportedExtensions();
  let unsupported = 0, tooSmall = 0, tooLarge = 0;
  for (const p of paths) {
    const r = rejectReason(p, minSizeKb);
    if (r === 'unsupported') unsupported++;
    else if (r === 'tooSmall') tooSmall++;
    else if (r === 'tooLarge') tooLarge++;
  }
  if (unsupported > 0 && tooSmall === 0 && tooLarge === 0)
    return `没有符合条件的图片，支持格式：${supported.join('/')}`;
  if (tooSmall > 0 && unsupported === 0 && tooLarge === 0)
    return `没有符合条件的图片，所有文件均小于最小压缩大小（${minSizeKb}KB）`;
  if (tooLarge > 0 && unsupported === 0 && tooSmall === 0)
    return `没有符合条件的图片，所有文件均超过大小上限（${maxSize / 1024}MB）`;
  const parts: string[] = [];
  if (unsupported > 0) parts.push(`不支持的格式 ${unsupported} 个（支持：${supported.join('/')}）`);
  if (tooSmall > 0)    parts.push(`小于 ${minSizeKb}KB 的文件 ${tooSmall} 个`);
  if (tooLarge > 0)    parts.push(`超过 ${maxSize / 1024}MB 的文件 ${tooLarge} 个`);
  return parts.length ? `没有符合条件的图片（${parts.join('；')}）` : '未找到任何文件';
}

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
