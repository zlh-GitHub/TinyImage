import * as vscode from 'vscode';
import { existsSync, statSync } from 'fs';
import PQueue from 'p-queue';

import { fileCompress, fileFilter, commonFilter, getFileList, kb2byte } from './src/core';
import type { CompressCallbacks, CompressResult } from './src/core';
import config from './config.json';

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('TinyImage');
  }
  return outputChannel;
}

function getSettings() {
  const cfg = vscode.workspace.getConfiguration('tinyimage');
  return {
    minSize: cfg.get<number>('minSize', config.minSize),
    retain: cfg.get<boolean>('retain', false),
    deep: cfg.get<boolean>('deep', true),
  };
}

function makeCallbacks(
  total: number,
  log: (msg: string) => void,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
): CompressCallbacks & { getFailedCount: () => number } {
  let done = 0;
  let failed = 0;
  const increment = total > 0 ? 100 / total : 0;
  return {
    onRetry: (name, number) => {
      log(`[重试] ${name}  第 ${number} 次`);
    },
    onSuccess: ({ name, originSize, output }: CompressResult) => {
      done++;
      const optimized = ((1 - output.ratio) * 100).toFixed(1);
      const from = (originSize / 1024).toFixed(1);
      const to = (output.size / 1024).toFixed(1);
      log(`[${done}/${total}] ${name}  -${optimized}%  ${from}KB → ${to}KB`);
      progress.report({ message: `${done}/${total}`, increment });
    },
    onSkip: (name) => {
      done++;
      log(`[跳过 ${done}/${total}] ${name}  压缩后更大，保留原文件`);
      progress.report({ message: `${done}/${total}`, increment });
    },
    onError: (name, err) => {
      done++;
      failed++;
      const msg = err instanceof Error ? err.message : '未知错误';
      log(`[失败 ${done}/${total}] ${name}  ${msg}`);
      progress.report({ message: `${done}/${total}`, increment });
    },
    getFailedCount: () => failed,
  };
}

async function compressFiles(
  files: { name: string; size: number }[],
  options: { retain: boolean; output?: string },
  progress: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<number> {
  const channel = getOutputChannel();
  channel.show(true);
  channel.appendLine(`\n──────────────────────────────`);
  channel.appendLine(`开始压缩，共 ${files.length} 张图片`);

  const callbacks = makeCallbacks(files.length, msg => channel.appendLine(msg), progress);
  const queue = new PQueue({ concurrency: config.compressConcurrency });

  for (const file of files) {
    queue.add(() => fileCompress(file, options, callbacks));
  }

  await queue.onIdle();
  const failed = callbacks.getFailedCount();
  const succeeded = files.length - failed;
  channel.appendLine(
    failed > 0 ? `压缩完成：${succeeded} 张成功，${failed} 张失败` : `压缩完成`,
  );
  channel.appendLine(`──────────────────────────────`);
  return failed;
}

function filterImageUris(uris: vscode.Uri[], minSize: number): { name: string; size: number }[] {
  return uris.reduce<{ name: string; size: number }[]>((res, uri) => {
    const p = uri.fsPath;
    if (!existsSync(p)) return res;
    const stats = statSync(p);
    if (commonFilter(p, stats) && stats.size >= kb2byte(minSize)) {
      res.push({ name: p, size: stats.size });
    }
    return res;
  }, []);
}

export function activate(context: vscode.ExtensionContext): void {
  // ── 命令：压缩图片文件 ───────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('tinyimage.compressFile', async (uri: vscode.Uri, uris: vscode.Uri[]) => {
      const rawUris =
        uris && uris.length > 0
          ? uris
          : uri
          ? [uri]
          : vscode.window.activeTextEditor
          ? [vscode.window.activeTextEditor.document.uri]
          : [];

      if (rawUris.length === 0) {
        vscode.window.showWarningMessage('TinyImage: 请在资源管理器中右键选择图片文件');
        return;
      }

      const { retain, minSize } = getSettings();
      const files = filterImageUris(rawUris, minSize);

      if (files.length === 0) {
        vscode.window.showWarningMessage(
          'TinyImage: 没有符合条件的图片（支持 png/jpg/jpeg，单文件上限 5MB）',
        );
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `TinyImage 压缩中`,
          cancellable: false,
        },
        async progress => {
          progress.report({ increment: 0, message: `0/${files.length}` });
          const failed = await compressFiles(files, { retain }, progress);
          const succeeded = files.length - failed;
          progress.report({
            message: failed > 0 ? `完成：${succeeded} 成功 ${failed} 失败` : `完成`,
          });
          await new Promise<void>(r => setTimeout(r, 1500));
          vscode.window.showInformationMessage(
            failed > 0
              ? `TinyImage: ${succeeded} 张成功，${failed} 张失败，详情见输出面板`
              : `TinyImage: ${files.length} 张图片压缩完成，详情见输出面板`,
          );
        },
      );
    }),
  );

  // ── 命令：压缩文件夹内图片 ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('tinyimage.compressFolder', async (uri: vscode.Uri) => {
      const folderPath =
        uri?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (!folderPath || !existsSync(folderPath)) {
        vscode.window.showWarningMessage('TinyImage: 请选择有效的文件夹');
        return;
      }

      const { retain, minSize, deep } = getSettings();
      const fileList = getFileList(folderPath);
      const files = fileFilter(fileList, minSize, deep);

      if (files.length === 0) {
        vscode.window.showInformationMessage('TinyImage: 该文件夹下没有符合条件的图片');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `TinyImage 压缩中`,
          cancellable: false,
        },
        async progress => {
          progress.report({ increment: 0, message: `0/${files.length}` });
          const failed = await compressFiles(files, { retain }, progress);
          const succeeded = files.length - failed;
          progress.report({
            message: failed > 0 ? `完成：${succeeded} 成功 ${failed} 失败` : `完成`,
          });
          await new Promise<void>(r => setTimeout(r, 1500));
          vscode.window.showInformationMessage(
            failed > 0
              ? `TinyImage: ${succeeded} 张成功，${failed} 张失败，详情见输出面板`
              : `TinyImage: ${files.length} 张图片压缩完成，详情见输出面板`,
          );
        },
      );
    }),
  );
}

export function deactivate(): void {
  outputChannel?.dispose();
}
