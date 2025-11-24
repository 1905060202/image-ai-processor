const { Image } = require('./database');
const { Op } = require('sequelize'); // 引入 Sequelize 的操作符

const addEntry = async ({ filename, prompt, originalImage = null, userId = null }) => {
    return await Image.create({ filename, prompt, originalImage, userId });
};

const updateEntry = async (oldFilename, newFilename, newPrompt, userId, isAdmin) => {
    // 同名检测：如果新文件名已存在且不是同一记录，则冲突
    const existing = await Image.findOne({ where: { filename: newFilename } });
    if (existing && existing.filename !== oldFilename) {
        const err = new Error('Filename already exists');
        err.status = 409;
        throw err;
    }

    const whereClause = { filename: oldFilename };
    if (!isAdmin && userId) {
        whereClause.userId = userId;
    }

    const image = await Image.findOne({ where: whereClause });
    if (image) {
        image.filename = newFilename;
        if (newPrompt) {
            image.prompt = newPrompt;
        }
        await image.save();
        return true;
    }
    return false;
};

const deleteEntry = async (filename, userId, isAdmin) => {
    const whereClause = { filename };
    if (!isAdmin && userId) {
        whereClause.userId = userId;
    }
    const result = await Image.destroy({ where: whereClause });
    return result > 0; // 如果删除了至少一行，返回 true
};

const getPaginatedImages = async ({ page = 1, limit = 12, query = '', userId = null, isAdmin = false }) => {
    const offset = (page - 1) * limit;
    let whereCondition = {};

    if (query) {
        // 使用 iLike 进行不区分大小写的模糊搜索
        whereCondition = {
            [Op.or]: [
                { filename: { [Op.iLike]: `%${query}%` } },
                { prompt: { [Op.iLike]: `%${query}%` } }
            ]
        };
    }

    // 权限控制：非管理员只能看到自己的图片
    if (!isAdmin && userId) {
        whereCondition.userId = userId;
    }

    const { count, rows } = await Image.findAndCountAll({
        where: whereCondition,
        limit,
        offset,
        order: [['createdAt', 'DESC']] // 按创建时间降序排序
    });

    return {
        images: rows,
        totalImages: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page
    };
};

module.exports = {
    addEntry,
    updateEntry,
    deleteEntry,
    getPaginatedImages
};