#! /usr/bin/env node
const inquirer = require('inquirer');
const autocomplete = require('inquirer-autocomplete-prompt');
const ListPrompt = require('inquirer/lib/prompts/list');
const observe = require('inquirer/lib/utils/events');
const { takeUntil } = require('rxjs/operators');
const { default: PQueue } = require('p-queue');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fileCompress, fileFilter, commonFilter, getFileList } = require('./src/core');

const config = require('./config.json');
const { compressConcurrency, basePath, kb2byteMuti } = config;

console.error = str => console.log('\x1b[31m' + str + '\x1b[0m');
console.success = str => console.log('\x1b[32m' + str + '\x1b[0m');
console.warn = str => console.log('\x1b[33m' + str + '\x1b[0m');

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
  onError: (name, err) => console.error(`【${name}】：压缩失败：${err?.message || '未知错误'}`),
};

const singleFileCompress = async (filename, options) => {
  const fullFilename = basePath ? path.join(basePath, filename) : filename;
  if (!fs.existsSync(fullFilename)) {
    console.warn('文件不存在，请确认路径');
    return;
  }
  const stats = fs.statSync(fullFilename);
  if (!commonFilter(fullFilename, stats)) {
    console.warn('文件不满足要求，请确认');
    return;
  }
  await fileCompress({ name: fullFilename, size: stats.size }, options, cliCallbacks);
};

const batchFileCompress = (inputPath, options) => {
  const { minSize, deep, retain, output } = { ...config, ...options };
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
  const fileList = getFileList(fullPath);
  const filteredList = fileFilter(fileList, minSize, deep);
  currentCompressCount = filteredList.length;
  alreadyCompressCount = 0;
  console.log('此次处理文件的数量:', currentCompressCount);

  const queue = new PQueue({ concurrency: compressConcurrency, autoStart: false, timeout: 5000 });
  filteredList.forEach(file => {
    queue.add(() => fileCompress(file, { output, retain }, cliCallbacks));
  });
  queue.start();
};

// 支持 Tab 键切换选项的 list prompt
class TabListPrompt extends ListPrompt {
  _run(cb) {
    const result = super._run(cb);
    const events = observe(this.rl);
    events.keypress
      .pipe(takeUntil(events.line))
      .forEach(({ key }) => {
        if (key && key.name === 'tab') this.onDownKey();
      });
    return result;
  }
}

inquirer.registerPrompt('autocomplete', autocomplete);
inquirer.registerPrompt('list', TabListPrompt);

function createPathSource(dirOnly = false) {
  return function pathSource(answers, input) {
    const val = input || '';
    const expanded = val.startsWith('~') ? os.homedir() + val.slice(1) : val;
    const isSlash = expanded.endsWith('/') || expanded.endsWith(path.sep);
    const dir = isSlash ? (expanded || '.') : (path.dirname(expanded) || '.');
    const base = isSlash ? '' : path.basename(expanded);

    try {
      const entries = fs.readdirSync(dir);
      return entries
        .filter(e => {
          if (base && !e.startsWith(base)) return false;
          if (dirOnly) {
            try { return fs.statSync(path.join(dir, e)).isDirectory(); } catch { return false; }
          }
          return true;
        })
        .map(e => {
          try {
            const stat = fs.statSync(path.join(dir, e));
            const rawDir = path.dirname(val);
            const prefix = isSlash ? val : (rawDir === '.' ? '' : rawDir + '/');
            return prefix + e + (stat.isDirectory() ? '/' : '');
          } catch {
            return path.join(dir, e);
          }
        });
    } catch {
      return [];
    }
  };
}

const CONFIG_PATH = path.join(__dirname, 'config.json');

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
  const { inputPath } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'inputPath',
      message: '图片路径：',
      suggestOnly: true,
      source: createPathSource(),
      validate: v => v.trim() ? true : '路径不能为空',
    },
  ]);
  const { retain } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'retain',
      message: '保留原文件（另存为 .tiny 后缀）？',
      default: false,
    },
  ]);
  await singleFileCompress(inputPath.trim(), { retain });
}

async function promptDir() {
  const { inputPath } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'inputPath',
      message: '文件夹路径：',
      suggestOnly: true,
      source: createPathSource(true),
      validate: v => v.trim() ? true : '路径不能为空',
    },
  ]);
  batchFileCompress(inputPath.trim(), { deep: true, retain: false, output: '' });
}

function viewConfig() {
  const { basePath, minSize } = readConfig();
  console.log(`  basePath（基路径）：${basePath || '（未设置）'}`);
  console.log(`  minSize（最小压缩大小）：${minSize} KB`);
}

async function promptEditConfig() {
  const current = readConfig();
  const { basePath, minSize } = await inquirer.prompt([
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
      validate: v => (Number.isInteger(v) && v > 0) ? true : '请输入正整数',
    },
  ]);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, basePath, minSize }));
  console.log('配置已更新');
}

async function main() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'TinyPNG 图片压缩工具，请选择操作：',
      loop: false,
      choices: [
        { name: '压缩文件夹', value: ACTIONS.DIR },
        { name: '压缩单张图片', value: ACTIONS.FILE },
        new inquirer.Separator(),
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
