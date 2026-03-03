const vscode = require('vscode');
const path = require('path');
const { existsSync, statSync } = require('fs');
const { default: PQueue } = require('p-queue');

const { fileCompress, fileFilter, commonFilter, getFileList, kb2byte } = require('./src/core');
const config = require('./config.json');

/** @type {vscode.OutputChannel | undefined} */
let outputChannel;

function getOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('TinyPNG');
  }
  return outputChannel;
}

function getSettings() {
  const cfg = vscode.workspace.getConfiguration('tinypng');
  return {
    minSize: cfg.get('minSize', config.minSize),
    retain: cfg.get('retain', false),
    deep: cfg.get('deep', true),
  };
}

/**
 * 创建压缩回调（绑定日志输出和进度通知）
 * @param {number} total
 * @param {(msg: string) => void} log
 * @param {{ report: (v: { message?: string, increment?: number }) => void }} progress
 */
function makeCallbacks(total, log, progress) {
  let done = 0;
  const increment = total > 0 ? 100 / total : 0;
  return {
    onRetry: (name, number) => {
      log(`[重试] ${name}  第 ${number} 次`);
    },
    onSuccess: ({ name, originSize, output }) => {
      done++;
      const optimized = ((1 - output.ratio) * 100).toFixed(1);
      const from = (originSize / 1024).toFixed(1);
      const to = (output.size / 1024).toFixed(1);
      log(`[${done}/${total}] ${name}  -${optimized}%  ${from}KB → ${to}KB`);
      progress.report({ message: `${done}/${total}`, increment });
    },
    onError: (name, err) => {
      log(`[失败] ${name}  ${err?.message || '未知错误'}`);
    },
  };
}

/**
 * 批量压缩文件列表
 * @param {{ name: string, size: number }[]} files
 * @param {{ retain: boolean, output?: string }} options
 * @param {{ report: Function }} progress
 */
async function compressFiles(files, options, progress) {
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
  channel.appendLine(`压缩完成`);
  channel.appendLine(`──────────────────────────────`);
}

/**
 * 从 URI 列表中筛选出符合条件的图片
 * @param {vscode.Uri[]} uris
 * @param {number} minSize KB
 * @returns {{ name: string, size: number }[]}
 */
function filterImageUris(uris, minSize) {
  return uris.reduce((res, uri) => {
    const p = uri.fsPath;
    if (!existsSync(p)) return res;
    const stats = statSync(p);
    if (commonFilter(p, stats) && stats.size >= kb2byte(minSize)) {
      res.push({ name: p, size: stats.size });
    }
    return res;
  }, []);
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  // ── 命令：压缩图片文件 ───────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('tinypng.compressFile', async (uri, uris) => {
      // 优先使用多选列表，否则用右键单击的 uri，最后尝试当前编辑器
      const rawUris =
        uris && uris.length > 0
          ? uris
          : uri
          ? [uri]
          : vscode.window.activeTextEditor
          ? [vscode.window.activeTextEditor.document.uri]
          : [];

      if (rawUris.length === 0) {
        vscode.window.showWarningMessage('TinyPNG: 请在资源管理器中右键选择图片文件');
        return;
      }

      const { retain, minSize } = getSettings();
      const files = filterImageUris(rawUris, minSize);

      if (files.length === 0) {
        vscode.window.showWarningMessage(
          'TinyPNG: 没有符合条件的图片（支持 png/jpg/jpeg，单文件上限 5MB）',
        );
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `TinyPNG 压缩中`,
          cancellable: false,
        },
        async progress => {
          progress.report({ increment: 0, message: `0/${files.length}` });
          await compressFiles(files, { retain }, progress);
        },
      );

      vscode.window.showInformationMessage(
        `TinyPNG: ${files.length} 张图片压缩完成，详情见输出面板`,
      );
    }),
  );

  // ── 命令：压缩文件夹内图片 ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('tinypng.compressFolder', async uri => {
      const folderPath =
        uri?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (!folderPath || !existsSync(folderPath)) {
        vscode.window.showWarningMessage('TinyPNG: 请选择有效的文件夹');
        return;
      }

      const { retain, minSize, deep } = getSettings();
      const fileList = getFileList(folderPath);
      const files = fileFilter(fileList, minSize, deep);

      if (files.length === 0) {
        vscode.window.showInformationMessage('TinyPNG: 该文件夹下没有符合条件的图片');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `TinyPNG 压缩中`,
          cancellable: false,
        },
        async progress => {
          progress.report({ increment: 0, message: `0/${files.length}` });
          await compressFiles(files, { retain }, progress);
        },
      );

      vscode.window.showInformationMessage(
        `TinyPNG: ${files.length} 张图片压缩完成，详情见输出面板`,
      );
    }),
  );
}

function deactivate() {
  outputChannel?.dispose();
}

module.exports = { activate, deactivate };
