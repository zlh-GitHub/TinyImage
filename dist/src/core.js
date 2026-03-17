"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileCompress = exports.fileFilter = exports.getFileList = exports.commonFilter = exports.kb2byte = void 0;
exports.rejectReason = rejectReason;
exports.getAllFilePaths = getAllFilePaths;
exports.buildNoFilesMessage = buildNoFilesMessage;
const path_1 = __importDefault(require("path"));
const promise_retry_1 = __importDefault(require("promise-retry"));
const fs_1 = require("fs");
const config_json_1 = __importDefault(require("../config.json"));
const compressors_1 = require("./compressors");
const { maxSize, exts, maxRetryCount, kb2byteMuti } = config_json_1.default;
const kb2byte = (kb) => kb * kb2byteMuti;
exports.kb2byte = kb2byte;
const getTinyImageName = (filename) => {
    const reg = new RegExp(`(.+)(?=\\.(${exts.join('|')})$)`);
    return filename.replace(reg, old => `${old}.tiny`);
};
const splitDirAndName = (p) => ({
    dir: path_1.default.dirname(p),
    name: path_1.default.basename(p),
});
const commonFilter = (filename, stats) => stats.size <= (0, exports.kb2byte)(maxSize) &&
    stats.isFile() &&
    compressors_1.defaultRegistry.getSupportedExtensions().includes(path_1.default.extname(filename).slice(1).toLowerCase());
exports.commonFilter = commonFilter;
const getFileList = (folder) => (0, fs_1.readdirSync)(folder).map(file => path_1.default.join(folder, file));
exports.getFileList = getFileList;
/** 判断单个文件被过滤掉的原因，通过则返回 null */
function rejectReason(filePath, minSizeKb) {
    if (!(0, fs_1.existsSync)(filePath))
        return null;
    const stats = (0, fs_1.statSync)(filePath);
    if (!stats.isFile())
        return null;
    const ext = path_1.default.extname(filePath).slice(1).toLowerCase();
    if (!compressors_1.defaultRegistry.getSupportedExtensions().includes(ext))
        return 'unsupported';
    if (stats.size > (0, exports.kb2byte)(maxSize))
        return 'tooLarge';
    if (stats.size < (0, exports.kb2byte)(minSizeKb))
        return 'tooSmall';
    return null;
}
/** 递归收集目录下所有文件路径 */
function getAllFilePaths(dir, deep) {
    const result = [];
    try {
        for (const entry of (0, fs_1.readdirSync)(dir)) {
            const full = path_1.default.join(dir, entry);
            try {
                const s = (0, fs_1.statSync)(full);
                if (s.isFile())
                    result.push(full);
                else if (s.isDirectory() && deep)
                    result.push(...getAllFilePaths(full, deep));
            }
            catch { /* skip unreadable entries */ }
        }
    }
    catch { /* skip unreadable dirs */ }
    return result;
}
/** 根据一批文件路径的拒绝原因，构建人性化提示文案 */
function buildNoFilesMessage(paths, minSizeKb) {
    const supported = compressors_1.defaultRegistry.getSupportedExtensions();
    let unsupported = 0, tooSmall = 0, tooLarge = 0;
    for (const p of paths) {
        const r = rejectReason(p, minSizeKb);
        if (r === 'unsupported')
            unsupported++;
        else if (r === 'tooSmall')
            tooSmall++;
        else if (r === 'tooLarge')
            tooLarge++;
    }
    if (unsupported > 0 && tooSmall === 0 && tooLarge === 0)
        return `没有符合条件的图片，支持格式：${supported.join('/')}`;
    if (tooSmall > 0 && unsupported === 0 && tooLarge === 0)
        return `没有符合条件的图片，所有文件均小于最小压缩大小（${minSizeKb}KB）`;
    if (tooLarge > 0 && unsupported === 0 && tooSmall === 0)
        return `没有符合条件的图片，所有文件均超过大小上限（${maxSize / 1024}MB）`;
    const parts = [];
    if (unsupported > 0)
        parts.push(`不支持的格式 ${unsupported} 个（支持：${supported.join('/')}）`);
    if (tooSmall > 0)
        parts.push(`小于 ${minSizeKb}KB 的文件 ${tooSmall} 个`);
    if (tooLarge > 0)
        parts.push(`超过 ${maxSize / 1024}MB 的文件 ${tooLarge} 个`);
    return parts.length ? `没有符合条件的图片（${parts.join('；')}）` : '未找到任何文件';
}
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
const fileCompress = ({ name: filename, size: originSize }, { retain, output }, callbacks = {}) => {
    const { onRetry = () => { }, onSuccess = () => { }, onSkip = () => { }, onError = () => { } } = callbacks;
    return (0, promise_retry_1.default)(async (retry, number) => {
        const { dir, name } = splitDirAndName(filename);
        if (number > 1) {
            onRetry(name, number);
        }
        try {
            const ext = path_1.default.extname(filename).slice(1).toLowerCase();
            const compressor = compressors_1.defaultRegistry.get(ext);
            if (!compressor) {
                throw new Error(`Unsupported format: .${ext}`);
            }
            const inputBuffer = (0, fs_1.readFileSync)(filename);
            const compressed = await compressor.compress(inputBuffer);
            if (compressed.size >= originSize) {
                onSkip(name);
                return undefined;
            }
            const result = {
                name,
                originSize,
                output: { size: compressed.size, ratio: compressed.ratio },
            };
            onSuccess(result);
            const outputDir = output ? path_1.default.join(dir, output) : dir;
            const outputName = retain ? getTinyImageName(name) : name;
            if (!(0, fs_1.existsSync)(outputDir)) {
                (0, fs_1.mkdirSync)(outputDir, { recursive: true });
            }
            (0, fs_1.writeFileSync)(path_1.default.join(outputDir, outputName), compressed.buffer);
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