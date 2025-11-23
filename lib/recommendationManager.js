const { Image, User, Like, Favorite, sequelize } = require('./database');
const { Op } = require('sequelize');

// 提取关键词的简单实现
// 在实际生产中，这里可以使用 NLP 库 (如 node-jieba) 或调用 AI API 来提取
const extractKeywords = (prompts) => {
    const stopWords = ['a', 'an', 'the', 'in', 'on', 'at', 'of', 'with', 'by', 'style', 'high', 'quality', 'detail', 'detailed', '4k', '8k'];
    const keywords = {};

    prompts.forEach(prompt => {
        if (!prompt) return;
        // 简单的分词：转小写，移除标点，按空格分割
        const words = prompt.toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
            .split(/\s+/);

        words.forEach(word => {
            if (word.length > 2 && !stopWords.includes(word)) {
                keywords[word] = (keywords[word] || 0) + 1;
            }
        });
    });

    // 返回出现频率最高的前 5 个关键词
    return Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);
};

// 获取用户偏好关键词
const getUserPreferences = async (userId) => {
    // 获取用户最近生成的 20 张图片
    const recentImages = await Image.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit: 20,
        attributes: ['prompt']
    });

    const prompts = recentImages.map(img => img.prompt);
    return extractKeywords(prompts);
};

// 获取推荐瀑布流
const getRecommendedFeed = async (userId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;

    // 1. 分析用户偏好
    const keywords = await getUserPreferences(userId);
    console.log(`User ${userId} preferences:`, keywords);

    // 2. 构建查询条件
    let recommendationWhere = {};
    if (keywords.length > 0) {
        // 简单的关键词匹配：prompt 中包含任一关键词
        recommendationWhere = {
            [Op.or]: keywords.map(kw => ({
                prompt: { [Op.iLike]: `%${kw}%` }
            }))
        };
    }

    // 3. 混合查询策略
    // 为了简化实现，我们这里使用一个加权随机排序或者简单的组合查询
    // 实际推荐系统会更复杂，这里我们采用：
    // 50% 推荐 (匹配关键词) + 30% 热门 (点赞多) + 20% 最新

    // 由于 SQL 难以直接实现这种精确比例的混合分页，我们采用一种简化的策略：
    // 优先查询匹配关键词的图片，如果没有或不足，则补充热门和最新图片。
    // 并且排除用户自己生成的图片（通常推荐是看别人的）

    const baseWhere = {
        userId: { [Op.ne]: userId } // 排除自己
    };

    // 3. 混合查询策略 (优化版：避免重复)

    // A. 获取推荐内容 (50%)
    const recommendedLimit = Math.ceil(limit * 0.5);
    const recommendedOffset = (page - 1) * recommendedLimit;

    const recommended = await Image.findAll({
        where: { ...baseWhere, ...recommendationWhere },
        limit: recommendedLimit,
        offset: recommendedOffset,
        order: [['createdAt', 'DESC']],
        include: [
            { model: User, attributes: ['username', 'id'] },
            { model: Like, attributes: ['id'] }
        ]
    });

    // 记录已获取的 ID，避免后续重复
    const existingIds = recommended.map(img => img.id);

    // B. 获取热门/随机内容 (30%) - 排除已推荐的
    // 改为按 ID 倒序 (伪随机但确定性)，以便支持分页
    const popularLimit = Math.ceil(limit * 0.3);
    const popularOffset = (page - 1) * popularLimit;

    let popularWhere = { ...baseWhere };
    if (existingIds.length > 0) {
        popularWhere.id = { [Op.notIn]: existingIds };
    }

    const popular = await Image.findAll({
        where: popularWhere,
        limit: popularLimit,
        offset: popularOffset,
        order: [['id', 'DESC']], // 暂时用 ID 倒序代替随机，确保分页不重复
        include: [
            { model: User, attributes: ['username', 'id'] },
            { model: Like, attributes: ['id'] }
        ]
    });

    existingIds.push(...popular.map(img => img.id));

    // C. 获取最新内容 (20% + 补足剩余) - 排除已有的
    const remainingLimit = limit - recommended.length - popular.length;
    // 注意：最新内容的 offset 很难精确计算，因为前面的数量可能不足。
    // 简单起见，我们这里不使用 offset，而是依赖 "排除已有的 ID" 策略。
    // 但这在翻页时有问题（因为 existingIds 只包含当前页的）。
    // 更好的策略是：对于"最新"，我们总是取 (page-1)*limit 之后的。
    // 但混合分页真的很复杂。

    // 简化方案：对于最新内容，我们简单地使用全局 offset，但排除掉当前页已选的。
    // 这并不完美，但在数据量不大时可以接受。
    const newestOffset = (page - 1) * Math.ceil(limit * 0.2);

    let newest = [];

    if (remainingLimit > 0) {
        let newestWhere = { ...baseWhere };
        if (existingIds.length > 0) {
            newestWhere.id = { [Op.notIn]: existingIds };
        }

        newest = await Image.findAll({
            where: newestWhere,
            limit: remainingLimit,
            offset: newestOffset,
            order: [['createdAt', 'DESC']],
            include: [
                { model: User, attributes: ['username', 'id'] },
                { model: Like, attributes: ['id'] }
            ]
        });
    }

    // 合并并去重
    const allImages = [...recommended, ...popular, ...newest];
    const uniqueImages = Array.from(new Set(allImages.map(a => a.id)))
        .map(id => allImages.find(a => a.id === id));

    // 获取当前用户对这些图片的点赞和收藏状态
    const imageIds = uniqueImages.map(img => img.id);
    const [userLikes, userFavorites] = await Promise.all([
        Like.findAll({ where: { userId, imageId: { [Op.in]: imageIds } } }),
        Favorite.findAll({ where: { userId, imageId: { [Op.in]: imageIds } } })
    ]);

    const likedImageIds = new Set(userLikes.map(l => l.imageId));
    const favoritedImageIds = new Set(userFavorites.map(f => f.imageId));

    // 格式化返回数据
    const feed = uniqueImages.map(img => ({
        id: img.id,
        url: `/generated/${img.filename}`,
        thumbnail: `/generated/${img.filename}`, // 实际应为缩略图
        prompt: img.prompt,
        author: img.User.username,
        authorId: img.User.id,
        likes: img.Likes.length,
        isLiked: likedImageIds.has(img.id),
        isFavorited: favoritedImageIds.has(img.id),
        // 瀑布流布局优化：
        // 1. 尝试从 filename 解析尺寸 (例如: 1732345678_1024x1024.png)
        // 2. 如果无法解析，则随机生成一个合理的宽高比
        width: 300,
        height: (() => {
            const match = img.filename.match(/(\d+)x(\d+)/);
            if (match) {
                const [_, w, h] = match;
                return Math.floor(300 * (parseInt(h) / parseInt(w)));
            }
            return 300 + Math.floor(Math.random() * 200); // 默认随机高度
        })()
    }));

    // 简单的洗牌算法，让推荐、热门、最新穿插在一起
    for (let i = feed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [feed[i], feed[j]] = [feed[j], feed[i]];
    }

    return feed;
};

module.exports = {
    getRecommendedFeed
};
