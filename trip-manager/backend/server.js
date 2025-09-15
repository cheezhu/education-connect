const express = require('express');
const cors = require('cors');
const basicAuth = require('express-basic-auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化数据库
const db = new sqlite3.Database(path.join(__dirname, 'db/trip.db'));
db.run('PRAGMA foreign_keys = ON');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 基础认证
const authenticator = (username, password, cb) => {
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return cb(null, false);
    if (user && bcrypt.compareSync(password, user.password)) {
      return cb(null, true);
    }
    return cb(null, false);
  });
};

app.use(basicAuth({
  authorizer: authenticator,
  authorizeAsync: true,
  challenge: true,
  realm: 'Trip Manager'
}));

// 将数据库实例附加到请求对象
app.use((req, res, next) => {
  req.db = db;
  req.user = req.auth.user;
  next();
});

// 路由
app.use('/api/lock', require('./src/routes/lock'));
app.use('/api/groups', require('./src/routes/groups'));
app.use('/api/locations', require('./src/routes/locations'));
app.use('/api/activities', require('./src/routes/activities'));
app.use('/api/statistics', require('./src/routes/statistics'));

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: '服务器错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止服务器');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close();
  process.exit(0);
});