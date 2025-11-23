const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const creditManager = require('../lib/creditManager');

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * @route   GET /api/credits/info
 * @desc    获取当前用户积分信息
 */
router.get('/info', async (req, res) => {
    try {
        const creditsInfo = await creditManager.getUserCredits(req.user.id);
        if (!creditsInfo) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json(creditsInfo);
    } catch (error) {
        console.error('获取积分信息失败:', error);
        res.status(500).json({ error: '获取积分信息失败' });
    }
});

/**
 * @route   GET /api/credits/usage
 * @desc    获取当前用户使用记录
 */
router.get('/usage', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        
        const records = await creditManager.getUserUsageRecords(req.user.id, page, limit);
        res.json(records);
    } catch (error) {
        console.error('获取使用记录失败:', error);
        res.status(500).json({ error: '获取使用记录失败' });
    }
});

module.exports = router;

