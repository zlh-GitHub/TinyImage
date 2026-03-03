const path = require('path');
const axios = require('axios');
const promiseRetry = require('promise-retry');
const {
  mkdirSync,
  existsSync,
  createWriteStream,
  readFileSync,
  readdirSync,
  statSync,
} = require('fs');

const config = require('../config.json');
const { maxSize, exts, maxRetryCount, kb2byteMuti } = config;

const kb2byte = kb => kb * kb2byteMuti;

const getRandomIP = () =>
  Array.from(Array(4)).map(() => parseInt(Math.random() * 255)).join('.');

const getAjaxOptions = IP => ({
  method: 'POST',
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

const getTinyImageName = filename => {
  const reg = new RegExp(`(.+)(?=\\.(${exts.join('|')})$)`);
  return filename.replace(reg, old => `${old}.tiny`);
};

const splitDirAndName = p => ({
  dir: path.dirname(p),
  name: path.basename(p),
});

const streamToPromise = stream =>
  new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

const commonFilter = (filename, stats) =>
  stats.size <= kb2byte(maxSize) &&
  stats.isFile() &&
  exts.includes(path.extname(filename).slice(1).toLowerCase());

const getFileList = folder =>
  readdirSync(folder).map(file => path.join(folder, file));

/**
 * 过滤文件，返回符合条件的图片列表
 * @param {string[]} filenameArr
 * @param {number} minSize KB
 * @param {boolean} deep 是否递归子目录
 * @returns {{ name: string, size: number }[]}
 */
const fileFilter = (filenameArr, minSize = 0, deep) =>
  filenameArr.reduce((res, filename) => {
    const stats = statSync(filename);
    if (stats.size >= kb2byte(minSize) && commonFilter(filename, stats)) {
      return [...res, { name: filename, size: stats.size }];
    } else if (stats.isDirectory() && deep) {
      return [...res, ...fileFilter(getFileList(filename), minSize, deep)];
    }
    return res;
  }, []);

/**
 * 下载图片到指定目录
 * @param {string} url
 * @param {string} dir
 * @param {string} imageName
 */
const download = async (url, dir, imageName) => {
  const outputPath = path.join(dir, imageName);
  const response = await axios({ method: 'get', url, responseType: 'stream' });
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const writer = createWriteStream(outputPath);
  response.data.pipe(writer);
  await streamToPromise(writer);
};

/**
 * 压缩单张图片
 * @param {{ name: string, size: number }} image
 * @param {{ retain: boolean, output?: string }} options
 * @param {{ onRetry?: Function, onSuccess?: Function, onError?: Function }} callbacks
 */
const fileCompress = ({ name: filename, size: originSize }, { retain, output }, callbacks = {}) => {
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
        retry();
        return;
      }
      const result = { name, originSize, output: data.output };
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

module.exports = {
  fileCompress,
  fileFilter,
  commonFilter,
  getFileList,
  kb2byte,
};
