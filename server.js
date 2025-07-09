const express = require('express');
const app = express();
const http = require('http').createServer(app);
const cors = require('cors');
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.static('client'));

let waitingUsers = [];

io.on('connection', socket => {
  console.log('🟢 New user connected:', socket.id);

  socket.on('join-with-clue', clue => {
    socket.clue = clue;
    waitingUsers.push(socket);

    if (waitingUsers.length >= 2) {
      const user1 = waitingUsers.shift();
      const user2 = waitingUsers.shift();

      const room = `room-${user1.id}-${user2.id}`;
      user1.join(room);
      user2.join(room);

      user1.emit('match', {
        yourClue: user1.clue,
        otherClue: user2.clue
      });

      user2.emit('match', {
        yourClue: user2.clue,
        otherClue: user1.clue
      });

      io.to(room).emit('message', {
        from: 'System',
        text: `You're now connected anonymously.\n${user1.clue} ↔ ${user2.clue}`
      });
    }
  });

  // ✅ Typing indicator
  socket.on('typing', () => {
    const rooms = Array.from(socket.rooms);
    const room = rooms.find(r => r !== socket.id);
    if (room) {
      socket.to(room).emit('show-typing', socket.clue || 'Someone');
    }
  });

  socket.on('stop-typing', () => {
    const rooms = Array.from(socket.rooms);
    const room = rooms.find(r => r !== socket.id);
    if (room) {
      socket.to(room).emit('hide-typing');
    }
  });

  // ✅ Chat handling
  socket.on('chat', msg => {
    const rooms = Array.from(socket.rooms);
    const room = rooms.find(r => r !== socket.id);
    if (room) {
      io.to(room).emit('message', {
        from: socket.clue || 'Anonymous',
        text: msg
      });
    }
  });

  // ✅ User disconnect
  socket.on('disconnect', () => {
    console.log('🔴 Disconnected:', socket.id);

    // Remove from waiting list
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);

    // Notify partner if connected in a room
    const rooms = Array.from(socket.rooms);
    const room = rooms.find(r => r !== socket.id);
    if (room) {
      socket.to(room).emit('message', {
        from: 'System',
        text: `${socket.clue || 'A user'} has left the chat.`
      });

      socket.leave(room);
    }
  });
});

http.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});
