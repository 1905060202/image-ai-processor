const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Image, User, Like, Favorite } = require('../lib/database');

// 获取我点赞的图片
router.get('/likes', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        const { count, rows: likes } = await Like.findAndCountAll({
            where: { userId },
            include: [{
                model: Image,
                include: [
                    { model: User, attributes: ['username', 'id'] }, // 图片作者
                    { model: Like, attributes: ['id'] } // 用于计算总点赞数
                ]
            }],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        // 格式化数据
        const images = likes.map(like => {
            const img = like.Image;
            if (!img) return null; // 处理图片已被删除的情况

            // 重新计算图片尺寸 (复用之前的逻辑)
            const width = 300;
            const height = (() => {
                const match = img.filename.match(/(\d+)x(\d+)/);
                if (match) {
                    const [_, w, h] = match;
                    return Math.floor(300 * (parseInt(h) / parseInt(w)));
                }
                return 300 + Math.floor(Math.random() * 200);
            })();

            return {
                id: img.id,
                url: `/generated/${img.filename}`,
                thumbnail: `/generated/${img.filename}`,
                prompt: img.prompt,
                author: img.User.username,
                authorId: img.User.id,
                likes: img.Likes.length,
                isLiked: true, // 在"我点赞的"列表中，肯定已点赞
                // isFavorited: ??? (需要额外查询，或者前端不显示收藏状态，或者这里再查一次)
                // 为了性能，这里暂时不查 isFavorited，或者假设前端只在"收藏"页关心收藏状态
                // 但为了统一 UI，最好还是查一下。
                // 简单起见，这里先不查 isFavorited，前端默认 false 或不显示
                width,
                height
            };
        }).filter(img => img !== null);

        res.json({
            images,
            hasMore: offset + images.length < count,
            total: count
        });

    } catch (error) {
        console.error('获取点赞列表失败:', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 获取我收藏的图片
router.get('/favorites', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const offset = (page - 1) * limit;
        const userId = req.user.id;

        const { count, rows: favorites } = await Favorite.findAndCountAll({
            where: { userId },
            include: [{
                model: Image,
                include: [
                    { model: User, attributes: ['username', 'id'] },
                    { model: Like, attributes: ['id'] }
                ]
            }],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        // 格式化数据
        const images = favorites.map(fav => {
            const img = fav.Image;
            if (!img) return null;

            const width = 300;
            const height = (() => {
                const match = img.filename.match(/(\d+)x(\d+)/);
                if (match) {
                    const [_, w, h] = match;
                    return Math.floor(300 * (parseInt(h) / parseInt(w)));
                }
                return 300 + Math.floor(Math.random() * 200);
            })();

            return {
                id: img.id,
                url: `/generated/${img.filename}`,
                thumbnail: `/generated/${img.filename}`,
                prompt: img.prompt,
                author: img.User.username,
                authorId: img.User.id,
                likes: img.Likes.length,
                // isLiked: ??? (同上)
                isFavorited: true, // 肯定已收藏
                width,
                height
            };
        }).filter(img => img !== null);

        res.json({
            images,
            hasMore: offset + images.length < count,
            total: count
        });

    } catch (error) {
        console.error('获取收藏列表失败:', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

module.exports = router;
