// supabase/functions/processMessages/index.ts
// @ts-nocheck

import { serve } from 'https://deno.land/std@0.185.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const URL = Deno.env.get('SUPABASE_URL')
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const db = createClient(URL, KEY)

serve(async req => {
  // 1) parse the JSON POST from pg_net
  const record = await req.json()        // the entire NEW row
  const job    = record.message          // { roomId, senderId, content:{ciphertext,iv}, sentAt }

  // 2) insert into your real messages table
  const { error } = await db
    .from('messages')
    .insert({
      chat_room_id: job.roomId,
      sender_id:    job.senderId,
      ciphertext:   job.content.ciphertext,
      iv:           job.content.iv,
      created_at:   job.sentAt
    })

  if (error) console.error('Insert error', error)
  return new Response('ok')
})
