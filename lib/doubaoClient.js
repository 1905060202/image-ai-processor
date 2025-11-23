const axios = require('axios');
const { default: pLimit } = require('p-limit');
const FormData = require('form-data');

class DoubaoClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'https://ark.cn-beijing.volces.com';
    this.concurrency = options.concurrency || 5;
    this.limiter = pLimit(this.concurrency);
    this.defaultModel = options.model || process.env.DOUBAO_IMAGE_MODEL || 'ep-xxxxxx';
    this.timeoutMs = options.timeoutMs || 60000;
  }

  /**
   * 统一 generations 接口（文生图/图生图）
   * - 文生图：仅提供 prompt
   * - 图生图：提供 prompt + image(data URL 或公开 URL)
   * @param {object} params - { prompt, imageDataUrl?, imageUrl?, size?, response_format? }
   */
  async generateImage(params = {}) {
    const payload = {
      model: params.model || this.defaultModel,
      prompt: params.prompt,
      size: params.size || '1024x1024',
      response_format: params.response_format || 'b64_json',
      stream: false,
      watermark: true,
      sequential_image_generation: 'disabled'
    };
    if (params.imageDataUrl) {
      payload.image = params.imageDataUrl;
    } else if (params.imageUrl) {
      payload.image = params.imageUrl;
    }
    try {
      const response = await axios.post(
        `${this.baseURL}/api/v3/images/generations`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeoutMs
        }
      );
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = `[doubao/generations] HTTP ${status || 'ERR'} model=${payload.model} size=${payload.size} ${data ? JSON.stringify(data) : err.message}`;
      const e = new Error(msg);
      e.status = status;
      e.data = data;
      throw e;
    }
  }

  async generate(prompt, options = {}) {
    const payload = {
      model: options.model || this.defaultModel,
      prompt,
      size: options.size || '1024x1024',
      n: options.n || 1,
      response_format: options.response_format || 'b64_json'
    };
    try {
      const response = await axios.post(
        `${this.baseURL}/api/v3/images/generations`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeoutMs
        }
      );
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = `[doubao/generations] HTTP ${status || 'ERR'} model=${payload.model} size=${payload.size} ${data ? JSON.stringify(data) : err.message}`;
      const e = new Error(msg);
      e.status = status;
      e.data = data;
      throw e;
    }
  }

  /**
   * 图生图（统一 generations 接口），取第一张图
   * @param {string[]|string} imageBase64Array
   * @param {string} prompt
   * @param {object} options - { mimeType?, size?, model?, response_format? }
   */
  async generateFromImageEdits(imageBase64Array, prompt, options = {}) {
    const images = Array.isArray(imageBase64Array) ? imageBase64Array : [imageBase64Array];
    const mimeType = options.mimeType || 'image/jpeg';
    const first = images[0];
    const imageDataUrl = `data:${mimeType};base64,${first}`;
    return this.generateImage({
      prompt,
      model: options.model || this.defaultModel,
      size: options.size || '1024x1024',
      response_format: options.response_format || 'b64_json',
      imageDataUrl
    });
  }

  /**
   * 图生图（variations），兼容 OpenAI Images Variations
   * 有些豆包模型不支持 edits，此时可使用 variations 作为替代
   * @param {string|Buffer} imageBase64OrBuffer - 只取第一张图做变体
   * @param {object} options - { mimeType?, size?, n?, model? }
   */
  async generateFromImageVariations(imageBase64OrBuffer, options = {}) {
    const mimeType = options.mimeType || 'image/jpeg';
    const form = new FormData();
    const buf = Buffer.isBuffer(imageBase64OrBuffer)
      ? imageBase64OrBuffer
      : Buffer.from(imageBase64OrBuffer, 'base64');
    form.append('image', buf, { filename: `image.${mimeType.split('/')[1] || 'jpg'}`, contentType: mimeType });
    form.append('model', options.model || this.defaultModel);
    form.append('size', options.size || '1024x1024');
    form.append('n', String(options.n || 1));
    form.append('response_format', options.response_format || 'b64_json');

    try {
      const response = await axios.post(
        `${this.baseURL}/api/v3/images/variations`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeoutMs,
          maxBodyLength: Infinity
        }
      );
      return response.data;
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = `[doubao/variations] HTTP ${status || 'ERR'} model=${options.model || this.defaultModel} size=${options.size || '1024x1024'} ${data ? JSON.stringify(data) : err.message}`;
      const e = new Error(msg);
      e.status = status;
      e.data = data;
      throw e;
    }
  }
}

module.exports = DoubaoClient;


