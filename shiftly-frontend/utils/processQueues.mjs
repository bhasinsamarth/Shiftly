import { createClient } from '@supabase/supabase-js'
import { setIntervalAsync } from 'set-interval-async/fixed'
import dotenv from 'dotenv'
dotenv.config()

// 1) Your Supabase URL & service role key
const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// 2) Client pointed at the queue schema
const queueClient = createClient(URL, KEY, { db: { schema: 'pgmq_public' } })
// 3) Client for your real tables
const db          = createClient(URL, KEY)

async function drain() {
  // pop up to 1 job at a time
  const { data: jobs, error: popErr } = await queueClient.rpc('pop', {
    queue_name: 'messages'
  })
  if (popErr) {
    console.error('POP ERROR', popErr)
    return
  }
  if (!jobs?.length) return

  // 4) persist each job
  const job = jobs[0].message
  const { error: insErr } = await db
    .from('messages')
    .insert({
      chat_room_id: job.roomId,
      sender_id:    job.senderId,
      ciphertext:   job.content.ciphertext,
      iv:           job.content.iv,
      created_at:   job.sentAt
    })
  if (insErr) console.error('INSERT ERROR', insErr)
}

// 5) run the drain every 2 seconds
setIntervalAsync(drain, 1000)
