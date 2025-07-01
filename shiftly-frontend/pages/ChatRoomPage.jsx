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
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);

  // 1️⃣ Fetch full current employee record (including store_id)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, role_id, store_id, profile_photo_path')
        .eq('id', user.id)
        .single();
      if (error) console.error('Error fetching employee:', error);
      else setEmployee(data);
    })();
  }, [user]);

  // 2️⃣ Fetch room metadata (including store_id)
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('id, type, name, store_id')
        .eq('id', roomId)
        .single();
      if (error) {
        console.error('Error fetching room:', error);
        setLoading(false);
        return;
      }
      setRoom(data);

      // 3️⃣ If it's a store-type room, fetch the store's name
      if (data.type === 'store' && data.store_id != null) {
        const { data: storeRec, error: storeErr } = await supabase
          .from('store')
          .select('store_name')
          .eq('store_id', data.store_id)
          .single();
        if (storeErr) console.error('Error fetching store name:', storeErr);
        else setStoreName(storeRec.store_name);
      }
      setLoading(false);
    })();
  }, [roomId]);

  if (loading || !employee || !room) {
    return <div className="p-6 text-center">Loading chat…</div>;
  }

  // 4️⃣ Pick which chat component to render
  let ChatComponent;
  if (room.type === 'store') ChatComponent = StoreChat;
  else if (room.type === 'group') ChatComponent = GroupChatRoom;
  else if (room.type === 'private') ChatComponent = PrivateChatRoom;
  else return <div className="p-6 text-center">Unknown chat type.</div>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
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
