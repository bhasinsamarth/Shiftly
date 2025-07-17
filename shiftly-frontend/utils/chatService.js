// src/lib/chatService.js
import { generateChatKey, encryptMessage, decryptMessage } from './crypto';
import { supabase } from '../supabaseClient';
import { enqueueMessage } from './chatQueueService';  // ← new import

/**
 * Create a new room with encryption key and link participants
 */
export async function createChatRoom(participants, metadata = {}) {
  const key = generateChatKey();

  const { data: room, error: insertErr } = await supabase
    .from('chat_rooms')
    .insert([{ ...metadata, encryption_key: key }])
    .select('id')
    .single();
  if (insertErr) throw insertErr;

  const { error: linkErr } = await supabase
    .from('chat_room_participants')
    .insert(
      participants.map(id => ({ room_id: room.id, employee_id: id }))
    );
  if (linkErr) throw linkErr;

  return room;
}

/**
 * Encrypt plaintext, enqueue into pgmq queue, and return the decrypted message
 */
export async function sendMessage(roomId, plainText, senderId) {
  // 1️⃣ fetch AES key for room
  const { data: [room], error: roomErr } = await supabase
    .from('chat_rooms')
    .select('encryption_key')
    .eq('id', roomId);
  if (roomErr || !room) throw roomErr || new Error('Room not found');

  // 2️⃣ encrypt payload
  const { ciphertext, iv } = encryptMessage(plainText, room.encryption_key);

  // 3️⃣ enqueue to your Supabase Queue
  await enqueueMessage({
    roomId,
    senderId,
    content: { ciphertext, iv },
    sentAt: new Date().toISOString()
  });

  // 4️⃣ decrypt optimistically for immediate UI return
  const text = decryptMessage(ciphertext, iv, room.encryption_key);
  return {
    id:       null,            // will be filled once the worker inserts
    senderId,
    text,
    sentAt:   new Date().toISOString()
  };
}

/**
 * Load all messages for a room, decrypting each
 */
export async function loadMessages(roomId) {
  const { data: [room], error: roomErr } = await supabase
    .from('chat_rooms')
    .select('encryption_key')
    .eq('id', roomId);
  if (roomErr || !room) throw roomErr || new Error('Room not found');

  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, sender_id, ciphertext, iv, created_at')
    .eq('chat_room_id', roomId)
    .order('created_at', { ascending: true });
  if (msgErr) throw msgErr;

  return msgs.map(m => ({
    id:       m.id,
    senderId: m.sender_id,
    sentAt:   m.created_at,
    text:     decryptMessage(m.ciphertext, m.iv, room.encryption_key)
  }));
}
