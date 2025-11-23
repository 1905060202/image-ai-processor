const express = require('express');
const { User, UsageRecord, RechargeRecord, Image, sequelize } = require('../lib/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const creditManager = require('../lib/creditManager');
const { Op, Sequelize } = require('sequelize');

const router = express.Router();

// 所有路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    获取用户列表（管理员）
 */
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        let whereCondition = {};
        if (search) {
            whereCondition = {
                [Op.or]: [
                    { username: { [Op.iLike]: `%${search}%` } }
                ]
            };
        }

        const { count, rows } = await User.findAndCountAll({
            where: whereCondition,
            attributes: ['id', 'username', 'role', 'credits', 'freeTextToImageCount', 'createdAt'],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.json({
            users: rows,
            total: count,
            page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

/**
 * @route   GET /api/admin/users/:id
 * @desc    获取用户详情（管理员）
 */
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: ['id', 'username', 'role', 'credits', 'freeTextToImageCount', 'createdAt'],
            include: [
                {
                    model: Image,
                    as: 'Images',
                    attributes: ['id', 'filename', 'createdAt'],
                    limit: 10,
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 获取使用统计
        const usageStats = await UsageRecord.findAll({
            where: { userId: user.id },
            attributes: [
                'type',
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
                [Sequelize.fn('SUM', Sequelize.col('cost')), 'totalCost']
            ],
            group: ['type'],
            raw: true
        });

        res.json({
            user,
            usageStats
        });
    } catch (error) {
        console.error('获取用户详情失败:', error);
        res.status(500).json({ error: '获取用户详情失败' });
    }
});

/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    修改用户角色（管理员）
 */
router.patch('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: '无效的角色' });
        }

        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        user.role = role;
        await user.save();

        res.json({ 
            success: true, 
            message: '角色修改成功',
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('修改用户角色失败:', error);
        res.status(500).json({ error: '修改用户角色失败' });
    }
});

/**
 * @route   POST /api/admin/users/:id/recharge
 * @desc    为用户充值积分（管理员）
 */
router.post('/users/:id/recharge', async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const userId = parseInt(req.params.id);
        const operatorId = req.user.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: '充值数量必须大于0' });
        }

        const result = await creditManager.rechargeCredits(
            userId,
            amount,
            operatorId,
            reason || '管理员充值'
        );

        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        res.json({
            success: true,
            message: result.message,
            credits: result.credits
        });
    } catch (error) {
        console.error('充值失败:', error);
        res.status(500).json({ error: '充值失败' });
    }
});

/**
 * @route   GET /api/admin/recharges
 * @desc    获取充值记录列表（管理员）
 */
router.get('/recharges', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const { count, rows } = await RechargeRecord.findAndCountAll({
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'Operator',
                    attributes: ['id', 'username'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.json({
            recharges: rows,
            total: count,
            page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('获取充值记录失败:', error);
        res.status(500).json({ error: '获取充值记录失败' });
    }
});

/**
 * @route   GET /api/admin/usage-stats
 * @desc    获取使用统计（管理员）
 */
router.get('/usage-stats', async (req, res) => {
    try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        let whereCondition = {};
        if (startDate || endDate) {
            whereCondition.createdAt = {};
            if (startDate) whereCondition.createdAt[Op.gte] = new Date(startDate);
            if (endDate) whereCondition.createdAt[Op.lte] = new Date(endDate);
        }

        // 总使用次数
        const totalUsage = await UsageRecord.count({ where: whereCondition });

        // 按类型统计
        const usageByType = await UsageRecord.findAll({
            where: whereCondition,
            attributes: [
                'type',
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
                [Sequelize.fn('SUM', Sequelize.col('cost')), 'totalCost']
            ],
            group: ['type'],
            raw: true
        });

        // 总消耗积分
        const totalCost = await UsageRecord.sum('cost', { where: whereCondition });

        // 免费使用次数
        const freeUsage = await UsageRecord.count({
            where: {
                ...whereCondition,
                isFree: true
            }
        });

        res.json({
            totalUsage,
            usageByType,
            totalCost: totalCost || 0,
            freeUsage
        });
    } catch (error) {
        console.error('获取使用统计失败:', error);
        res.status(500).json({ error: '获取使用统计失败' });
    }
});

module.exports = router;

