// File: src/utils/chatCacheService.js
// Optimized chat service with caching to reduce excessive API requests

import { supabase } from "../supabaseClient.js";
import { loadMessages } from "./chatService.js";

// Cache for employee data to avoid repeated fetches
const employeeCache = new Map();
const EMPLOYEE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for room metadata
const roomCache = new Map();
const ROOM_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Cache for messages per room
const messageCache = new Map();
const MESSAGE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Cache for store data
const storeCache = new Map();
const STORE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached data or fetch if expired/missing
 */
function getCachedData(cache, key, fetchFn, ttl) {
  const cached = cache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < ttl) {
    return Promise.resolve(cached.data);
  }
  
  return fetchFn().then(data => {
    cache.set(key, { data, timestamp: now });
    return data;
  });
}

/**
 * Get employee data with caching
 */
export async function getCachedEmployeeData(employeeIds) {
  if (!employeeIds || employeeIds.length === 0) return {};
  
  const uniqueIds = [...new Set(employeeIds)];
  const cacheKey = `employees_${uniqueIds.sort().join(',')}`;
  
  return getCachedData(
    employeeCache,
    cacheKey,
    async () => {
      const { data: emps } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path')
        .in('employee_id', uniqueIds);
      
      const map = {};
      emps?.forEach(e => {
        map[e.employee_id] = {
          name: `${e.first_name} ${e.last_name}`.trim(),
          avatar: e.profile_photo_path
            ? supabase.storage
                .from('profile-photo')
                .getPublicUrl(e.profile_photo_path).data.publicUrl
            : 'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg'
        };
      });
      return map;
    },
    EMPLOYEE_CACHE_TTL
  );
}

/**
 * Get room metadata with caching
 */
export async function getCachedRoomData(roomId) {
  const cacheKey = `room_${roomId}`;
  
  return getCachedData(
    roomCache,
    cacheKey,
    async () => {
      const { data: room, error } = await supabase
        .from('chat_rooms')
        .select('name, type, store_id, encryption_key')
        .eq('id', roomId)
        .single();
      
      if (error) throw error;
      return room;
    },
    ROOM_CACHE_TTL
  );
}

/**
 * Get store data with caching
 */
export async function getCachedStoreData(storeId) {
  if (!storeId) return null;
  
  const cacheKey = `store_${storeId}`;
  
  return getCachedData(
    storeCache,
    cacheKey,
    async () => {
      const { data: store, error } = await supabase
        .from('store')
        .select('store_name')
        .eq('store_id', storeId)
        .single();
      
      if (error) return null;
      return store;
    },
    STORE_CACHE_TTL
  );
}

/**
 * Get messages with caching and incremental loading
 */
export async function getCachedMessages(roomId, lastMessageId = null) {
  const cacheKey = `messages_${roomId}`;
  
  // If we have cached messages and no specific lastMessageId, return cached
  const cached = messageCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < MESSAGE_CACHE_TTL && !lastMessageId) {
    return Promise.resolve(cached.data);
  }
  
  // Load messages (this will be optimized further)
  const messages = await loadMessages(roomId);
  
  // Cache the result
  messageCache.set(cacheKey, { data: messages, timestamp: now });
  
  return messages;
}

/**
 * Add new message to cache (for real-time updates)
 */
export function addMessageToCache(roomId, newMessage) {
  const cacheKey = `messages_${roomId}`;
  const cached = messageCache.get(cacheKey);
  
  if (cached) {
    // Add new message to existing cache
    const updatedMessages = [...cached.data, newMessage];
    messageCache.set(cacheKey, { 
      data: updatedMessages, 
      timestamp: Date.now() 
    });
  }
}

/**
 * Clear cache for a specific room (when needed)
 */
export function clearRoomCache(roomId) {
  const keys = [
    `room_${roomId}`,
    `messages_${roomId}`,
    `store_${roomId}` // if store_id is same as room_id
  ];
  
  keys.forEach(key => {
    roomCache.delete(key);
    messageCache.delete(key);
    storeCache.delete(key);
  });
}

/**
 * Clear all caches (for logout, etc.)
 */
export function clearAllCaches() {
  employeeCache.clear();
  roomCache.clear();
  messageCache.clear();
  storeCache.clear();
}

/**
 * Get participant data with caching
 */
export async function getCachedParticipantData(roomId, excludeEmployeeId = null) {
  const cacheKey = `participants_${roomId}_${excludeEmployeeId || 'all'}`;
  
  return getCachedData(
    roomCache,
    cacheKey,
    async () => {
      let query = supabase
        .from('chat_room_participants')
        .select('employee(first_name, last_name, profile_photo_path), deleted_at')
        .eq('room_id', roomId);
      
      if (excludeEmployeeId) {
        query = query.neq('employee_id', excludeEmployeeId);
      }
      
      const { data: participants, error } = await query;
      
      if (error) throw error;
      return participants;
    },
    ROOM_CACHE_TTL
  );
}

