"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileCompress = exports.fileFilter = exports.getFileList = exports.commonFilter = exports.kb2byte = void 0;
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