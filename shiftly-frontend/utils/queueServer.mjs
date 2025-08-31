// server.js
import express from "express";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ✨ Use the SERVICE-ROLE key here, not anon
const queueClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: "pgmq_public" } }
);

app.post("/enqueue", async (req, res) => {
  const { roomId, senderId, iv, ciphertext, sentAt } = req.body;
  if (!roomId || !senderId || !iv || !ciphertext || !sentAt) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { data, error } = await queueClient.rpc("produce", {
      queue_name:    "messages",
      message:       { roomId, senderId, content: { iv, ciphertext }, sentAt },
      sleep_seconds: 0
    });
    if (error) throw error;
    console.log("🛎️ Job enqueued:", data);
    res.json(data);
  } catch (e) {
    console.error("❌ Enqueue failed:", e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.ENQUEUE_PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Enqueue API listening on http://localhost:${PORT}/enqueue`);
});
