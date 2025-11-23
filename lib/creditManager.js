const { User, UsageRecord, RechargeRecord } = require('./database');

// 配置常量
const FREE_TEXT_TO_IMAGE_LIMIT = 5; // 免费文生图次数
const TEXT_TO_IMAGE_COST = 10; // 文生图消耗积分
const IMAGE_TO_IMAGE_COST = 5; // 图生图消耗积分

/**
 * 检查用户是否可以使用文生图功能
 * @param {number} userId - 用户ID
 * @param {boolean} isAdmin - 是否是管理员
 * @returns {Object} { allowed: boolean, reason?: string, freeCount?: number }
 */
const checkTextToImagePermission = async (userId, isAdmin) => {
    // 管理员不受限制
    if (isAdmin) {
        return { allowed: true, reason: '管理员权限' };
    }

    const user = await User.findByPk(userId);
    if (!user) {
        return { allowed: false, reason: '用户不存在' };
    }

    // 检查免费次数
    if (user.freeTextToImageCount < FREE_TEXT_TO_IMAGE_LIMIT) {
        return { 
            allowed: true, 
            reason: '免费使用',
            freeCount: user.freeTextToImageCount,
            remainingFree: FREE_TEXT_TO_IMAGE_LIMIT - user.freeTextToImageCount
        };
    }

    // 免费次数用完了，检查积分
    if (user.credits >= TEXT_TO_IMAGE_COST) {
        return { 
            allowed: true, 
            reason: '使用积分',
            credits: user.credits,
            cost: TEXT_TO_IMAGE_COST
        };
    }

    // 积分不足
    return { 
        allowed: false, 
        reason: '积分不足',
        credits: user.credits,
        required: TEXT_TO_IMAGE_COST,
        freeCount: user.freeTextToImageCount
    };
};

/**
 * 检查用户是否可以使用图生图功能
 * @param {number} userId - 用户ID
 * @param {boolean} isAdmin - 是否是管理员
 * @returns {Object} { allowed: boolean, reason?: string }
 */
const checkImageToImagePermission = async (userId, isAdmin) => {
    // 管理员不受限制
    if (isAdmin) {
        return { allowed: true, reason: '管理员权限' };
    }

    const user = await User.findByPk(userId);
    if (!user) {
        return { allowed: false, reason: '用户不存在' };
    }

    // 图生图需要消耗积分
    if (user.credits >= IMAGE_TO_IMAGE_COST) {
        return { 
            allowed: true, 
            reason: '使用积分',
            credits: user.credits,
            cost: IMAGE_TO_IMAGE_COST
        };
    }

    return { 
        allowed: false, 
        reason: '积分不足',
        credits: user.credits,
        required: IMAGE_TO_IMAGE_COST
    };
};

/**
 * 扣除积分并记录使用
 * @param {number} userId - 用户ID
 * @param {string} type - 'text-to-image' 或 'image-to-image'
 * @param {number} imageId - 生成的图片ID（可选）
 * @returns {Object} { success: boolean, message?: string, credits?: number }
 */
const deductCredits = async (userId, type, imageId = null) => {
    const user = await User.findByPk(userId);
    if (!user) {
        return { success: false, message: '用户不存在' };
    }

    let cost = 0;
    let isFree = false;

    if (type === 'text-to-image') {
        // 检查是否可以使用免费次数
        if (user.freeTextToImageCount < FREE_TEXT_TO_IMAGE_LIMIT) {
            // 使用免费次数
            user.freeTextToImageCount += 1;
            isFree = true;
            cost = 0;
        } else {
            // 使用积分
            if (user.credits < TEXT_TO_IMAGE_COST) {
                return { success: false, message: '积分不足' };
            }
            user.credits -= TEXT_TO_IMAGE_COST;
            cost = TEXT_TO_IMAGE_COST;
        }
    } else if (type === 'image-to-image') {
        // 图生图需要消耗积分
        if (user.credits < IMAGE_TO_IMAGE_COST) {
            return { success: false, message: '积分不足' };
        }
        user.credits -= IMAGE_TO_IMAGE_COST;
        cost = IMAGE_TO_IMAGE_COST;
    }

    // 保存用户信息
    await user.save();

    // 记录使用
    await UsageRecord.create({
        userId,
        type,
        cost,
        isFree,
        imageId
    });

    return { 
        success: true, 
        credits: user.credits,
        cost,
        isFree
    };
};

/**
 * 充值积分
 * @param {number} userId - 用户ID
 * @param {number} amount - 充值数量
 * @param {number} operatorId - 操作员ID（管理员充值时）
 * @param {string} reason - 充值原因
 * @returns {Object} { success: boolean, message?: string, credits?: number }
 */
const rechargeCredits = async (userId, amount, operatorId = null, reason = null) => {
    if (amount <= 0) {
        return { success: false, message: '充值数量必须大于0' };
    }

    const user = await User.findByPk(userId);
    if (!user) {
        return { success: false, message: '用户不存在' };
    }

    // 增加积分
    user.credits += amount;
    await user.save();

    // 记录充值
    await RechargeRecord.create({
        userId,
        amount,
        operatorId,
        reason: reason || (operatorId ? '管理员充值' : '用户充值')
    });

    return { 
        success: true, 
        credits: user.credits,
        message: `成功充值 ${amount} 积分`
    };
};

/**
 * 获取用户积分信息
 * @param {number} userId - 用户ID
 * @returns {Object} 用户积分信息
 */
const getUserCredits = async (userId) => {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'credits', 'freeTextToImageCount', 'role']
    });
    
    if (!user) {
        return null;
    }

    return {
        userId: user.id,
        username: user.username,
        credits: user.credits,
        freeTextToImageCount: user.freeTextToImageCount,
        remainingFree: Math.max(0, FREE_TEXT_TO_IMAGE_LIMIT - user.freeTextToImageCount),
        role: user.role
    };
};

/**
 * 获取用户使用记录
 * @param {number} userId - 用户ID
 * @param {number} page - 页码
 * @param {number} limit - 每页数量
 * @returns {Object} 使用记录列表
 */
const getUserUsageRecords = async (userId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    
    const { count, rows } = await UsageRecord.findAndCountAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
        offset
    });

    return {
        records: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit)
    };
};

module.exports = {
    checkTextToImagePermission,
    checkImageToImagePermission,
    deductCredits,
    rechargeCredits,
    getUserCredits,
    getUserUsageRecords,
    FREE_TEXT_TO_IMAGE_LIMIT,
    TEXT_TO_IMAGE_COST,
    IMAGE_TO_IMAGE_COST
};

