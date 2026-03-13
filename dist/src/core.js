"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileCompress = exports.fileFilter = exports.getFileList = exports.commonFilter = exports.kb2byte = void 0;
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const promise_retry_1 = __importDefault(require("promise-retry"));
const fs_1 = require("fs");
const config_json_1 = __importDefault(require("../config.json"));
const { maxSize, exts, maxRetryCount, kb2byteMuti } = config_json_1.default;
const kb2byte = (kb) => kb * kb2byteMuti;
exports.kb2byte = kb2byte;
const getRandomIP = () => Array.from(Array(4)).map(() => Math.floor(Math.random() * 255)).join('.');
const getAjaxOptions = (IP) => ({
    method: 'POST',
    url: 'https://tinify.cn/backend/opt/shrink',
    headers: {
        rejectUnauthorized: false,
        'X-Forwarded-For': IP,
        'Postman-Token': Date.now(),
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
    },
});
const getTinyImageName = (filename) => {
    const reg = new RegExp(`(.+)(?=\\.(${exts.join('|')})$)`);
    return filename.replace(reg, old => `${old}.tiny`);
};
const splitDirAndName = (p) => ({
    dir: path_1.default.dirname(p),
    name: path_1.default.basename(p),
});
const streamToPromise = (stream) => new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
});
const commonFilter = (filename, stats) => stats.size <= (0, exports.kb2byte)(maxSize) &&
    stats.isFile() &&
    exts.includes(path_1.default.extname(filename).slice(1).toLowerCase());
exports.commonFilter = commonFilter;
const getFileList = (folder) => (0, fs_1.readdirSync)(folder).map(file => path_1.default.join(folder, file));
exports.getFileList = getFileList;
const fileFilter = (filenameArr, minSize = 0, deep) => filenameArr.reduce((res, filename) => {
    const stats = (0, fs_1.statSync)(filename);
    if (stats.size >= (0, exports.kb2byte)(minSize) && (0, exports.commonFilter)(filename, stats)) {
        return [...res, { name: filename, size: stats.size }];
    }
    else if (stats.isDirectory() && deep) {
        return [...res, ...(0, exports.fileFilter)((0, exports.getFileList)(filename), minSize, deep)];
    }
    return res;
}, []);
exports.fileFilter = fileFilter;
const download = async (url, dir, imageName) => {
    const outputPath = path_1.default.join(dir, imageName);
    const response = await (0, axios_1.default)({ method: 'get', url, responseType: 'stream' });
    if (!(0, fs_1.existsSync)(dir)) {
        (0, fs_1.mkdirSync)(dir, { recursive: true });
    }
    const writer = (0, fs_1.createWriteStream)(outputPath);
    response.data.pipe(writer);
    await streamToPromise(writer);
};
const fileCompress = ({ name: filename, size: originSize }, { retain, output }, callbacks = {}) => {
    const { onRetry = () => { }, onSuccess = () => { }, onError = () => { } } = callbacks;
    return (0, promise_retry_1.default)(async (retry, number) => {
        const { dir, name } = splitDirAndName(filename);
        if (number > 1) {
            onRetry(name, number);
        }
        try {
            const ajaxOptions = getAjaxOptions(getRandomIP());
            const { data } = await (0, axios_1.default)({ ...ajaxOptions, data: (0, fs_1.readFileSync)(filename) });
            if (data.error) {
                retry(new Error(data.error));
                return;
            }
            const result = { name, originSize, output: data.output };
            onSuccess(result);
            await download(data.output.url, output ? path_1.default.join(dir, output) : dir, retain ? getTinyImageName(name) : name);
            return result;
        }
        catch (error) {
            if (number < maxRetryCount) {
                retry(error);
            }
            else {
                onError(name, error);
            }
        }
    });
};
exports.fileCompress = fileCompress;
//# sourceMappingURL=core.js.map