#! /usr/bin/env node
const inquirer = require('inquirer');
const autocomplete = require('inquirer-autocomplete-prompt');
const ListPrompt = require('inquirer/lib/prompts/list');
const observe = require('inquirer/lib/utils/events');
const { takeUntil } = require('rxjs/operators');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  singleFileCompress,
  batchFileCompress,
} = require('./helper');

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
