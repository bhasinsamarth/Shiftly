// src/pages/ChatPage.jsx

import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import GroupChatRoom from '../components/Chat/GroupChatRoom.jsx';
import PrivateChatRoom from '../components/Chat/PrivateChatRoom.jsx';
import StoreChat from '../components/Chat/StoreChat.jsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';

// add room‐creation helper
import { createChatRoom } from '../utils/chatService.js';

const DEFAULT_AVATAR_URL =
  'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';
const NewGroupModal   = lazy(() => import('../components/Chat/NewGroupModal.jsx'));
const NewPrivateModal = lazy(() => import('../components/Chat/NewPrivateModal.jsx'));

function useRooms(employee) {
  return useQuery({
    queryKey: ['rooms', employee?.employee_id],
    queryFn: async () => {
      // 1️⃣ load participant records
      const { data: parts } = await supabase
        .from('chat_room_participants')
        .select('room_id, deleted_at, last_read, chat_rooms(id, type, name)')
        .eq('employee_id', employee.employee_id);

      // 2️⃣ filter by deleted_at + messages after
      const visible = [];
      for (let p of parts) {
        const room = p.chat_rooms;
        if (!p.deleted_at) {
          visible.push({ ...room, last_read: p.last_read, deleted_at: null });
        } else {
          const { data: recent } = await supabase
            .from('messages')
            .select('id')
            .eq('chat_room_id', room.id)
            .gt('created_at', p.deleted_at)
            .limit(1);
          if (recent.length) {
            visible.push({ ...room, last_read: p.last_read, deleted_at: p.deleted_at });
          }
        }
      }

      // 3️⃣ compute unread_count
      const withUnread = await Promise.all(
        visible.map(async r => {
          const since = r.last_read || r.deleted_at || new Date(0).toISOString();
          const { count } = await supabase
            .from('messages')
            .select('id', { head: true, count: 'exact' })
            .eq('chat_room_id', r.id)
            .neq('sender_id', employee.employee_id)
            .gt('created_at', since);
          return { ...r, unread_count: count ?? 0 };
        })
      );

      // 4️⃣ split store & group
      const storeChat  = withUnread.find(r => r.type === 'store');
      const groupChats = [
        ...(storeChat ? [storeChat] : []),
        ...withUnread.filter(r => r.type === 'group'),
      ];

      // 5️⃣ dedupe private
      let priv = withUnread.filter(r => r.type === 'private');
      priv = Array.from(new Set(priv.map(r => r.id))).map(id =>
        priv.find(r => r.id === id)
      );

      // 6️⃣ fetch peer info
      let privateChats = [];
      if (priv.length) {
        const ids = priv.map(r => r.id);
        const { data: others } = await supabase
          .from('chat_room_participants')
          .select('room_id, employee(employee_id, first_name, last_name, profile_photo_path)')
          .in('room_id', ids)
          .neq('employee_id', employee.employee_id);

        privateChats = priv
          .map(r => {
            const peer = others.find(o => o.room_id === r.id)?.employee;
            if (!peer) return null;
            const avatar = peer.profile_photo_path
              ? supabase.storage.from('profile-photo').getPublicUrl(peer.profile_photo_path).data.publicUrl
              : DEFAULT_AVATAR_URL;
            return {
              roomId:        r.id,
              participantId: peer.employee_id,
              name:          `${peer.first_name} ${peer.last_name}`,
              avatar,
              unread_count:  r.unread_count,
            };
          })
          .filter(Boolean);
      }

      return { groupChats, privateChats };
    },
    enabled: !!employee,
    staleTime: Infinity,
  });
}

export default function ChatPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const { search }  = useLocation();
  const qc          = useQueryClient();

  const [employee, setEmployee]         = useState(null);
  const [storeName, setStoreName]       = useState('');
  const [allEmployees, setAllEmployees] = useState([]);
  const [shownAlerts, setShownAlerts]   = useState(new Set()); // Track shown alerts

  const [showNewGroupModal,   setShowNewGroupModal]   = useState(false);
  const [showNewPrivateModal, setShowNewPrivateModal] = useState(false);
  const [newGroupName,        setNewGroupName]        = useState('');
  const [selGroup,            setSelGroup]            = useState([]);
  const [selPrivate,          setSelPrivate]          = useState(null);
  const [searchQ,             setSearchQ]             = useState('');
  const [confirmDeleteId,     setConfirmDeleteId]     = useState(null);
  const [groupError,          setGroupError]          = useState('');

  // Modal state for alert
  const [alertModalMsg, setAlertModalMsg] = useState('');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const openAlertModal = msg => {
    setAlertModalMsg(msg);
    setShowAlertModal(true);
  };

  // Subscribe to moderation events
  useEffect(() => {
    if (!employee) return;
    const channel = supabase
      .channel(`content_safety_events-${employee.employee_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content_safety_events',
          filter: `employee_id=eq.${employee.employee_id}`,
        },
        payload => {
          if (!shownAlerts.has(payload.new.id)) {
            setShownAlerts(prev => new Set(prev).add(payload.new.id));
            openAlertModal('Your Recent Message has been Removed because it violated our content policy.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee, shownAlerts]);

  // Check for recent moderation events on mount
  useEffect(() => {
    if (!employee) return;
    (async () => {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: events, error } = await supabase
        .from('content_safety_events')
        .select('id, created_at')
        .eq('employee_id', employee.employee_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && events?.length && !shownAlerts.has(events[0].id)) {
        setShownAlerts(prev => new Set(prev).add(events[0].id));
        openAlertModal('Your Recent Message has been Removed because it violated our content policy.');
      }
    })();
  }, [employee, shownAlerts]);

  // 1️⃣ Load current employee + coworkers
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: meRec } = await supabase
        .from('employee')
        .select('employee_id, store_id, profile_photo_path')
        .eq('id', user.id)
        .single();
      if (!meRec) return;

      const { data: storeRec } = await supabase
        .from('store')
        .select('store_name')
        .eq('store_id', meRec.store_id)
        .single();

      const { data: coworkers } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path')
        .neq('employee_id', meRec.employee_id);

      setEmployee(meRec);
      setStoreName(storeRec.store_name);
      setAllEmployees(
        coworkers.map(e => ({
          ...e,
          avatar: e.profile_photo_path
            ? supabase.storage.from('profile-photo').getPublicUrl(e.profile_photo_path).data.publicUrl
            : DEFAULT_AVATAR_URL,
        }))
      );
    })();
  }, [user]);

  // 2️⃣ Ensure store chat exists (do not reset last_read)
  const { refetch: roomsRefetch } = useRooms(employee);
  useEffect(() => {
    if (!employee) return;
    (async () => {
      let { data: storeRoom } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('type', 'store')
        .eq('store_id', employee.store_id)
        .maybeSingle();
      if (!storeRoom) {
        const { data: newRoom } = await supabase
          .from('chat_rooms')
          .insert([{ type: 'store', store_id: employee.store_id, name: storeName }])
          .select('id')
          .single();
        storeRoom = newRoom;
      }
      await supabase
        .from('chat_room_participants')
        .upsert(
          { room_id: storeRoom.id, employee_id: employee.employee_id },
          { onConflict: ['room_id','employee_id'] }
        );
      roomsRefetch();
    })();
  }, [employee, storeName, roomsRefetch]);

  // 3️⃣ Load rooms & badge counts
  const { data: rd, isLoading } = useRooms(employee);
  const groupChats   = rd?.groupChats   ?? [];
  const privateChats = rd?.privateChats ?? [];

  // Total unread per category
  const totalGroupUnread   = useMemo(() => groupChats.reduce((sum, r) => sum + (r.unread_count||0), 0), [groupChats]);
  const totalPrivateUnread = useMemo(() => privateChats.reduce((sum, c) => sum + (c.unread_count||0), 0), [privateChats]);

  // UI state
  const params      = useMemo(() => new URLSearchParams(search), [search]);
  const initialMode = params.get('mode') === 'private' ? 'private' : 'group';
  const [mode, setMode] = useState(initialMode);

  const filteredEmployees = useMemo(
    () =>
      allEmployees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchQ.toLowerCase())
      ),
    [allEmployees, searchQ]
  );

  // Selected chat state
  const [selectedChat, setSelectedChat] = useState(null);

  const openChat = async (rid, type = 'group') => {
    await supabase
      .from('chat_room_participants')
      .update({ last_read: new Date().toISOString() })
      .eq('room_id', rid)
      .eq('employee_id', employee.employee_id);
    qc.invalidateQueries(['rooms', employee.employee_id]);
    setSelectedChat({ id: rid, type });
  };

  const deleteChat = async rid => {
    await supabase
      .from('chat_room_participants')
      .update({ deleted_at: new Date().toISOString() })
      .eq('room_id', rid)
      .eq('employee_id', employee.employee_id);
    roomsRefetch();
  };

  // 4️⃣ CREATE GROUP
  const createGroupChat = async () => {
    if (!newGroupName.trim()) return setGroupError('Group name required');
    if (!selGroup.length)      return setGroupError('Select at least one member');
    setGroupError('');

    const newRoom = await createChatRoom(
      [employee.employee_id, ...selGroup],
      { type: 'group', name: newGroupName.trim() }
    );

    const parts = [
      { room_id: newRoom.id, employee_id: employee.employee_id, is_admin: true },
      ...selGroup.map(id => ({ room_id: newRoom.id, employee_id: id, is_admin: false })),
    ];
    await supabase.from('chat_room_participants').upsert(parts, { onConflict: ['room_id','employee_id'] });
    roomsRefetch();
    setShowNewGroupModal(false);
    setNewGroupName('');
    setSelGroup([]);
    openChat(newRoom.id);
  };

  // 5️⃣ CREATE PRIVATE
  const createPrivateChat = async () => {
    if (!selPrivate) return;
    const me   = employee.employee_id;
    const them = selPrivate;

    // find existing
    const { data: mine } = await supabase.from('chat_room_participants').select('room_id, deleted_at').eq('employee_id', me);
    const mineIds = mine.map(r => r.room_id);
    const { data: theirs } = await supabase.from('chat_room_participants').select('room_id').eq('employee_id', them);
    const common = mineIds.filter(id => theirs.some(t => t.room_id === id));

    let existing = null;
    if (common.length) {
      const { data: privRooms } = await supabase
        .from('chat_rooms')
        .select('id')
        .in('id', common)
        .eq('type', 'private');
      existing = privRooms[0]?.id || null;
    }

    if (existing) {
      const myRec = mine.find(r => r.room_id === existing);
      await supabase
        .from('chat_room_participants')
        .update({ last_read: myRec.deleted_at })
        .eq('room_id', existing)
        .eq('employee_id', me);

      setShowNewPrivateModal(false);
      setSelPrivate(null);
      openChat(existing);
      return;
    }

    // create fresh
    const newRoom = await createChatRoom([me, them], { type: 'private' });
    await Promise.all(
      [me, them].map(id =>
        supabase
          .from('chat_room_participants')
          .insert({
            room_id:     newRoom.id,
            employee_id: id,
            last_read:   newRoom.created_at,
          })
      )
    );
    setShowNewPrivateModal(false);
    setSelPrivate(null);
    openChat(newRoom.id);
  };

  if (!employee || isLoading) {
    return <div className="p-6 text-center">Loading…</div>;
  }

  return (
    <div className="flex h-[80vh] max-h-[700px] bg-gray-100">
      {/* Sidebar */}
      <aside className="w-80 min-w-[18rem] border-r bg-white flex flex-col">
        {/* Search */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Search"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border bg-white focus:outline-none focus:ring"
          />
        </div>
        {/* Tabs */}
        <div className="flex gap-2 px-4 pt-4 pb-2 border-b">
          {['all','group','private'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedChat(null); }}
              className={`px-3 py-1 rounded font-medium ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {m === 'all' ? 'All' : m === 'group' ? 'Groups' : 'Personal'}
            </button>
          ))}
        </div>
        {/* New Chat Buttons */}
        <div className="px-4 pt-4 pb-2 flex gap-2">
          <button
            onClick={() => setShowNewGroupModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition"
          >
            + New Group
          </button>
          <button
            onClick={() => setShowNewPrivateModal(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded font-semibold hover:bg-gray-700 transition"
          >
            + New Private
          </button>
        </div>
        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {mode === 'all' || mode === 'group' ? (
            <>
              {(mode === 'all' || mode === 'group') && (
                <>
                  <div className="text-xs text-gray-400 px-6 pt-4 pb-1">Groups</div>
                  {groupChats.map(room => (
                    <div
                      key={room.id}
                      onClick={() => openChat(room.id, room.type)}
                      className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-blue-50 ${
                        selectedChat?.id === room.id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold">
                        <span>👥</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 truncate">
                          {room.type === 'store' ? storeName : room.name}
                        </div>
                        <div className="text-xs text-gray-500">Group chat</div>
                      </div>
                      {room.unread_count > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs font-semibold px-2 rounded-full">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          ) : null}

          {mode === 'all' || mode === 'private' ? (
            <>
              <div className="text-xs text-gray-400 px-6 pt-6 pb-1">Personal</div>
              {privateChats.map(c => (
                <div
                  key={c.roomId}
                  onClick={() => openChat(c.roomId, 'private')}
                  className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-blue-50 ${
                    selectedChat?.id === c.roomId ? 'bg-blue-100' : ''
                  }`}
                >
                  <img
                    src={c.avatar}
                    alt={c.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 truncate">{c.name}</div>
                    <div className="text-xs text-gray-500">Private chat</div>
                  </div>
                  {c.unread_count > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-semibold px-2 rounded-full">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-white">
        {/* Alert Modal */}
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

        {selectedChat ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-400">Loading chat…</div>}>
            {selectedChat.type === 'group' && (
              <GroupChatRoom
                roomId={selectedChat.id}
                currentEmployee={employee}
                roomName={groupChats.find(r => r.id === selectedChat.id)?.name || ''}
                triggerAlert={openAlertModal}
              />
            )}
            {selectedChat.type === 'private' && (
              <PrivateChatRoom
                roomId={selectedChat.id}
                currentEmployee={employee}
                triggerAlert={openAlertModal}
              />
            )}
            {selectedChat.type === 'store' && (
              <StoreChat
                roomId={selectedChat.id}
                currentEmployee={employee}
                triggerAlert={openAlertModal}
              />
            )}
          </Suspense>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <span className="text-2xl font-semibold">Select a chat to start messaging</span>
          </div>
        )}
      </main>

      {/* New Private Modal */}
      {showNewPrivateModal && (
        <Suspense fallback={<div>Loading…</div>}>
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-80">
              <h2 className="text-lg font-semibold mb-4">New Private Chat</h2>
              <input
                className="w-full mb-3 border rounded px-2 py-1"
                placeholder="Search coworkers…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              <NewPrivateModal
                allEmployees={filteredEmployees}
                existingPrivateIds={privateChats.map(c => c.participantId)}
                onCreate={createPrivateChat}
                onClose={() => setShowNewPrivateModal(false)}
                selected={selPrivate}
                setSelected={setSelPrivate}
              />
            </div>
          </div>
        </Suspense>
      )}

      {/* Confirmation Delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-80">
            <h2 className="text-lg font-semibold mb-4">Delete this chat?</h2>
            <p className="mb-6">This hides all messages up to now. Continue?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={async () => { await deleteChat(confirmDeleteId); setConfirmDeleteId(null); }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <Suspense fallback={<div>Loading…</div>}>
          <NewGroupModal
            allEmployees={filteredEmployees}
            onCreate={createGroupChat}
            onClose={() => { setShowNewGroupModal(false); setGroupError(''); }}
            selected={selGroup}
            setSelected={setSelGroup}
            groupName={newGroupName}
            setGroupName={setNewGroupName}
            error={groupError}
          />
        </Suspense>
      )}
    </div>
  );
}
