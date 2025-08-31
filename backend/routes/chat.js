// backend/routes/chat.js
import express from 'express';
import { db } from '../config/database.js';
import { authenticateToken, requireOwnership } from '../middleware/auth.js';
import { validate, validateQuery, schemas } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Get chat rooms for current user
router.get('/rooms',
  authenticateToken,
  validateQuery(Joi.object({
    type: Joi.string().valid('group', 'private', 'store').optional(),
    page: schemas.pagination.page,
    limit: schemas.pagination.limit
  })),
  async (req, res) => {
    try {
      const { type, page, limit } = req.query;
      const { employee_id } = req.user;

      // Build complex query to get rooms with participant info and unread counts
      let query = db.client
        .from('chat_room_participants')
        .select(`
          room_id,
          last_read,
          chat_rooms!inner (
            id,
            name,
            type,
            store_id,
            created_at
          )
        `)
        .eq('employee_id', employee_id)
        .is('deleted_at', null);

      if (type) {
        query = query.eq('chat_rooms.type', type);
      }

      // For store chats, only show user's store
      if (type === 'store' || !type) {
        query = query.eq('chat_rooms.store_id', req.user.store_id);
      }

      const { data: rooms, error } = await query
        .order('chat_rooms.created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      // Get unread message counts for each room
      const roomIds = rooms.map(r => r.room_id);
      
      if (roomIds.length > 0) {
        const { data: messageCounts } = await db.client
          .from('messages')
          .select('chat_room_id, created_at')
          .in('chat_room_id', roomIds);

        // Calculate unread counts
        const roomsWithCounts = rooms.map(room => {
          const lastRead = new Date(room.last_read || 0);
          const unreadCount = messageCounts
            ? messageCounts.filter(msg => 
                msg.chat_room_id === room.room_id && 
                new Date(msg.created_at) > lastRead
              ).length
            : 0;

          return {
            ...room.chat_rooms,
            room_id: room.room_id,
            last_read: room.last_read,
            unread_count: unreadCount
          };
        });

        res.json(roomsWithCounts);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error('Get chat rooms error:', error);
      res.status(500).json({ error: 'Failed to fetch chat rooms' });
    }
  }
);

// Create new chat room
router.post('/rooms',
  authenticateToken,
  validate(Joi.object({
    participants: Joi.array().items(schemas.employee_id).min(2).required(),
    name: Joi.string().min(1).max(100).trim().optional(),
    type: Joi.string().valid('group', 'private').default('group')
  })),
  async (req, res) => {
    try {
      const { participants, name, type } = req.body;
      const { employee_id, store_id } = req.user;

      // Validate that current user is in participants
      if (!participants.includes(employee_id)) {
        participants.push(employee_id);
      }

      // Validate that all participants exist and belong to same store
      const employees = await db.safeSelect(
        'employee',
        ['employee_id', 'store_id', 'first_name', 'last_name'],
        { employee_id: { value: participants, operator: 'in' } }
      );

      if (employees.length !== participants.length) {
        const foundIds = employees.map(e => e.employee_id);
        const missingIds = participants.filter(id => !foundIds.includes(id));
        return res.status(400).json({ 
          error: 'Some participants not found',
          missing_participants: missingIds
        });
      }

      // Check if all participants are from same store
      const differentStores = employees.filter(emp => emp.store_id !== store_id);
      if (differentStores.length > 0) {
        return res.status(400).json({ 
          error: 'All participants must be from the same store'
        });
      }

      // For private chats, check if room already exists
      if (type === 'private' && participants.length === 2) {
        const { data: existingRooms } = await db.client
          .rpc('find_private_chat_room', {
            participant1: participants[0],
            participant2: participants[1]
          });

        if (existingRooms && existingRooms.length > 0) {
          return res.status(400).json({ 
            error: 'Private chat already exists',
            room_id: existingRooms[0].id
          });
        }
      }

      // Generate room name if not provided
      const roomName = name || (type === 'private' 
        ? `${employees.find(e => e.employee_id !== employee_id)?.first_name || 'Private'} Chat`
        : `Group Chat ${new Date().toISOString().slice(0, 10)}`
      );

      // Create chat room
      const newRoom = await db.safeInsert('chat_rooms', {
        name: roomName,
        type,
        store_id,
        encryption_key: generateEncryptionKey() // You'll need to implement this
      });

      const roomId = newRoom[0].id;

      // Add participants
      const participantEntries = participants.map(participant_id => ({
        room_id: roomId,
        employee_id: participant_id
      }));

      await db.safeInsert('chat_room_participants', participantEntries);

      res.status(201).json({
        message: 'Chat room created successfully',
        room: {
          ...newRoom[0],
          participants: employees
        }
      });
    } catch (error) {
      console.error('Create chat room error:', error);
      res.status(500).json({ error: 'Failed to create chat room' });
    }
  }
);

// Get messages for a room
router.get('/rooms/:room_id/messages',
  authenticateToken,
  validateQuery(Joi.object({
    page: schemas.pagination.page,
    limit: schemas.pagination.limit.default(50)
  })),
  async (req, res) => {
    try {
      const { room_id } = req.params;
      const { page, limit } = req.query;
      const { employee_id } = req.user;

      // Verify user is participant in this room
      const participants = await db.safeSelect(
        'chat_room_participants',
        ['room_id'],
        { 
          room_id: { value: parseInt(room_id) },
          employee_id: { value: employee_id }
        }
      );

      if (!participants || participants.length === 0) {
        return res.status(403).json({ error: 'Access denied: not a participant' });
      }

      // Get messages
      const messages = await db.safeSelect(
        'messages',
        ['id', 'sender_id', 'iv', 'ciphertext', 'created_at'],
        { chat_room_id: { value: parseInt(room_id) } },
        {
          pagination: { page, limit },
          orderBy: { field: 'created_at', ascending: true }
        }
      );

      res.json(messages);
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

// Send message (queue-based)
router.post('/rooms/:room_id/messages',
  authenticateToken,
  validate(Joi.object({
    content: Joi.string().min(1).max(1000).required()
  })),
  async (req, res) => {
    try {
      const { room_id } = req.params;
      const { content } = req.body;
      const { employee_id } = req.user;

      // Verify user is participant in this room
      const participants = await db.safeSelect(
        'chat_room_participants',
        ['room_id'],
        { 
          room_id: { value: parseInt(room_id) },
          employee_id: { value: employee_id }
        }
      );

      if (!participants || participants.length === 0) {
        return res.status(403).json({ error: 'Access denied: not a participant' });
      }

      // Queue message for processing (you'll need to implement message queuing)
      const messageJob = {
        roomId: parseInt(room_id),
        senderId: employee_id,
        content: content,
        sentAt: new Date().toISOString()
      };

      // For now, we'll add to a simple queue table
      await db.safeInsert('message_queue', {
        queue_name: 'messages',
        message: messageJob
      });

      res.status(202).json({ 
        message: 'Message queued for processing',
        job: messageJob
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// Update room (rename)
router.put('/rooms/:room_id',
  authenticateToken,
  validate(Joi.object({
    name: Joi.string().min(1).max(100).trim().required()
  })),
  async (req, res) => {
    try {
      const { room_id } = req.params;
      const { name } = req.body;
      const { employee_id } = req.user;

      // Verify user is participant in this room
      const participants = await db.safeSelect(
        'chat_room_participants',
        ['room_id'],
        { 
          room_id: { value: parseInt(room_id) },
          employee_id: { value: employee_id }
        }
      );

      if (!participants || participants.length === 0) {
        return res.status(403).json({ error: 'Access denied: not a participant' });
      }

      const updatedRoom = await db.safeUpdate(
        'chat_rooms',
        { name },
        { id: parseInt(room_id) }
      );

      res.json({
        message: 'Room updated successfully',
        room: updatedRoom[0]
      });
    } catch (error) {
      console.error('Update room error:', error);
      res.status(500).json({ error: 'Failed to update room' });
    }
  }
);

// Leave/delete room
router.delete('/rooms/:room_id',
  authenticateToken,
  async (req, res) => {
    try {
      const { room_id } = req.params;
      const { employee_id } = req.user;

      // Mark participant as deleted
      await db.safeUpdate(
        'chat_room_participants',
        { deleted_at: new Date().toISOString() },
        { 
          room_id: parseInt(room_id),
          employee_id: employee_id
        }
      );

      // Check if this was the last participant
      const remainingParticipants = await db.safeSelect(
        'chat_room_participants',
        ['employee_id'],
        { 
          room_id: { value: parseInt(room_id) }
        }
      ).filter(p => !p.deleted_at);

      // If no participants left, delete the room and all messages
      if (remainingParticipants.length === 0) {
        await db.safeDelete('messages', { chat_room_id: parseInt(room_id) });
        await db.safeDelete('chat_rooms', { id: parseInt(room_id) });
      }

      res.json({ message: 'Left room successfully' });
    } catch (error) {
      console.error('Leave room error:', error);
      res.status(500).json({ error: 'Failed to leave room' });
    }
  }
);

// Helper function to generate encryption key (implement based on your crypto setup)
function generateEncryptionKey() {
  // This should match your existing crypto.mjs implementation
  return 'dummy-key-' + Math.random().toString(36).substring(2, 15);
}

export default router;

