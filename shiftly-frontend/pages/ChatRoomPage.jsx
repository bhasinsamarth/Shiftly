// File: src/pages/ChatRoomPage.jsx

/*import React, { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import PrivateChatRoom from "../components/Chat/PrivateChatRoom";
import GroupChatRoom   from "../components/Chat/GroupChatRoom";
import StoreChat       from "../components/Chat/StoreChat";
import { loadMessages, sendMessage } from "../utils/chatService";

export default function ChatRoomPage() {
  const { user }   = useAuth();
  const qc         = useQueryClient();
  const { roomId } = useParams();
  const mode       = new URLSearchParams(useLocation().search).get("mode") === "private"
                     ? "private"
                     : "group";
  const bottomRef = useRef();

  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [roomName, setRoomName]               = useState("");
  const [roomType, setRoomType]               = useState("");
  const [messages, setMessages]               = useState([]);
  const [input, setInput]                     = useState("");
  const [loading, setLoading]                 = useState(true);

  // Alert modal state
  const [alertModalMsg, setAlertModalMsg] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const openAlertModal = msg => {
    setAlertModalMsg(msg);
    setShowAlertModal(true);
  };

  // 1️⃣ Load current employee ID
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("employee")
      .select("employee_id")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("Employee load error:", error);
        else setCurrentEmployee(data);
      });
  }, [user]);

  // 2️⃣ Load room metadata
  useEffect(() => {
    if (!roomId) return;
    supabase
      .from("chat_rooms")
      .select("name,type")
      .eq("id", roomId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("Room load error:", error);
        else {
          setRoomName(data.name);
          setRoomType(data.type);
        }
      });
  }, [roomId]);

  // 🔄 reload helper
  const reload = async () => {
    setLoading(true);
    const msgs = await loadMessages(roomId);
    setMessages(msgs);
    setLoading(false);

    // mark read
    await supabase
      .from("chat_room_participants")
      .update({ last_read: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("employee_id", currentEmployee.employee_id);
    qc.invalidateQueries(["rooms", currentEmployee.employee_id]);
  };

  // 3️⃣ Subscribe to real-time INSERT & DELETE on messages
  useEffect(() => {
    if (!roomId || !currentEmployee) return;
    reload();

    const channel = supabase
      .channel(`messages-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_room_id=eq.${roomId}` },
        () => {
          reload();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `chat_room_id=eq.${roomId}` },
        payload => {
          // remove from UI
          setMessages(ms => ms.filter(m => m.id !== payload.old.id));
          // if it was your own message, show alert
          if (payload.old.sender_id === currentEmployee.employee_id) {
            openAlertModal("Your message was restricted by policy.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, currentEmployee]);

  // ✉️ send handler
  const handleSend = async e => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendMessage(roomId, input.trim(), currentEmployee.employee_id);
    setInput("");
  };

  // ↘️ auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!currentEmployee || loading) {
    return <div className="p-6 text-center">Loading chat…</div>;
  }

  const commonProps = {
    roomId,
    currentEmployee,
    messages,
    input,
    setInput,
    onSend: handleSend,
    bottomRef,
    roomName
  };

  return (
    <>
      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-xl font-bold mb-4 text-red-700">Alert</h2>
            <p className="mb-6 text-gray-800">{alertModalMsg}</p>
            <button
              onClick={() => setShowAlertModal(false)}
              className="px-6 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {mode === "private"
        ? <PrivateChatRoom {...commonProps}/>
        : roomType === "store"
          ? <StoreChat {...commonProps}/>
          : <GroupChatRoom {...commonProps}/>}
    </>
  );
}

*/