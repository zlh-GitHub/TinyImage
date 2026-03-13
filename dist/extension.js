"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs_1 = require("fs");
const p_queue_1 = __importDefault(require("p-queue"));
const core_1 = require("./src/core");
const config_json_1 = __importDefault(require("./config.json"));
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
        minSize: cfg.get('minSize', config_json_1.default.minSize),
        retain: cfg.get('retain', false),
        deep: cfg.get('deep', true),
    };
}
function makeCallbacks(total, log, progress) {
    let done = 0;
    let failed = 0;
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
            done++;
            failed++;
            const msg = err instanceof Error ? err.message : '未知错误';
            log(`[失败 ${done}/${total}] ${name}  ${msg}`);
            progress.report({ message: `${done}/${total}`, increment });
        },
        getFailedCount: () => failed,
    };
}
async function compressFiles(files, options, progress) {
    const channel = getOutputChannel();
    channel.show(true);
    channel.appendLine(`\n──────────────────────────────`);
    channel.appendLine(`开始压缩，共 ${files.length} 张图片`);
    const callbacks = makeCallbacks(files.length, msg => channel.appendLine(msg), progress);
    const queue = new p_queue_1.default({ concurrency: config_json_1.default.compressConcurrency });
    for (const file of files) {
        queue.add(() => (0, core_1.fileCompress)(file, options, callbacks));
    }
    await queue.onIdle();
    const failed = callbacks.getFailedCount();
    const succeeded = files.length - failed;
    channel.appendLine(failed > 0 ? `压缩完成：${succeeded} 张成功，${failed} 张失败` : `压缩完成`);
    channel.appendLine(`──────────────────────────────`);
    return failed;
}
function filterImageUris(uris, minSize) {
    return uris.reduce((res, uri) => {
        const p = uri.fsPath;
        if (!(0, fs_1.existsSync)(p))
            return res;
        const stats = (0, fs_1.statSync)(p);
        if ((0, core_1.commonFilter)(p, stats) && stats.size >= (0, core_1.kb2byte)(minSize)) {
            res.push({ name: p, size: stats.size });
        }
        return res;
    }, []);
}
function activate(context) {
    // ── 命令：压缩图片文件 ───────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('tinypng.compressFile', async (uri, uris) => {
        const rawUris = uris && uris.length > 0
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
            vscode.window.showWarningMessage('TinyPNG: 没有符合条件的图片（支持 png/jpg/jpeg，单文件上限 5MB）');
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `TinyPNG 压缩中`,
            cancellable: false,
        }, async (progress) => {
            progress.report({ increment: 0, message: `0/${files.length}` });
            const failed = await compressFiles(files, { retain }, progress);
            const succeeded = files.length - failed;
            progress.report({
                message: failed > 0 ? `完成：${succeeded} 成功 ${failed} 失败` : `完成`,
            });
            await new Promise(r => setTimeout(r, 1500));
            vscode.window.showInformationMessage(failed > 0
                ? `TinyPNG: ${succeeded} 张成功，${failed} 张失败，详情见输出面板`
                : `TinyPNG: ${files.length} 张图片压缩完成，详情见输出面板`);
        });
    }));
    // ── 命令：压缩文件夹内图片 ──────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('tinypng.compressFolder', async (uri) => {
        var _a, _b, _c;
        const folderPath = (_a = uri === null || uri === void 0 ? void 0 : uri.fsPath) !== null && _a !== void 0 ? _a : (_c = (_b = vscode.workspace.workspaceFolders) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.uri.fsPath;
        if (!folderPath || !(0, fs_1.existsSync)(folderPath)) {
            vscode.window.showWarningMessage('TinyPNG: 请选择有效的文件夹');
            return;
        }
        const { retain, minSize, deep } = getSettings();
        const fileList = (0, core_1.getFileList)(folderPath);
        const files = (0, core_1.fileFilter)(fileList, minSize, deep);
        if (files.length === 0) {
            vscode.window.showInformationMessage('TinyPNG: 该文件夹下没有符合条件的图片');
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `TinyPNG 压缩中`,
            cancellable: false,
        }, async (progress) => {
            progress.report({ increment: 0, message: `0/${files.length}` });
            const failed = await compressFiles(files, { retain }, progress);
            const succeeded = files.length - failed;
            progress.report({
                message: failed > 0 ? `完成：${succeeded} 成功 ${failed} 失败` : `完成`,
            });
            await new Promise(r => setTimeout(r, 1500));
            vscode.window.showInformationMessage(failed > 0
                ? `TinyPNG: ${succeeded} 张成功，${failed} 张失败，详情见输出面板`
                : `TinyPNG: ${files.length} 张图片压缩完成，详情见输出面板`);
        });
    }));
}
function deactivate() {
    outputChannel === null || outputChannel === void 0 ? void 0 : outputChannel.dispose();
}
//# sourceMappingURL=extension.js.map