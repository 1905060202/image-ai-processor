const express = require('express');
const multer = require('multer');
const fs = require('node:fs').promises;
const path = require('path');
const sharp = require('sharp');
const axios = require('axios');
const NanoBananaClient = require('../lib/nanoBananaClient');
const DoubaoClient = require('../lib/doubaoClient');
const imageManager = require('../lib/imageManager'); // 替换 metadataManager
const { authenticateToken } = require('../middleware/auth');
const creditManager = require('../lib/creditManager');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

const nanoBananaClient = new NanoBananaClient(process.env.NANO_BANANA_API_KEY || '', { concurrency: 5 });
const doubaoClient = process.env.DOUBAO_API_KEY ? new DoubaoClient(process.env.DOUBAO_API_KEY, { model: process.env.DOUBAO_IMAGE_MODEL, concurrency: 5 }) : null;

const tempUploadPath = path.join(__dirname, '../public/uploads/temp');
const permanentUploadPath = path.join(__dirname, '../public/uploads/permanent');
const generatedPath = path.join(__dirname, '../generated');

// 将上游（豆包等）错误转换为用户友好的提示
function mapUpstreamErrorToFriendly(err) {
  const defaultResult = { status: 500, error: '服务器内部错误', message: err?.message || '未知错误' };
  const status = err?.status || err?.response?.status;
  const code = err?.data?.error?.code || err?.response?.data?.error?.code;
  const requestId = err?.data?.error?.request_id || err?.data?.request_id || err?.data?.Error?.RequestId;
  // 豆包敏感内容拦截
  if (code === 'OutputImageSensitiveContentDetected') {
    return {
      status: 422,
      error: '内容安全拦截',
      message: `生成失败：命中内容安全策略。请尝试修改描述词（避免敏感词）、更换尺寸或降低细节强度。${requestId ? `请求ID：${requestId}` : ''}`.trim()
    };
  }
  // 认证/模型配置问题
  if (status === 401) {
    return { status: 401, error: '鉴权失败', message: '请检查 DOUBAO_API_KEY 是否有效。' };
  }
  if (status === 400 && (!process.env.DOUBAO_IMAGE_MODEL)) {
    return { status: 400, error: '参数错误', message: '缺少 DOUBAO_IMAGE_MODEL，需在环境变量中设置豆包模型ID（如 ep-xxxxxxxx）。' };
  }
  // 其他 4xx，回传上游 message
  if (status && status >= 400 && status < 500) {
    const upstreamMsg = err?.data?.error?.message || err?.message || '请求无效';
    return { status, error: '请求无效', message: upstreamMsg };
  }
  // 5xx 或未知
  return defaultResult;
}

// Multer 配置 (上传到临时目录)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(tempUploadPath, { recursive: true });
    cb(null, tempUploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});
// ✨ 修改: 从 single('image') 改为 array('images', 10)
const upload = multer({ storage });
router.post('/upload', upload.array('images', 10), async (req, res) => {
  const { prompt, keepOriginal, reusableImageFilename, provider: providerRaw, size: sizeRaw } = req.body;

  // 检查图生图使用权限
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const permission = await creditManager.checkImageToImagePermission(userId, isAdmin);

  if (!permission.allowed) {
    // 清理已上传的临时文件
    const uploadedFiles = req.files || [];
    uploadedFiles.forEach(file => {
      fs.unlink(file.path).catch(err => console.error(`清理临时文件失败:`, err));
    });
    return res.status(403).json({
      error: permission.reason,
      credits: permission.credits,
      required: permission.required
    });
  }

  const uploadedFiles = req.files || [];

  // 清理函数，用于在出错时删除已上传的临时文件
  const cleanupTempFiles = () => {
    if (uploadedFiles.length > 0) {
      uploadedFiles.forEach(file => fs.unlink(file.path).catch(err => console.error(`清理临时文件 ${file.path} 失败:`, err)));
    }
  };

  if (!prompt) {
    cleanupTempFiles();
    return res.status(400).json({ error: '缺少 prompt 描述' });
  }

  // ✨ 修改: 检查 req.files 数组长度
  if (uploadedFiles.length === 0 && !reusableImageFilename) {
    return res.status(400).json({ error: '必须提供新图片或选择一张可复用图片' });
  }

  try {
    const imagesBase64 = [];
    const sourceImagesInfo = []; // 用于记录原始图片信息
    let firstOriginalImageForDB = null;

    // ✨ 修改: 逻辑分支处理新上传或复用
    if (uploadedFiles.length > 0) {
      // 场景1: 处理新上传的多张图片
      for (const file of uploadedFiles) {
        const processedBuffer = await sharp(file.path)
          .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        imagesBase64.push(processedBuffer.toString('base64'));

        let originalFilename = null;
        if (keepOriginal === 'true') {
          originalFilename = `orig-${Date.now()}-${file.originalname}`;
          await fs.mkdir(permanentUploadPath, { recursive: true });
          await fs.rename(file.path, path.join(permanentUploadPath, originalFilename));
        }
        sourceImagesInfo.push({ path: file.path, savedAs: originalFilename });
      }
      firstOriginalImageForDB = sourceImagesInfo[0].savedAs || `temp-${path.basename(sourceImagesInfo[0].path)}`;

      // 删除不再需要的临时文件
      if (keepOriginal !== 'true') {
        cleanupTempFiles();
      }

    } else if (reusableImageFilename) {
      // 场景2: 处理复用的单张图片 (此逻辑保持不变)
      const sourceImagePath = path.join(permanentUploadPath, reusableImageFilename);
      await fs.access(sourceImagePath);
      const processedBuffer = await sharp(sourceImagePath)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      imagesBase64.push(processedBuffer.toString('base64'));
      firstOriginalImageForDB = reusableImageFilename;
    }

    // 调用 AI 服务 (现在可以传递 base64 数组)
    // 支持 doubao, doubao-4.0, doubao-4.5
    const provider = (providerRaw || process.env.IMAGE_PROVIDER || '').toLowerCase();
    const size = sizeRaw || process.env.DOUBAO_IMAGE_SIZE || '1024x1024';
    let result;

    if (provider.startsWith('doubao')) {
      if (!doubaoClient) {
        throw new Error('未配置 DOUBAO_API_KEY');
      }

      let modelId = process.env.DOUBAO_IMAGE_MODEL; // Default to 4.0/Standard
      if (provider === 'doubao-4.5') {
        modelId = process.env.DOUBAO_IMAGE_MODEL_4_5;
        if (!modelId) {
          return res.status(400).json({ error: '未配置 Doubao 4.5 模型', hint: '请在环境变量中设置 DOUBAO_IMAGE_MODEL_4_5' });
        }
      } else {
        // doubao or doubao-4.0
        if (!modelId) {
          return res.status(400).json({ error: '缺少 DOUBAO_IMAGE_MODEL', hint: '请在环境变量中设置豆包模型ID' });
        }
      }

      // 使用 generations JSON 接口进行图生图（取第一张）
      // explicitly pass the chosen model ID
      result = await doubaoClient.generateFromImageEdits(imagesBase64, prompt, { mimeType: 'image/jpeg', size, model: modelId });
    } else {
      result = await nanoBananaClient.generateFromImage(imagesBase64, prompt, { mimeType: 'image/jpeg' });
    }
    const { finalBuffer, imageFormat } = await parseAIResponse(result);

    const generatedFileName = `gen-${Date.now()}.${imageFormat}`;
    await fs.mkdir(generatedPath, { recursive: true });
    await fs.writeFile(path.join(generatedPath, generatedFileName), finalBuffer);

    // 将记录添加到数据库 (originalImage 字段记录第一张图或复用图)
    const imageRecord = await imageManager.addEntry({
      filename: generatedFileName,
      prompt: prompt,
      originalImage: firstOriginalImageForDB,
      userId: req.user.id
    });

    // 扣除积分并记录使用（在生成成功后扣除）
    const deductResult = await creditManager.deductCredits(
      userId,
      'image-to-image',
      imageRecord.id
    );

    // 注意：这里不应该失败，因为我们已经检查过权限
    // 但如果真的失败了，记录错误但不删除图片
    if (!deductResult.success) {
      console.error('积分扣除失败，但图片已生成:', deductResult.message);
    }

    res.json({
      success: true,
      message: '图片生成成功!',
      generatedUrl: `/generated/${generatedFileName}`,
      credits: deductResult.credits,
      cost: deductResult.cost
    });

  } catch (error) {
    console.error('图生图流程出错:', error.message);
    cleanupTempFiles(); // 确保在任何错误情况下都尝试清理
    const mapped = mapUpstreamErrorToFriendly(error);
    res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
  }
});



/**
 * @route   POST /api/v1/generate-text
 * @desc    文生图
 */
router.post('/generate-text', async (req, res) => {
  const { prompt, provider: providerRaw, size: sizeRaw } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: '缺少 prompt 描述' });
  }

  // 检查使用权限
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const permission = await creditManager.checkTextToImagePermission(userId, isAdmin);

  if (!permission.allowed) {
    return res.status(403).json({
      error: permission.reason,
      credits: permission.credits,
      required: permission.required,
      freeCount: permission.freeCount
    });
  }

  try {
    let result;
    const provider = (providerRaw || process.env.IMAGE_PROVIDER || '').toLowerCase();
    const size = sizeRaw || process.env.DOUBAO_IMAGE_SIZE || '1024x1024';

    if (provider.startsWith('doubao')) {
      if (!doubaoClient) {
        return res.status(500).json({ error: '未配置 DOUBAO_API_KEY' });
      }

      let modelId = process.env.DOUBAO_IMAGE_MODEL; // Default to 4.0/Standard
      if (provider === 'doubao-4.5') {
        modelId = process.env.DOUBAO_IMAGE_MODEL_4_5;
        if (!modelId) {
          return res.status(400).json({ error: '未配置 Doubao 4.5 模型', hint: '请在环境变量中设置 DOUBAO_IMAGE_MODEL_4_5' });
        }
      } else {
        // doubao or doubao-4.0
        if (!modelId) {
          return res.status(400).json({ error: '缺少 DOUBAO_IMAGE_MODEL', hint: '请在环境变量中设置豆包模型ID' });
        }
      }

      result = await doubaoClient.generate(prompt, { size, model: modelId });
    } else {
      result = await nanoBananaClient.generate(prompt);
    }
    const { finalBuffer, imageFormat } = await parseAIResponse(result);

    const generatedFileName = `gen-text-${Date.now()}.${imageFormat}`;
    await fs.mkdir(generatedPath, { recursive: true });
    await fs.writeFile(path.join(generatedPath, generatedFileName), finalBuffer);

    // 添加到元数据
    const imageRecord = await imageManager.addEntry({
      filename: generatedFileName,
      prompt,
      userId: req.user.id
    });

    // 扣除积分并记录使用（在生成成功后扣除）
    const deductResult = await creditManager.deductCredits(
      userId,
      'text-to-image',
      imageRecord.id
    );

    // 注意：这里不应该失败，因为我们已经检查过权限
    // 但如果真的失败了，记录错误但不删除图片（因为已经生成了）
    if (!deductResult.success) {
      console.error('积分扣除失败，但图片已生成:', deductResult.message);
    }

    res.json({
      success: true,
      message: '图片生成成功!',
      generatedUrl: `/generated/${generatedFileName}`,
      credits: deductResult.credits || 0,
      cost: deductResult.cost || 0,
      isFree: deductResult.isFree || false
    });
  } catch (error) {
    console.error('文生图失败:', error.message);
    const mapped = mapUpstreamErrorToFriendly(error);
    res.status(mapped.status).json({ error: mapped.error, message: mapped.message });
  }
});


/**
 * @route   GET /api/v1/images
 * @desc    获取已生成图片列表 (从元数据读取，支持分页和搜索)
 */
router.get('/images', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const query = req.query.q || '';
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const result = await imageManager.getPaginatedImages({
      page,
      query,
      userId,
      isAdmin
    });

    // 构造前端需要的 URL
    const imagesWithUrls = result.images.map(img => ({
      ...img.toJSON(),
      url: `/generated/${img.filename}`
    }));

    res.json({
      images: imagesWithUrls,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    });

  } catch (err) {
    console.error('获取图片列表失败:', err);
    res.status(500).json({ error: '无法获取图片列表' });
  }
});

/**
 * @route   DELETE /api/v1/images/:filename
 * @desc    删除一张生成的图片
 */
router.delete('/images/:filename', async (req, res) => {
  const { filename } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  try {
    // 先检查权限，只有管理员或图片所有者才能删除
    const deleted = await imageManager.deleteEntry(filename, userId, isAdmin);
    if (!deleted) {
      return res.status(403).json({ error: '无权删除此图片' });
    }
    await fs.unlink(path.join(generatedPath, filename));
    res.json({ success: true, message: '图片已删除' });
  } catch (error) {
    console.error(`删除文件 ${filename} 失败:`, error);
    if (error.code === 'ENOENT') {
      // 文件不存在，但数据库记录已删除，也算成功
      return res.json({ success: true, message: '图片已删除' });
    }
    res.status(500).json({ error: '删除失败' });
  }
});

/**
 * @route   PATCH /api/v1/images/:filename
 * @desc    重命名一张生成的图片 (已加固，防止文件名冲突)
 */
router.patch('/images/:filename', async (req, res) => {
  const { filename: oldFilename } = req.params;
  let { newFilename } = req.body;

  if (!newFilename) {
    return res.status(400).json({ error: '缺少新文件名' });
  }

  const ext = path.extname(oldFilename);
  const finalNewFilename = newFilename.endsWith(ext) ? newFilename : `${newFilename}${ext}`;

  // 如果新旧文件名相同，则无需操作
  if (oldFilename === finalNewFilename) {
    return res.json({ success: true, message: '文件名未改变', newFilename: finalNewFilename });
  }

  const oldPath = path.join(generatedPath, oldFilename);
  const newPath = path.join(generatedPath, finalNewFilename);

  try {
    // --- 关键修复：预检查 START ---
    // 1. 检查新文件名是否已存在于文件系统
    try {
      await fs.access(newPath);
      // 如果 fs.access 没有报错，说明文件已存在
      return res.status(409).json({ error: '文件名已存在，请换一个' }); // 409 Conflict
    } catch (accessError) {
      // 文件不存在，这是我们期望的，继续执行
    }
    // --- 关键修复：预检查 END ---

    // 2. 先更新数据库记录
    // 这一步也充当了检查旧记录是否存在的角色
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const updatedInDb = await imageManager.updateEntry(oldFilename, finalNewFilename, null, userId, isAdmin);
    if (!updatedInDb) {
      // 如果数据库更新失败（例如，原始记录不存在或无权操作）
      return res.status(404).json({ error: '原始记录未找到或无权操作' }); // 404 Not Found
    }

    // 3. 数据库更新成功后，再进行文件重命名
    await fs.rename(oldPath, newPath);

    // 4. 全部成功
    const newUrl = `/generated/${finalNewFilename}`;
    res.json({ success: true, message: '重命名成功', newFilename: finalNewFilename, url: newUrl });

  } catch (error) {
    console.error(`重命名文件 ${oldFilename} 失败:`, error);
    if (error.status === 409) {
      return res.status(409).json({ error: '文件名已存在，请换一个' });
    }
    res.status(500).json({ error: '重命名操作失败，数据已尝试回滚' });
  }
});

/**
 * @route   GET /api/v1/uploads
 * @desc    获取可复用的原始图片列表 (支持分页和搜索)
 */
router.get('/uploads', async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    await fs.mkdir(permanentUploadPath, { recursive: true });
    const files = await fs.readdir(permanentUploadPath);

    // 获取所有图片，但需要根据用户权限过滤
    // 注意：uploads 目录目前没有用户关联，所以所有用户都能看到所有上传的图片
    // 如果需要更细粒度的控制，需要为 uploads 也添加数据库记录和 userId
    let imageFiles = files
      .filter((file) => /\.(jpg|jpeg|png|gif)$/i.test(file))
      .map((file) => ({ filename: file, url: `/uploads/permanent/${file}` }))
      .reverse(); // 默认按上传时间倒序

    // 搜索功能
    const searchQuery = req.query.q || '';
    if (searchQuery) {
      imageFiles = imageFiles.filter(image =>
        image.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 分页功能
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10; // 可复用图片列表可以显示得更紧凑，每页10个
    const startIndex = (page - 1) * limit;

    const paginatedImages = imageFiles.slice(startIndex, startIndex + limit);

    return res.json({
      images: paginatedImages,
      currentPage: page,
      totalPages: Math.ceil(imageFiles.length / limit)
    });

  } catch (err) {
    if (err.code === 'ENOENT') {
      // 目录不存在时返回空
      return res.json({ images: [], currentPage: 1, totalPages: 1 });
    }
    console.error('读取可复用图片目录失败:', err);
    return res.status(500).json({ error: '无法获取列表' });
  }
});

/**
 * @route   DELETE /api/v1/uploads/:filename
 * @desc    删除一张可复用的原始图片
 */
router.delete('/uploads/:filename', async (req, res) => {
  const { filename } = req.params;
  // 安全性检查：确保文件名不包含路径遍历字符
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: '无效的文件名' });
  }
  try {
    const filePath = path.join(permanentUploadPath, filename);
    await fs.unlink(filePath);
    res.json({ success: true, message: '图片已删除' });
  } catch (error) {
    console.error(`删除可复用图片 ${filename} 失败:`, error);
    // 如果文件不存在，也认为是成功的删除操作
    if (error.code === 'ENOENT') {
      return res.json({ success: true, message: '图片不存在，操作完成' });
    }
    res.status(500).json({ error: '删除失败' });
  }
});

router.patch('/uploads/:filename', async (req, res) => {
  const { filename: oldFilename } = req.params;
  const { newFilename } = req.body;

  if (!newFilename || oldFilename.includes('..') || newFilename.includes('..')) {
    return res.status(400).json({ error: '无效的文件名' });
  }

  const ext = path.extname(oldFilename);
  const finalNewFilename = newFilename.endsWith(ext) ? newFilename : `${newFilename}${ext}`;

  if (oldFilename === finalNewFilename) {
    return res.json({ success: true, message: '文件名未改变', newFilename: finalNewFilename });
  }

  const oldPath = path.join(permanentUploadPath, oldFilename);
  const newPath = path.join(permanentUploadPath, finalNewFilename);

  try {
    // 1. 预检查新文件名是否存在
    try {
      await fs.access(newPath);
      return res.status(409).json({ error: '文件名已存在，请换一个' });
    } catch (accessError) {
      // 期望文件不存在
    }

    // 2. 直接进行文件重命名 (因为 uploads 没有数据库记录，操作更简单)
    await fs.rename(oldPath, newPath);

    res.json({ success: true, message: '重命名成功', newFilename: finalNewFilename });
  } catch (error) {
    console.error(`重命名可复用图片 ${oldFilename} 失败:`, error);
    res.status(500).json({ error: '重命名失败' });
  }
});



// 辅助函数: 解析AI API的多种响应格式
async function parseAIResponse(result) {
  let finalBuffer;
  let imageFormat = 'png';

  // 豆包/Ark: OpenAI Images 兼容，b64_json
  if (result?.data?.[0]?.b64_json) {
    finalBuffer = Buffer.from(result.data[0].b64_json, 'base64');
    // Ark 默认 PNG
    return { finalBuffer, imageFormat };
  }

  if (result?.data?.[0]?.url) {
    const imageResponse = await axios.get(result.data[0].url, { responseType: 'arraybuffer' });
    finalBuffer = Buffer.from(imageResponse.data);
  } else if (result?.choices?.[0]?.message?.content) {
    const content = result.choices[0].message.content;
    const dataImageMatch = content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
    if (dataImageMatch) {
      imageFormat = dataImageMatch[1];
      finalBuffer = Buffer.from(dataImageMatch[2], 'base64');
    } else if (content.startsWith('http')) {
      const imageResponse = await axios.get(content, { responseType: 'arraybuffer' });
      finalBuffer = Buffer.from(imageResponse.data);
    }
  }

  if (!finalBuffer || finalBuffer.length < 100) {
    throw new Error(`AI返回了非图片内容: ${result?.choices?.[0]?.message?.content || '未知格式'}`);
  }
  return { finalBuffer, imageFormat };
}

module.exports = router;