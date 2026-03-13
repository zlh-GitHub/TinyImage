"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TinyPNGCompressor = void 0;
const axios_1 = __importDefault(require("axios"));
const TINYPNG_API = 'https://tinify.cn/backend/opt/shrink';
const getRandomIP = () => Array.from(Array(4))
    .map(() => Math.floor(Math.random() * 255))
    .join('.');
class TinyPNGCompressor {
    constructor() {
        this.name = 'tinypng';
        this.supportedExtensions = ['png'];
    }
    async compress(inputBuffer) {
        const { data } = await (0, axios_1.default)({
            method: 'POST',
            url: TINYPNG_API,
            headers: {
                rejectUnauthorized: false,
                'X-Forwarded-For': getRandomIP(),
                'Postman-Token': Date.now(),
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
            },
            data: inputBuffer,
        });
        if (data.error) {
            throw new Error(data.error);
        }
        const response = await (0, axios_1.default)({
            method: 'get',
            url: data.output.url,
            responseType: 'arraybuffer',
        });
        const buffer = Buffer.from(response.data);
        return {
            buffer,
            size: data.output.size,
            ratio: data.output.ratio,
        };
    }
}
exports.TinyPNGCompressor = TinyPNGCompressor;
//# sourceMappingURL=tinypng.js.map