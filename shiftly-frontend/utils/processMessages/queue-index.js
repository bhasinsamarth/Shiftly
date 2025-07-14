import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const URL = Deno.env.get('SUPABASE_URL');
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const queue = createClient(URL, KEY, { db: { schema: 'pgmq_public' } });
const db    = createClient(URL, KEY);

serve(async () => {
  const { data: jobs, error: popErr } = await queue.rpc('pop', { queue_name: 'messages' });
  if (popErr) {
    console.error('POP ERROR', popErr);
    return new Response('pop error', { status: 500 });
  }

  if (jobs && jobs.length) {
    const job = jobs[0].message;
    await db.from('messages').insert({
      chat_room_id: job.roomId,
      sender_id:    job.senderId,
      ciphertext:   job.content.ciphertext,
      iv:           job.content.iv,
      created_at:   job.sentAt,
    });
  }

  return new Response('ok');
});
