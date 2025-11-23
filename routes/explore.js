const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Like, Favorite, Image } = require('../lib/database');
const { getRecommendedFeed } = require('../lib/recommendationManager');

// 所有路由需要登录
router.use(authenticateToken);

// 获取发现页瀑布流数据
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const userId = req.user.id;

        const feed = await getRecommendedFeed(userId, page, limit);
        res.json({ feed });
    } catch (error) {
        console.error('Get explore feed error:', error);
        res.status(500).json({ error: '获取推荐内容失败' });
    }
});

// 点赞/取消点赞
router.post('/images/:id/like', async (req, res) => {
    try {
        const imageId = req.params.id;
        const userId = req.user.id;

        const existingLike = await Like.findOne({ where: { userId, imageId } });

        if (existingLike) {
            await existingLike.destroy();
            res.json({ liked: false });
        } else {
            await Like.create({ userId, imageId });
            res.json({ liked: true });
        }
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

// 收藏/取消收藏
router.post('/images/:id/favorite', async (req, res) => {
    try {
        const imageId = req.params.id;
        const userId = req.user.id;

        const existingFavorite = await Favorite.findOne({ where: { userId, imageId } });

        if (existingFavorite) {
            await existingFavorite.destroy();
            res.json({ favorited: false });
        } else {
            await Favorite.create({ userId, imageId });
            res.json({ favorited: true });
        }
    } catch (error) {
        console.error('Favorite error:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

module.exports = router;
