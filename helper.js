const path = require('path');
const { default: PQueue } = require('p-queue');
const _ = require('lodash');
const { UPDATE_CONFIG_TYPE } = require('./constants');
const config = require('./config');
const {
  maxSize,
  exts,
  compressConcurrency,
  configFileName,
  basePath,
  kb2byteMuti,
} = config;
const {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} = require('fs');

const { fileCompress, fileFilter, commonFilter, getFileList } = require('./src/core');

console.error = str => console.log('\x1b[31m' + str + '\x1b[0m');
console.success = str => console.log('\x1b[32m' + str + '\x1b[0m');
console.warn = str => console.log('\x1b[33m' + str + '\x1b[0m');

let currentCompressCount = 0;
let alreadyCompressCount = 0;

const updateConfig = ({ key, value, type }) => {
  const configPath = path.join(__dirname, configFileName);
  let cfg = readFileSync(configPath, { encoding: 'utf-8' });
  cfg = JSON.parse(cfg);
  switch (type) {
    case UPDATE_CONFIG_TYPE.UPDATE:
      cfg[key] = value;
      break;
    case UPDATE_CONFIG_TYPE.DELETE:
      delete cfg[key];
      break;
    default:
      console.error(`type应为：${Object.keys(UPDATE_CONFIG_TYPE).join(' | ')}中的一个`);
  }
  writeFileSync(configPath, JSON.stringify(cfg));
};

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
  if (!existsSync(fullFilename)) {
    console.warn('文件不存在，请确认路径');
    return;
  }
  const stats = statSync(fullFilename);
  if (!commonFilter(fullFilename, stats)) {
    console.warn('文件不满足要求，请确认');
    return;
  }
  await fileCompress({ name: fullFilename, size: stats.size }, options, cliCallbacks);
};

const batchFileCompress = (inputPath, options) => {
  const { minSize, deep, retain, output } = _.merge(config, options);
  const fullPath = basePath ? path.join(basePath, inputPath) : inputPath;
  console.log('本次执行脚本的配置：', {
    exts,
    maxSize,
    minSize,
    deep,
    retain,
    output,
    basePath,
    path: inputPath,
    fullPath,
  });
  if (!existsSync(fullPath)) {
    console.warn(`文件夹不存在，请确认路径：${fullPath}`);
    return;
  }
  const stats = statSync(fullPath);
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

module.exports = {
  singleFileCompress,
  batchFileCompress,
  updateConfig,
  UPDATE_CONFIG_TYPE,
};
