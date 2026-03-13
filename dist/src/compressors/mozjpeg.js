"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MozJPEGCompressor = void 0;
const sharp_1 = __importDefault(require("sharp"));
class MozJPEGCompressor {
    constructor({ quality = 75, minQuality = 60 } = {}) {
        this.name = 'mozjpeg';
        this.supportedExtensions = ['jpg', 'jpeg'];
        this.quality = quality;
        this.minQuality = minQuality;
    }
    async compress(inputBuffer) {
        // Try decreasing quality in steps until the output is smaller than the
        // input or we reach the minQuality floor. Each step uses mozjpeg-specific
        // optimizations (trellis quantisation + scan optimisation) for maximum
        // compression at a given quality level.
        let q = this.quality;
        while (q >= this.minQuality) {
            const compressed = await (0, sharp_1.default)(inputBuffer)
                .jpeg({ quality: q, mozjpeg: true, optimiseScans: true, trellisQuantisation: true })
                .toBuffer();
            if (compressed.length < inputBuffer.length) {
                return {
                    buffer: compressed,
                    size: compressed.length,
                    ratio: compressed.length / inputBuffer.length,
                };
            }
            q -= 5;
        }
        // All attempts produced a larger file — return the last result so that
        // core.ts can trigger the onSkip path.
        const fallback = await (0, sharp_1.default)(inputBuffer)
            .jpeg({ quality: this.minQuality, mozjpeg: true, optimiseScans: true, trellisQuantisation: true })
            .toBuffer();
        return {
            buffer: fallback,
            size: fallback.length,
            ratio: fallback.length / inputBuffer.length,
        };
    }
}
exports.MozJPEGCompressor = MozJPEGCompressor;
//# sourceMappingURL=mozjpeg.js.map