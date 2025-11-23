const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../lib/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    try {
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ error: '用户名已存在' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        // 只有第一个注册的用户或者明确指定且有某种内部机制(这里简化为允许)才能成为 admin
        // 为了安全，生产环境应该限制 role 的设置，这里为了演示方便，允许注册时指定 role (默认为 user)
        // 更好的做法是：只有 admin 才能创建 admin，或者通过数据库直接修改
        const userRole = role === 'admin' ? 'admin' : 'user';

        const user = await User.create({
            username,
            password: hashedPassword,
            role: userRole
        });

        res.status(201).json({ message: '注册成功', userId: user.id });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ message: '登录成功', token, username: user.username, role: user.role });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: '未登录' });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ error: '无效 Token' });
        
        // 获取用户积分信息
        const creditManager = require('../lib/creditManager');
        const creditsInfo = await creditManager.getUserCredits(user.id);
        
        res.json({
            ...user,
            credits: creditsInfo?.credits || 0,
            freeTextToImageCount: creditsInfo?.freeTextToImageCount || 0,
            remainingFree: creditsInfo?.remainingFree || 0
        });
    });
});

module.exports = router;
