// src/pages/ChatRoomPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

import StoreChat from '../components/Chat/StoreChat';
import GroupChatRoom from '../components/Chat/GroupChatRoom';
import PrivateChatRoom from '../components/Chat/PrivateChatRoom';

const ChatRoomPage = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [room, setRoom] = useState(null);
  const [storeName, setStoreName] = useState('');   // ← store-name state
  const [loading, setLoading] = useState(true);

  // 1️⃣ Fetch current employee ID
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('employee')
      .select('employee_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setEmployee(data));
  }, [user]);

  // 2️⃣ Fetch room metadata (including store_id)
  useEffect(() => {
    if (!roomId) return;
    supabase
      .from('chat_rooms')
      .select('id, type, name, store_id')
      .eq('id', roomId)
      .single()
      .then(async ({ data }) => {
        setRoom(data);
        setLoading(false);

        // 3️⃣ If it's a store room, fetch the real store_name
        if (data.type === 'store') {
          const { data: storeRec, error: storeErr } = await supabase
            .from('store')
            .select('store_name')
            .eq('store_id', data.store_id)
            .single();
          if (!storeErr && storeRec) {
            setStoreName(storeRec.store_name);
          }
        }
      });
  }, [roomId]);

  if (loading || !employee || !room) {
    return <div className="p-6 text-center">Loading chat...</div>;
  }

  // 4️⃣ Choose the right chat component
  let ChatComponent;
  if (room.type === 'store') ChatComponent = StoreChat;
  else if (room.type === 'group') ChatComponent = GroupChatRoom;
  else if (room.type === 'private') ChatComponent = PrivateChatRoom;
  else return <div className="p-6 text-center">Unknown chat type.</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Display storeName for store rooms, otherwise room.name */}
      <h1 className="text-2xl font-semibold mb-4">
        {room.type === 'store' ? storeName : room.name}
      </h1>

      <ChatComponent
        roomId={roomId}
        currentEmployee={employee}
        roomName={room.name}
      />
    </div>
  );
};

export default ChatRoomPage;
