const { Sequelize, DataTypes } = require('sequelize');

// 从环境变量中读取数据库连接 URL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false, // 开发环境打印 SQL
    dialectOptions: {
        // 如果部署在需要 SSL 的平台 (如 Heroku, Render)，则开启
        // ssl: {
        //   require: true,
        //   rejectUnauthorized: false
        // }
    }
});

// 定义 User 模型
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user'
    },
    credits: {
        type: DataTypes.INTEGER,
        defaultValue: 0,  // 用户积分，默认0
        allowNull: false
    },
    freeTextToImageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,  // 免费文生图使用次数
        allowNull: false
    }
});

// 定义 Image 模型 (对应数据库中的 'images' 表)
const Image = sequelize.define('Image', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    filename: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    prompt: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    originalImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true, // 允许为空以兼容旧数据
        references: {
            model: User,
            key: 'id'
        }
    }
    // createdAt 和 updatedAt 字段会自动被 Sequelize 创建和管理
});

// 定义使用记录模型（记录用户的使用情况）
const UsageRecord = sequelize.define('UsageRecord', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM('text-to-image', 'image-to-image'),
        allowNull: false
    },
    cost: {
        type: DataTypes.INTEGER,
        defaultValue: 0,  // 消耗的积分
        allowNull: false
    },
    isFree: {
        type: DataTypes.BOOLEAN,
        defaultValue: false  // 是否免费使用
    },
    imageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Images',
            key: 'id'
        }
    }
});

// 定义充值记录模型
const RechargeRecord = sequelize.define('RechargeRecord', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.INTEGER,
        allowNull: false  // 充值积分数量
    },
    operatorId: {
        type: DataTypes.INTEGER,
        allowNull: true,  // 操作员ID（管理员充值时记录）
        references: {
            model: User,
            key: 'id'
        }
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: true  // 充值原因/备注
    }
});

// 建立关联
User.hasMany(Image, { foreignKey: 'userId' });
Image.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(UsageRecord, { foreignKey: 'userId' });
UsageRecord.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(RechargeRecord, { foreignKey: 'userId', as: 'UserRecharges' });
RechargeRecord.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(RechargeRecord, { foreignKey: 'operatorId', as: 'OperatorRecharges' });
RechargeRecord.belongsTo(User, { foreignKey: 'operatorId', as: 'Operator' });

// 定义点赞模型
const Like = sequelize.define('Like', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: User, key: 'id' }
    },
    imageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Image, key: 'id' }
    }
});

// 定义收藏模型
const Favorite = sequelize.define('Favorite', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: User, key: 'id' }
    },
    imageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: Image, key: 'id' }
    }
});

// 建立点赞和收藏的关联
User.hasMany(Like, { foreignKey: 'userId' });
Like.belongsTo(User, { foreignKey: 'userId' });

Image.hasMany(Like, { foreignKey: 'imageId' });
Like.belongsTo(Image, { foreignKey: 'imageId' });

User.hasMany(Favorite, { foreignKey: 'userId' });
Favorite.belongsTo(User, { foreignKey: 'userId' });

Image.hasMany(Favorite, { foreignKey: 'imageId' });
Favorite.belongsTo(Image, { foreignKey: 'imageId' });

// 初始化数据库连接并同步模型
const initializeDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL Connection has been established successfully.');
        // `force: false` 表示如果表已存在，则不删除重建。
        // 在开发初期，可以设为 `true` 来快速重建表结构。
        await sequelize.sync({ alter: true });
        console.log('✅ All models were synchronized successfully.');
    } catch (error) {
        console.error('❌ Unable to connect to the database or sync models:', error);
        process.exit(1);
    }
};

module.exports = {
    sequelize,
    Image,
    User,
    UsageRecord,
    RechargeRecord,
    Like,
    Favorite,
    initializeDatabase
};