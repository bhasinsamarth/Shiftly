// File: src/hooks/useChatCache.js
// Hook to manage chat cache cleanup and optimization

import { useEffect } from 'react';
import { clearAllCaches, clearRoomCache } from '../utils/chatCacheService';

/**
 * Hook to manage chat cache cleanup
 * @param {string} roomId - Current room ID
 * @param {boolean} shouldClearOnUnmount - Whether to clear cache when component unmounts
 */
export function useChatCache(roomId = null, shouldClearOnUnmount = false) {
  useEffect(() => {
    // Cleanup function
    return () => {
      if (shouldClearOnUnmount) {
        if (roomId) {
          // Clear specific room cache
          clearRoomCache(roomId);
        } else {
          // Clear all caches
          clearAllCaches();
        }
      }
    };
  }, [roomId, shouldClearOnUnmount]);
}

/**
 * Hook to clear all caches on logout
 */
export function useChatCacheCleanup() {
  useEffect(() => {
    // Clear all caches when component mounts (e.g., on logout)
    clearAllCaches();
  }, []);
}

