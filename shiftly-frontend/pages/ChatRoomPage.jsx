// src/pages/ChatRoomPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import PrivateChatRoom from '../components/Chat/PrivateChatRoom';
import GroupChatRoom   from '../components/Chat/GroupChatRoom';
import StoreChat       from '../components/Chat/StoreChat';

// ← point at your lib, not utils
import { loadMessages, sendMessage } from '../utils/chatService';

export default function ChatRoomPage() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const { search }   = useLocation();
  const qc           = useQueryClient();
  const { roomId }   = useParams();
  const mode         = new URLSearchParams(search).get('mode') === 'private'
                     ? 'private'
                     : 'group';
  const bottomRef    = useRef();

  // currentEmployee record
  const [currentEmployee, setCurrentEmployee] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('employee')
      .select('employee_id')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        setCurrentEmployee(data);
      });
  }, [user]);

  // roomName & roomType for header
  const [roomName, setRoomName] = useState(null);
  const [roomType, setRoomType] = useState(null);
  useEffect(() => {
    if (!roomId) return;
    supabase
      .from('chat_rooms')
      .select('name,type')
      .eq('id', roomId)
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        setRoomName(data.name);
        setRoomType(data.type);
      });
  }, [roomId]);

  // messages & input state
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(true);

  // cutoff for private chats
  const computeCutoff = async () => {
    const { data, error } = await supabase
      .from('chat_room_participants')
      .select('deleted_at, last_read')
      .eq('room_id', roomId)
      .eq('employee_id', currentEmployee.employee_id)
      .single();
    if (error || !data) return null;
    const da = data.deleted_at ? new Date(data.deleted_at) : null;
    const lr = data.last_read   ? new Date(data.last_read)   : null;
    const later = da && lr ? (da > lr ? da : lr) : (da || lr);
    return later ? later.toISOString() : null;
  };

  // load + decrypt all messages
  const reload = async () => {
    setLoading(true);
    let since = null;
    if (mode === 'private') {
      since = await computeCutoff();
    }
    // <-- NOW using your queue-backed loader
    let all = await loadMessages(roomId);
    if (since) {
      all = all.filter(m => new Date(m.sentAt) > new Date(since));
    }
    setMessages(all);
    setLoading(false);

    // mark as read
    await supabase
      .from('chat_room_participants')
      .update({ last_read: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('employee_id', currentEmployee.employee_id);
    qc.invalidateQueries(['rooms', currentEmployee.employee_id]);
  };

  // subscribe to new inserts
  useEffect(() => {
    if (!roomId || !currentEmployee) return;
    reload();
    const channel = supabase
      .channel(`messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${roomId}`
        },
        () => reload()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [roomId, currentEmployee, mode]);

  // send (encrypt & enqueue)
  const handleSend = async e => {
    e.preventDefault();
    if (!input.trim()) return;
    // ← pass in your sender’s employee_id
    await sendMessage(
      roomId,
      input.trim(),
      currentEmployee.employee_id
    );
    setInput('');
    // real-time listener will call reload()
  };

  // auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  if (mode === 'private') {
    return <PrivateChatRoom {...commonProps} />;
  } else if (roomType === 'store') {
    return <StoreChat {...commonProps} />;
  } else {
    return <GroupChatRoom {...commonProps} />;
  }
}
