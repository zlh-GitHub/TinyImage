import axios from 'axios';
import { ICompressor, CompressorOutput } from './types';

const TINYPNG_API = 'https://tinify.cn/backend/opt/shrink';

const getRandomIP = (): string =>
  Array.from(Array(4))
    .map(() => Math.floor(Math.random() * 255))
    .join('.');

export class TinyPNGCompressor implements ICompressor {
  readonly name = 'tinypng';
  readonly supportedExtensions = ['png'];

  async compress(inputBuffer: Buffer): Promise<CompressorOutput> {
    const { data } = await axios({
      method: 'POST',
      url: TINYPNG_API,
      headers: {
        rejectUnauthorized: false,
        'X-Forwarded-For': getRandomIP(),
        'Postman-Token': Date.now(),
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
      },
      data: inputBuffer,
    });

    if (data.error) {
      throw new Error(data.error);
    }

    const response = await axios({
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
