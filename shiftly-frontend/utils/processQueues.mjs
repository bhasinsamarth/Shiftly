// File: shiftly-frontend/utils/processQueues.mjs
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { setIntervalAsync } from "set-interval-async/fixed";
import { decryptMessage } from "./crypto.mjs";
import ContentSafetyClient, { isUnexpected } from "@azure-rest/ai-content-safety";
import { AzureKeyCredential } from "@azure/core-auth";

console.log("▶️ Worker starting…");

// 1) Supabase queue + data clients
const URL         = process.env.SUPABASE_URL;
const KEY         = process.env.SUPABASE_SERVICE_ROLE_KEY;
const queueClient = createClient(URL, KEY, { db: { schema: "pgmq_public" } });
const db          = createClient(URL, KEY);

// 2) Content Safety client
const rawEndpoint = process.env.CONTENT_SAFETY_ENDPOINT || "";
const endpoint    = rawEndpoint.endsWith("/") ? rawEndpoint.slice(0, -1) : rawEndpoint;
const safetyClient = ContentSafetyClient(
  endpoint,
  new AzureKeyCredential(process.env.CONTENT_SAFETY_KEY)
);

async function drain() {
  console.log("🔄 drain()");
  const { data: jobs, error: popErr } = await queueClient.rpc("pop", {
    queue_name: "messages"
  });
  if (popErr) {
    console.error("POP ERROR", popErr);
    return;
  }
  if (!jobs?.length) {
    console.log("⚪ no jobs");
    return;
  }

  for (let { message: job } of jobs) {
    console.log("🛎️ Got job:", job);
    try {
      // a) fetch the room's AES key
      const { data: [room], error: roomErr } = await db
        .from("chat_rooms")
        .select("encryption_key")
        .eq("id", job.roomId);
      if (roomErr || !room) throw roomErr || new Error("Room not found");

      // b) decrypt
      const plainText = decryptMessage(
        job.content.iv,
        job.content.ciphertext,
        room.encryption_key
      );
      console.log("💼 Decrypted:", plainText);

      // c) analyze
      const res = await safetyClient
        .path("/text:analyze", "2023-10-01")
        .post({ body: { text: plainText } });
      if (isUnexpected(res)) throw res;
      console.log("💻 Safety:", res.body.categoriesAnalysis);

      // d) if any category is Medium+ (severity ≥4)
      const violation = res.body.categoriesAnalysis.some(c => {
        const sev = typeof c.severity === "string" ? +c.severity : c.severity;
        return sev >= 2;
      });

      if (violation) {
        console.log("🚨 Violation! Dummy‐insert → record event → delete…");

        // 1️⃣ dummy‐insert so frontend sees an INSERT
        const { data: flagged, error: insErr } = await db
          .from("messages")
          .insert({
            chat_room_id: job.roomId,
            sender_id:    job.senderId,
            ciphertext:   job.content.ciphertext,
            iv:           job.content.iv,
            created_at:   job.sentAt
          })
          .select("id")
          .single();
        if (insErr || !flagged?.id) {
          console.error("FLAG INSERT ERROR", insErr);
          continue;
        }
        console.log("✅ Dummy message ID=", flagged.id);

        // 2️⃣ record into content_safety_events using that flagged.id
        const { error: evtErr } = await db
          .from("content_safety_events")
          .insert({
            chat_room_id: job.roomId,
            message_id:   flagged.id,
            employee_id:  job.senderId,
          });
        if (evtErr) console.error("EVENT INSERT ERROR", evtErr);
        else console.log("✅ Safety event recorded for dummy ID=", flagged.id);

        // 3️⃣ immediately delete so frontend sees a DELETE
        const { error: delErr } = await db
          .from("messages")
          .delete()
          .eq("id", flagged.id);
        if (delErr) console.error("DELETE ERROR", delErr);
        else console.log(`↔️ Removed flagged message ID=${flagged.id}`);

        continue;  // skip the normal insert path
      }

      // e) SAFE → insert permanently into messages
      const { data: inserted, error: safeErr } = await db
        .from("messages")
        .insert({
          chat_room_id: job.roomId,
          sender_id:    job.senderId,
          ciphertext:   job.content.ciphertext,
          iv:           job.content.iv,
          created_at:   job.sentAt
        })
        .select("id")
        .single();
      if (safeErr) throw safeErr;
      console.log("✅ Safe message inserted, ID=", inserted.id);

    } catch (e) {
      console.error("Worker error processing job:", e);

      // record the error so front‐end can alert
      try {
        const { error: catchErr } = await db
          .from("content_safety_events")
          .insert({
            chat_room_id: job.roomId,
            message_id:   job.id,           // fallback to queue‐job id
            employee_id:  job.senderId,
            reason:       "Worker error: " + (e.message || e)
          });
        if (catchErr) console.error("EVENT INSERT ERROR (catch)", catchErr);
        else console.log("⚠️ Recorded error event for job", job.id);
      } catch {}
    }
  }
}

setIntervalAsync(drain, 1000);
