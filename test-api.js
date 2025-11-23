// 测试 NanoBanana API 连接
require('dotenv').config();
const NanoBananaClient = require('./lib/nanoBananaClient');

async function testAPI() {
  const client = new NanoBananaClient(process.env.NANO_BANANA_API_KEY || '', {
    concurrency: 1
  });

  console.log('测试 NanoBanana API 连接...');
  console.log('API Key:', process.env.NANO_BANANA_API_KEY ? '已设置' : '未设置');

  try {
  const result = await client.generate('add a dog', {
    size: '1024x1024',
    n: 1
  });

    console.log('API 测试成功!');
    console.log('返回结果长度:', JSON.stringify(result).length, '字符');
  } catch (error) {
    console.error('API 测试失败:', error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testAPI();
