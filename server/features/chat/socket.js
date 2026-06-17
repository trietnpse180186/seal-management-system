const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

let io;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.use((socket, next) => {
      if (socket.handshake.query && socket.handshake.query.token){
        jwt.verify(socket.handshake.query.token, process.env.JWT_SECRET || 'seal_hackathon_secret_key_2026', function(err, decoded) {
          if (err) {
            console.error('Socket authentication error:', err.message);
            return next(new Error('Authentication error'));
          }
          socket.decoded = decoded;
          next();
        });
      }
      else {
        next(new Error('Authentication error'));
      }    
    });

    io.on('connection', (socket) => {
      const userId = socket.decoded.id;
      console.log(`User connected: ${userId}`);
      
      // Each user joins their personal room for targeted push notifications
      socket.join(`user:${userId}`);

      socket.on('join_room', async (roomId) => {
        try {
          const ChatRoom = mongoose.model('ChatRoom');
          const room = await ChatRoom.findById(roomId);
          if (room) {
            const hasAccess = room.members.some(memberId => memberId.toString() === userId) || 
                              (room.mentorId && room.mentorId.toString() === userId);
            
            if (hasAccess) {
              socket.join(roomId);
              console.log(`User ${userId} joined room ${roomId}`);
            } else {
              console.warn(`Unauthorized join attempt by ${userId} to room ${roomId}`);
              socket.emit('error', { message: 'Unauthorized to join this room' });
            }
          } else {
            console.warn(`Room not found: ${roomId}`);
            socket.emit('error', { message: 'Room not found' });
          }
        } catch (error) {
          console.error("Error joining room:", error);
        }
      });

      socket.on('leave_room', (roomId) => {
        socket.leave(roomId);
        console.log(`User ${userId} left room ${roomId}`);
      });

      socket.on('send_message', async (data) => {
        try {
          const ChatMessage = mongoose.model('ChatMessage');
          const ChatRoom = mongoose.model('ChatRoom');
          const Notification = mongoose.model('Notification');
          const User = mongoose.model('User');
          const { roomId, content, replyTo } = data;
          
          const user = await User.findById(userId);
          if (!user) {
            console.warn(`Sender user not found for ID: ${userId}`);
            return;
          }

          const newMessage = new ChatMessage({
            roomId,
            senderId: user._id,
            senderName: user.fullName || user.email,
            content,
            replyTo: replyTo ? {
              messageId: replyTo.messageId,
              senderName: replyTo.senderName,
              content: replyTo.content
            } : undefined
          });

          await newMessage.save();

          // Broadcast to all clients in the room including sender
          io.to(roomId).emit('new_message', newMessage);

          // Create in-app Notification for all room members EXCEPT sender
          try {
            const room = await ChatRoom.findById(roomId);
            if (room) {
              const allUsers = [...(room.members || [])];
              if (room.mentorId) {
                allUsers.push(room.mentorId);
              }
              // Deduplicate and filter out sender
              const uniqueUserIds = Array.from(new Set(allUsers.map(id => id.toString())));
              const recipients = uniqueUserIds.filter(
                idStr => idStr !== userId.toString()
              );

              const preview = content.length > 60 ? content.slice(0, 60) + '…' : content;
              const notifDocs = recipients.map(recipientId => ({
                userId: recipientId,
                type: 'chat_message',
                title: `💬 Tin nhắn mới từ ${user.fullName || user.email}`,
                body: preview,
                channel: 'in_app',
                status: 'sent',
                isRead: false,
                metadata: { roomId, messageId: newMessage._id },
                sentAt: new Date()
              }));
              if (notifDocs.length > 0) {
                const savedNotifs = await Notification.insertMany(notifDocs);
                // Push real-time bell notification to each recipient's personal socket room
                savedNotifs.forEach((notif) => {
                  io.to(`user:${notif.userId.toString()}`).emit('new_notification', notif);
                });
              }
            }
          } catch (notifError) {
            console.error('Failed to create chat notifications:', notifError.message);
          }

        } catch (error) {
          console.error("Error sending message via socket", error);
        }
      });

      socket.on('recall_message', async (data) => {
        try {
          const ChatMessage = mongoose.model('ChatMessage');
          const { messageId, roomId } = data;

          const message = await ChatMessage.findById(messageId);
          if (!message) {
            console.warn(`Message not found: ${messageId}`);
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // Verify the sender is the one recalling it
          if (message.senderId.toString() !== userId.toString()) {
            console.warn(`Unauthorized recall attempt by user ${userId} for message ${messageId}`);
            socket.emit('error', { message: 'You can only recall your own messages' });
            return;
          }

          message.isRecalled = true;
          message.content = "Tin nhắn đã bị thu hồi";
          await message.save();

          // Broadcast the recall event to all clients in the room
          io.to(roomId).emit('message_recalled', { messageId, roomId, content: message.content });

        } catch (error) {
          console.error("Error recalling message via socket", error);
        }
      });

      socket.on('disconnect', () => {
        console.log('User disconnected', userId);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized!");
    }
    return io;
  }
};
