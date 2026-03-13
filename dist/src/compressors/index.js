"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRegistry = exports.MozJPEGCompressor = exports.TinyPNGCompressor = exports.CompressorRegistry = void 0;
var registry_1 = require("./registry");
Object.defineProperty(exports, "CompressorRegistry", { enumerable: true, get: function () { return registry_1.CompressorRegistry; } });
var tinypng_1 = require("./tinypng");
Object.defineProperty(exports, "TinyPNGCompressor", { enumerable: true, get: function () { return tinypng_1.TinyPNGCompressor; } });
var mozjpeg_1 = require("./mozjpeg");
Object.defineProperty(exports, "MozJPEGCompressor", { enumerable: true, get: function () { return mozjpeg_1.MozJPEGCompressor; } });
const registry_2 = require("./registry");
const tinypng_2 = require("./tinypng");
const mozjpeg_2 = require("./mozjpeg");
/**
 * Default registry with built-in compressors.
 * To add support for a new format, implement ICompressor and call
 * defaultRegistry.register(new MyCompressor()).
 *
 * Built-in compressors:
 *   png        → TinyPNGCompressor (remote API)
 *   jpg/jpeg   → MozJPEGCompressor (local, via sharp + mozjpeg)
 *
 * Planned:
 *   svg        → SVGCompressor (svgo)
 *   webp       → WebPCompressor (sharp)
 */
exports.defaultRegistry = new registry_2.CompressorRegistry()
    .register(new tinypng_2.TinyPNGCompressor())
    .register(new mozjpeg_2.MozJPEGCompressor());
//# sourceMappingURL=index.js.map