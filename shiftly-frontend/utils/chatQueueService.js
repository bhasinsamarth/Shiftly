// src/lib/chatQueueService.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const queueClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { db: { schema: 'pgmq_public' } }
)

export async function enqueueMessage({ roomId, senderId, content, sentAt }) {
  const { data, error } = await queueClient
    .rpc('send', {
      queue_name: 'messages',
      message: { roomId, senderId, content, sentAt },
      sleep_seconds: 0
    })
  if (error) throw error
  return data
}
