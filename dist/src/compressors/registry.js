"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompressorRegistry = void 0;
class CompressorRegistry {
    constructor() {
        this.compressors = new Map();
    }
    register(compressor) {
        for (const ext of compressor.supportedExtensions) {
            this.compressors.set(ext.toLowerCase(), compressor);
        }
        return this;
    }
    get(ext) {
        return this.compressors.get(ext.toLowerCase());
    }
    getSupportedExtensions() {
        return Array.from(this.compressors.keys());
    }
}
exports.CompressorRegistry = CompressorRegistry;
//# sourceMappingURL=registry.js.map