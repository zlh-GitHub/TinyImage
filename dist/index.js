#! /usr/bin/env node
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
const inquirer_1 = __importDefault(require("inquirer"));
const inquirer_autocomplete_prompt_1 = __importDefault(require("inquirer-autocomplete-prompt"));
const list_1 = __importDefault(require("inquirer/lib/prompts/list"));
const events_1 = __importDefault(require("inquirer/lib/utils/events"));
const operators_1 = require("rxjs/operators");
const p_queue_1 = __importDefault(require("p-queue"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const core_1 = require("./src/core");
const config_json_1 = __importDefault(require("./config.json"));
const { compressConcurrency, basePath, kb2byteMuti } = config_json_1.default;
console.error = (str) => console.log('\x1b[31m' + str + '\x1b[0m');
console.success = (str) => console.log('\x1b[32m' + str + '\x1b[0m');
console.warn = (str) => console.log('\x1b[33m' + str + '\x1b[0m');
let currentCompressCount = 0;
let alreadyCompressCount = 0;
const logSuccess = ({ name, originSize, output }) => {
    const optimized = ((1 - output.ratio) * 100).toFixed(2);
    let log = `${currentCompressCount ? `${++alreadyCompressCount}/${currentCompressCount}` : ''}【${name}】：压缩成功，`;
    log += `优化比例: ${optimized}% ，`;
    log += `原始大小: ${(originSize / kb2byteMuti).toFixed(2)}KB ，`;
    log += `压缩大小: ${(output.size / kb2byteMuti).toFixed(2)}KB`;
    console[Number(optimized) === 0 ? 'warn' : 'success'](log);
};
const cliCallbacks = {
    onRetry: (name, number) => console.error(`【${name}】：压缩失败！第${number}次尝试压缩\n`),
    onSuccess: logSuccess,
    onSkip: (name) => console.warn(`${currentCompressCount ? `${++alreadyCompressCount}/${currentCompressCount}` : ''}【${name}】：压缩后更大，已跳过`),
    onError: (name, err) => console.error(`${currentCompressCount ? `${++alreadyCompressCount}/${currentCompressCount}` : ''}【${name}】：压缩失败：${err instanceof Error ? err.message : '未知错误'}`),
};
const singleFileCompress = async (filename, options) => {
    const fullFilename = basePath ? path.join(basePath, filename) : filename;
    if (!fs.existsSync(fullFilename)) {
        console.warn('文件不存在，请确认路径');
        return;
    }
    const stats = fs.statSync(fullFilename);
    if (!(0, core_1.commonFilter)(fullFilename, stats)) {
        console.warn('文件不满足要求，请确认');
        return;
    }
    await (0, core_1.fileCompress)({ name: fullFilename, size: stats.size }, options, cliCallbacks);
};
const batchFileCompress = (inputPath, options) => {
    const { minSize } = config_json_1.default;
    const { deep, retain, output } = options;
    const fullPath = basePath ? path.join(basePath, inputPath) : inputPath;
    if (!fs.existsSync(fullPath)) {
        console.warn(`文件夹不存在，请确认路径：${fullPath}`);
        return;
    }
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
        console.warn(`路径${fullPath}指向不是文件夹，请确认`);
        return;
    }
    const fileList = (0, core_1.getFileList)(fullPath);
    const filteredList = (0, core_1.fileFilter)(fileList, minSize, deep);
    currentCompressCount = filteredList.length;
    alreadyCompressCount = 0;
    console.log('此次处理文件的数量:', currentCompressCount);
    const queue = new p_queue_1.default({ concurrency: compressConcurrency, autoStart: false, timeout: 5000 });
    filteredList.forEach(file => {
        queue.add(() => (0, core_1.fileCompress)(file, { output, retain }, cliCallbacks));
    });
    queue.start();
};
// 支持 Tab 键切换选项的 list prompt
class TabListPrompt extends list_1.default {
    _run(cb) {
        const result = super._run(cb);
        const events = (0, events_1.default)(this.rl);
        events.keypress
            .pipe((0, operators_1.takeUntil)(events.line))
            .forEach(({ key }) => {
            if (key && key.name === 'tab')
                this.onDownKey();
        });
        return result;
    }
}
inquirer_1.default.registerPrompt('autocomplete', inquirer_autocomplete_prompt_1.default);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
inquirer_1.default.registerPrompt('list', TabListPrompt);
function normalizeSep(p) {
    return p.replace(/\/{2,}/g, '/');
}
function createPathSource(dirOnly = false) {
    return function pathSource(_answers, input) {
        const raw = normalizeSep(input || '');
        const val = raw.startsWith('~') ? os.homedir() + raw.slice(1) : raw;
        const isSlash = val.endsWith('/');
        const dir = isSlash ? (val || '.') : (path.dirname(val) || '.');
        const base = isSlash ? '' : path.basename(val);
        try {
            const entries = fs.readdirSync(dir);
            return entries
                .filter(e => {
                if (base && !e.startsWith(base))
                    return false;
                if (dirOnly) {
                    try {
                        return fs.statSync(path.join(dir, e)).isDirectory();
                    }
                    catch {
                        return false;
                    }
                }
                return true;
            })
                .map(e => {
                try {
                    const stat = fs.statSync(path.join(dir, e));
                    const rawDir = path.dirname(raw);
                    const prefix = isSlash ? raw : (rawDir === '.' ? '' : rawDir + '/');
                    return normalizeSep(prefix + e) + (stat.isDirectory() ? '/' : '');
                }
                catch {
                    return path.join(dir, e);
                }
            });
        }
        catch {
            return [];
        }
    };
}
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
function readConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}
const ACTIONS = {
    FILE: 'file',
    DIR: 'dir',
    CONFIG_VIEW: 'config.view',
    CONFIG_EDIT: 'config.edit',
};
async function promptFile() {
    const { inputPath } = await inquirer_1.default.prompt([
        {
            type: 'autocomplete',
            name: 'inputPath',
            message: '图片路径：',
            suggestOnly: true,
            source: createPathSource(),
            validate: (v) => ((v === null || v === void 0 ? void 0 : v.trim()) ? true : '路径不能为空'),
        },
    ]);
    await singleFileCompress(inputPath.trim(), { retain: readConfig().retain });
}
async function promptDir() {
    const { inputPath } = await inquirer_1.default.prompt([
        {
            type: 'autocomplete',
            name: 'inputPath',
            message: '文件夹路径：',
            suggestOnly: true,
            source: createPathSource(true),
            validate: (v) => ((v === null || v === void 0 ? void 0 : v.trim()) ? true : '路径不能为空'),
        },
    ]);
    batchFileCompress(inputPath.trim(), { deep: true, retain: readConfig().retain, output: '' });
}
function viewConfig() {
    const { basePath: bp, minSize, retain } = readConfig();
    console.log(`  basePath（基路径）：${bp || '（未设置）'}`);
    console.log(`  minSize（最小压缩大小）：${minSize} KB`);
    console.log(`  retain（保留原文件）：${retain ? '是' : '否'}`);
}
async function promptEditConfig() {
    const current = readConfig();
    const { basePath: newBasePath, minSize, retain } = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'basePath',
            message: '基路径 (basePath，留空表示不设置)：',
            default: current.basePath || '',
        },
        {
            type: 'number',
            name: 'minSize',
            message: '最小压缩文件大小 (minSize，单位 KB)：',
            default: current.minSize,
            validate: (v) => (Number.isInteger(v) && v > 0) ? true : '请输入正整数',
        },
        {
            type: 'confirm',
            name: 'retain',
            message: '保留原文件（另存为 .tiny 后缀）？',
            default: current.retain,
        },
    ]);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, basePath: newBasePath, minSize, retain }));
    console.log('配置已更新');
}
async function main() {
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'TinyPNG 图片压缩工具，请选择操作：',
            loop: false,
            choices: [
                { name: '压缩文件夹', value: ACTIONS.DIR },
                { name: '压缩单张图片', value: ACTIONS.FILE },
                new inquirer_1.default.Separator(),
                { name: '查看当前配置', value: ACTIONS.CONFIG_VIEW },
                { name: '修改当前配置', value: ACTIONS.CONFIG_EDIT },
            ],
        },
    ]);
    switch (action) {
        case ACTIONS.FILE:
            await promptFile();
            break;
        case ACTIONS.DIR:
            await promptDir();
            break;
        case ACTIONS.CONFIG_VIEW:
            viewConfig();
            break;
        case ACTIONS.CONFIG_EDIT:
            await promptEditConfig();
            break;
    }
}
main().catch(err => {
    // 用户 Ctrl+C 退出，静默处理
    if (err.message && !err.message.includes('force closed')) {
        console.error(err.message);
    }
});
//# sourceMappingURL=index.js.map