const axios = require('axios');
const { default: pLimit } = require('p-limit');

class NanoBananaClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'https://api.laozhang.ai';
    this.concurrency = options.concurrency || 10;
    this.limiter = pLimit(this.concurrency);
    this.cache = new Map();
  }

  async generateBatch(prompts, options = {}) {
    const tasks = prompts.map(prompt => 
      this.limiter(() => this.generateWithCache(prompt, options))
    );
    
    return Promise.all(tasks);
  }

  async generateWithCache(prompt, options) {
    // 智能缓存，相似prompt复用
    const cacheKey = this.getCacheKey(prompt, options);
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 3600000) { // 1小时缓存
        return { ...cached.data, cached: true };
      }
    }

    const result = await this.generate(prompt, options);
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  async generate(prompt, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.post(
          `${this.baseURL}/v1/chat/completions`,
          {
            model: 'gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: prompt
                  }
                ]
              }
            ],
            stream: false
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        
        return response.data;
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || Math.pow(2, i);
          await this.sleep(retryAfter * 1000);
        } else if (i === retries - 1) {
          throw error;
        }
        
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
  }

  // NanoBananaClient 类中的方法

  /**
   * ✨ 重构: 图生图方法，支持单图(string)和多图(array)
   * @param {string|string[]} imageBase64Array - Base64编码后的图片数据或数据数组
   * @param {string} prompt - 用户的提示词
   * @param {object} options - 额外选项
   * @param {number} retries - 重试次数
   */
  async generateFromImage(imageBase64Array, prompt, options = {}, retries = 3) {
    const mimeType = options.mimeType || 'image/jpeg';
    
    // 确保 images 是一个数组，以实现兼容
    const images = Array.isArray(imageBase64Array) ? imageBase64Array : [imageBase64Array];
    
    // 构建请求体中的 content 部分
    const content = [
      { type: 'text', text: prompt } // 文本 prompt 总是第一个
    ];

    // 循环添加所有图片
    images.forEach(base64 => {
      content.push({
        type: 'image_url',
        image_url: {
          "url": `data:${mimeType};base64,${base64}`
        }
      });
    });

    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.post(
          `${this.baseURL}/v1/chat/completions`,
          {
            model: 'gemini-2.5-flash-image-preview',
            messages: [{ role: 'user', content: content }], // 使用动态构建的 content
            max_tokens: 1000,
          },
          {
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000 
          }
        );
        return response.data;
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || Math.pow(2, i);
          await this.sleep(retryAfter * 1000);
        } else if (i === retries - 1) {
          console.warn('图生图失败，将fallback到纯文生图:', error.message);
          return await this.generate(prompt, options, retries);
        } else {
            await this.sleep(Math.pow(2, i) * 1000);
        }
      }
    }
  }

  // 新增：使用参数生成图片
  async generateWithParams(params, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.post(
          `${this.baseURL}/v1/chat/completions`,
          {
            model: params.model || 'gemini-2.5-flash-image-preview',
            prompt: params.prompt,
            n: params.n || 1,
            size: params.size || '1024x1024'
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        
        return response.data;
      } catch (error) {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || Math.pow(2, i);
          await this.sleep(retryAfter * 1000);
        } else if (i === retries - 1) {
          throw error;
        }
        
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
  }

  getCacheKey(prompt, options) {
    return `${prompt}_${JSON.stringify(options)}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NanoBananaClient;
