"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRegistry = exports.SVGOCompressor = exports.MozJPEGCompressor = exports.TinyPNGCompressor = exports.CompressorRegistry = void 0;
var registry_1 = require("./registry");
Object.defineProperty(exports, "CompressorRegistry", { enumerable: true, get: function () { return registry_1.CompressorRegistry; } });
var tinypng_1 = require("./tinypng");
Object.defineProperty(exports, "TinyPNGCompressor", { enumerable: true, get: function () { return tinypng_1.TinyPNGCompressor; } });
var mozjpeg_1 = require("./mozjpeg");
Object.defineProperty(exports, "MozJPEGCompressor", { enumerable: true, get: function () { return mozjpeg_1.MozJPEGCompressor; } });
var svgo_1 = require("./svgo");
Object.defineProperty(exports, "SVGOCompressor", { enumerable: true, get: function () { return svgo_1.SVGOCompressor; } });
const registry_2 = require("./registry");
const tinypng_2 = require("./tinypng");
const mozjpeg_2 = require("./mozjpeg");
const svgo_2 = require("./svgo");
/**
 * Default registry with built-in compressors.
 * To add support for a new format, implement ICompressor and call
 * defaultRegistry.register(new MyCompressor()).
 *
 * Built-in compressors:
 *   png        → TinyPNGCompressor (remote API)
 *   jpg/jpeg   → MozJPEGCompressor (local, via sharp + mozjpeg)
 *   svg        → SVGOCompressor (local, via svgo)
 *
 * Planned:
 *   webp       → WebPCompressor (sharp)
 */
exports.defaultRegistry = new registry_2.CompressorRegistry()
    .register(new tinypng_2.TinyPNGCompressor())
    .register(new mozjpeg_2.MozJPEGCompressor())
    .register(new svgo_2.SVGOCompressor());
//# sourceMappingURL=index.js.map