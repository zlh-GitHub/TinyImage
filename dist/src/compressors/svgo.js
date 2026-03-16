"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGOCompressor = void 0;
const svgo_1 = require("svgo");
class SVGOCompressor {
    constructor() {
        this.name = 'svgo';
        this.supportedExtensions = ['svg'];
    }
    async compress(inputBuffer) {
        const input = inputBuffer.toString('utf8');
        const result = (0, svgo_1.optimize)(input, {
            multipass: true,
            plugins: ['preset-default'],
        });
        const output = Buffer.from(result.data, 'utf8');
        return {
            buffer: output,
            size: output.length,
            ratio: output.length / inputBuffer.length,
        };
    }
}
exports.SVGOCompressor = SVGOCompressor;
//# sourceMappingURL=svgo.js.map