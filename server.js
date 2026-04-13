const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3003;

// 存储所有房间
const rooms = new Map();

// 中间件
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// 创建房间
app.post('/api/create-room', (req, res) => {
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
  
  console.log(`🆕 创建房间：${roomId}`);
  res.json({ success: true, roomId });
});

// 加入房间
app.post('/api/join-room', (req, res) => {
  const { roomId, playerName, seat } = req.body;
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }
  
  // 检查座位是否已被占用
  const occupiedSeat = room.state.players.find(p => p.seat === seat && p.name !== '东风' && p.name !== '南风' && p.name !== '西风' && p.name !== '北风');
  if (occupiedSeat && occupiedSeat.name) {
    return res.status(400).json({ error: '该座位已被占用' });
  }
  
  res.json({ 
    success: true, 
    room: {
      id: room.id,
      players: room.state.players,
      round: room.state.round
    }
  });
});

// 获取房间状态
app.get('/api/room/:roomId', (req, res) => {
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
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log('🔌 玩家连接:', socket.id);
  
  let currentRoom = null;
  let currentPlayer = null;
  
  // 加入房间
  socket.on('join-room', (data) => {
    const { roomId, playerName, seat } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }
    
    currentRoom = roomId;
    currentPlayer = { id: socket.id, name: playerName, seat };
    
    // 更新房间玩家信息
    room.state.players[seat] = {
      id: socket.id,
      name: playerName,
      score: room.state.players[seat]?.score || 0,
      seat
    };
    
    if (!room.host) {
      room.host = socket.id;
    }
    
    // 加入 Socket.IO 房间
    socket.join(roomId);
    
    // 通知房间内所有人
    io.to(roomId).emit('room-update', {
      players: room.state.players,
      round: room.state.round,
      host: room.host
    });
    
    console.log(`👤 ${playerName} 加入房间 ${roomId} - ${['东','南','西','北'][seat]}风位`);
  });
  
  // 更新分数
  socket.on('update-score', (data) => {
    const { roomId, playerIndex, delta } = data;
    const room = rooms.get(roomId);
    
    if (!room) return;
    
    room.state.players[playerIndex].score += delta;
    
    // 广播给所有人
    io.to(roomId).emit('score-update', {
      playerIndex,
      newScore: room.state.players[playerIndex].score,
      timestamp: Date.now()
    });
  });
  
  // 胡牌
  socket.on('win-hand', (data) => {
    const { roomId, winnerIndex, winType, baseScore, multiplier, pointIndex } = data;
    const room = rooms.get(roomId);
    
    if (!room) return;
    
    // 计算分数
    let score = baseScore * multiplier;
    if (winType == '2') { // 点炮
      score *= 1;
      room.state.players[winnerIndex].score += score;
      room.state.players[pointIndex].score -= score;
    } else { // 自摸或其他
      score *= 3;
      const perPlayer = Math.floor(score / 3);
      room.state.players[winnerIndex].score += score;
      room.state.players.forEach((p, i) => {
        if (i !== winnerIndex) {
          p.score -= perPlayer;
        }
      });
    }
    
    // 记录历史
    const winTypes = { '1':'自摸', '2':'点炮', '3':'杠上花', '4':'抢杠胡', '5':'海底捞月' };
    room.state.history.unshift({
      round: room.state.round,
      time: new Date().toLocaleString('zh-CN'),
      winner: room.state.players[winnerIndex].name,
      winType: winTypes[winType],
      score: score,
      detail: `${room.state.players[winnerIndex].name} ${winTypes[winType]} +${score}`
    });
    
    // 下一局
    room.state.round++;
    
    // 广播给所有人
    io.to(roomId).emit('win-result', {
      players: room.state.players,
      round: room.state.round,
      history: room.state.history[0],
      winner: room.state.players[winnerIndex].name,
      score: score
    });
    
    console.log(`🀄 ${room.state.players[winnerIndex].name} 胡牌 +${score}`);
  });
  
  // 重置游戏
  socket.on('reset-game', (data) => {
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
  });
  
  //  disconnect
  socket.on('disconnect', () => {
    console.log('❌ 玩家断开连接:', socket.id);
    
    if (currentRoom && currentPlayer) {
      const room = rooms.get(currentRoom);
      if (room) {
        // 清空该玩家的座位
        if (room.state.players[currentPlayer.seat]?.id === socket.id) {
          room.state.players[currentPlayer.seat] = {
            id: null,
            name: ['东','南','西','北'][currentPlayer.seat],
            score: room.state.players[currentPlayer.seat].score,
            seat: currentPlayer.seat
          };
        }
        
        // 如果房主离开，转移房主
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
  });
});

// 清理过期房间（每 10 分钟清理一次超过 24 小时的房间）
setInterval(() => {
  const now = Date.now();
  const expireTime = 24 * 60 * 60 * 1000; // 24 小时
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > expireTime) {
      rooms.delete(roomId);
      console.log(`🗑️ 清理过期房间：${roomId}`);
    }
  }
}, 10 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`🀄 麻将计分在线服务器运行在 http://localhost:${PORT}`);
  console.log(`📱 支持多人实时同步`);
});