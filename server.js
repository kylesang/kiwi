const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// 获取端口
const PORT = process.env.PORT || 3003;
console.log(`[INFO] 使用端口：${PORT}`);
console.log(`[INFO] 环境变量 PORT: ${process.env.PORT || 'undefined'}`);

// CORS 配置
const corsOptions = {
  origin: true, // 允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
};
app.use(cors(corsOptions));

// 静态文件
app.use(express.static('public', {
  maxAge: '1d',
  fallthrough: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Socket.IO 配置
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

// 存储所有房间
const rooms = new Map();

// API: 创建房间
app.post('/api/create-room', (req, res) => {
  try {
    const roomId = 'MJ' + uuidv4().replace(/-/g, '').substr(0, 6).toUpperCase();
    
    rooms.set(roomId, {
      id: roomId,
      createdAt: Date.now(),
      host: null,
      players: [],
      state: {
        round: 1,
        players: [
          { id: 0, name: '东风', score: 0, seat: 0 },
          { id: 1, name: '南风', score: 0, seat: 1 },
          { id: 2, name: '西风', score: 0, seat: 2 },
          { id: 3, name: '北风', score: 0, seat: 3 }
        ],
        history: []
      }
    });
    
    console.log(`✅ 创建房间：${roomId}`);
    res.json({ success: true, roomId });
  } catch (error) {
    console.error('❌ 创建房间失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 加入房间
app.post('/api/join-room', (req, res) => {
  try {
    const { roomId, playerName, seat } = req.body;
    
    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    res.json({ 
      success: true, 
      room: {
        id: room.id,
        players: room.state.players,
        round: room.state.round
      }
    });
  } catch (error) {
    console.error('❌ 加入房间失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: 获取房间状态
app.get('/api/room/:roomId', (req, res) => {
  try {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    res.json({
      success: true,
      room: {
        id: room.id,
        players: room.state.players,
        round: room.state.round,
        history: room.state.history
      }
    });
  } catch (error) {
    console.error('❌ 获取房间失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    port: PORT
  });
});

// 根路径
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log('🔌 玩家连接:', socket.id);
  
  let currentRoom = null;
  let currentPlayer = null;
  
  socket.on('join-room', (data) => {
    try {
      const { roomId, playerName, seat } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      currentRoom = roomId;
      currentPlayer = { id: socket.id, name: playerName, seat };
      
      room.state.players[seat] = {
        id: socket.id,
        name: playerName,
        score: room.state.players[seat]?.score || 0,
        seat
      };
      
      if (!room.host) {
        room.host = socket.id;
      }
      
      socket.join(roomId);
      
      io.to(roomId).emit('room-update', {
        players: room.state.players,
        round: room.state.round,
        host: room.host
      });
      
      console.log(`👤 ${playerName} 加入房间 ${roomId}`);
    } catch (error) {
      console.error('❌ 加入房间错误:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('update-score', (data) => {
    try {
      const { roomId, playerIndex, delta } = data;
      const room = rooms.get(roomId);
      
      if (!room) return;
      
      room.state.players[playerIndex].score += delta;
      
      io.to(roomId).emit('score-update', {
        playerIndex,
        newScore: room.state.players[playerIndex].score,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ 更新分数错误:', error);
    }
  });
  
  socket.on('win-hand', (data) => {
    try {
      const { roomId, winnerIndex, winType, baseScore, multiplier, pointIndex } = data;
      const room = rooms.get(roomId);
      
      if (!room) return;
      
      let score = baseScore * multiplier;
      if (winType == '2') {
        score *= 1;
        room.state.players[winnerIndex].score += score;
        room.state.players[pointIndex].score -= score;
      } else {
        score *= 3;
        const perPlayer = Math.floor(score / 3);
        room.state.players[winnerIndex].score += score;
        room.state.players.forEach((p, i) => {
          if (i !== winnerIndex) {
            p.score -= perPlayer;
          }
        });
      }
      
      const winTypes = { '1':'自摸', '2':'点炮', '3':'杠上花', '4':'抢杠胡', '5':'海底捞月' };
      room.state.history.unshift({
        round: room.state.round,
        time: new Date().toLocaleString('zh-CN'),
        winner: room.state.players[winnerIndex].name,
        winType: winTypes[winType],
        score: score,
        detail: `${room.state.players[winnerIndex].name} ${winTypes[winType]} +${score}`
      });
      
      room.state.round++;
      
      io.to(roomId).emit('win-result', {
        players: room.state.players,
        round: room.state.round,
        history: room.state.history[0],
        winner: room.state.players[winnerIndex].name,
        score: score
      });
      
      console.log(`🀄 ${room.state.players[winnerIndex].name} 胡牌 +${score}`);
    } catch (error) {
      console.error('❌ 胡牌处理错误:', error);
    }
  });
  
  socket.on('reset-game', (data) => {
    try {
      const { roomId } = data;
      const room = rooms.get(roomId);
      
      if (!room) return;
      
      room.state = {
        round: 1,
        players: [
          { id: 0, name: '东风', score: 0, seat: 0 },
          { id: 1, name: '南风', score: 0, seat: 1 },
          { id: 2, name: '西风', score: 0, seat: 2 },
          { id: 3, name: '北风', score: 0, seat: 3 }
        ],
        history: []
      };
      
      io.to(roomId).emit('game-reset', {
        players: room.state.players,
        round: room.state.round
      });
      
      console.log(`🔄 房间 ${roomId} 重置游戏`);
    } catch (error) {
      console.error('❌ 重置游戏错误:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ 玩家断开连接:', socket.id);
    
    try {
      if (currentRoom && currentPlayer) {
        const room = rooms.get(currentRoom);
        if (room) {
          if (room.state.players[currentPlayer.seat]?.id === socket.id) {
            room.state.players[currentPlayer.seat] = {
              id: null,
              name: ['东','南','西','北'][currentPlayer.seat],
              score: room.state.players[currentPlayer.seat].score,
              seat: currentPlayer.seat
            };
          }
          
          if (room.host === socket.id) {
            const remainingPlayer = room.state.players.find(p => p.id && p.id !== socket.id);
            if (remainingPlayer) {
              room.host = remainingPlayer.id;
              io.to(currentRoom).emit('host-changed', { host: room.host });
            }
          }
          
          io.to(currentRoom).emit('player-left', {
            seat: currentPlayer.seat,
            players: room.state.players
          });
        }
      }
    } catch (error) {
      console.error('❌ 断开连接处理错误:', error);
    }
  });
});

// 错误处理
process.on('uncaughtException', (err) => {
  console.error('💥 未捕获异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的 Promise 拒绝:', reason);
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   🀄 麻将计分在线服务器已启动          ║
║   端口：${PORT}                          ║
║   访问：http://localhost:${PORT}        ║
║   健康检查：/health                    ║
╚════════════════════════════════════════╝
  `);
}).on('error', (err) => {
  console.error('❌ 服务器启动失败:', err.message);
  process.exit(1);
});