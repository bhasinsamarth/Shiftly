// File: src/utils/chatService.js

import { supabase } from "../supabaseClient.js";
import { generateChatKey, encryptMessage, decryptMessage } from "./crypto.mjs";
import { enqueueMessage } from "./chatQueueService.js";

/** Create a new room… (unchanged) */
export async function createChatRoom(participants, metadata = {}) {
  const key = generateChatKey();
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .insert([{ ...metadata, encryption_key: key }])
    .select("id")
    .single();
  if (error) throw error;
  await supabase
    .from("chat_room_participants")
    .insert(participants.map(id => ({ room_id: room.id, employee_id: id })));
  return room;
}

/** Queue-backed sendMessage */
export async function sendMessage(roomId, plainText, senderId) {
  // 1) fetch AES key
  const { data: [room], error: roomErr } = await supabase
    .from("chat_rooms")
    .select("encryption_key")
    .eq("id", roomId);
  if (roomErr || !room) throw roomErr || new Error("Room not found");

  // 2) encrypt
  const { iv, ciphertext } = encryptMessage(plainText, room.encryption_key);

  // 3) enqueue job
  await enqueueMessage({ roomId, senderId, content: { iv, ciphertext }, sentAt: new Date().toISOString() });

  // 4) optimistic UI: return the **clear** text, avoid a decryption error
  return {
    id:       null,       // will be replaced by the worker insert
    senderId,
    text:     plainText,
    sentAt:   new Date().toISOString()
  };
}

/** Load & decrypt all messages */
export async function loadMessages(roomId) {
  // 1) get AES key
  const { data: [room], error: roomErr } = await supabase
    .from("chat_rooms")
    .select("encryption_key")
    .eq("id", roomId);
  if (roomErr || !room) throw roomErr || new Error("Room not found");

  // 2) fetch rows
  const { data: msgs, error: msgErr } = await supabase
    .from("messages")
    .select("id, sender_id, iv, ciphertext, created_at")
    .eq("chat_room_id", roomId)
    .order("created_at", { ascending: true });
  if (msgErr) throw msgErr;

  // 3) decrypt with correct argument order: (iv, ciphertext, key)
  return msgs.map(m => {
    try {
      const text = decryptMessage(m.iv, m.ciphertext, room.encryption_key);
      return {
        id:       m.id,
        senderId: m.sender_id,
        text,
        sentAt:   m.created_at
      };
    } catch (err) {
      console.error(`Decrypt failed for ${m.id}:`, err);
      return {
        id:       m.id,
        senderId: m.sender_id,
        text:     "[🔒 Unable to decrypt]",
        sentAt:   m.created_at
      };
    }
  });
}
