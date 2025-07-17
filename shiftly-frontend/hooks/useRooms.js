// src/hooks/useRooms.js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';

const DEFAULT_AVATAR_URL =
  'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';

export function useRooms(employee) {
  return useQuery({
    queryKey: ['rooms', employee?.employee_id],
    queryFn: async () => {
      // 1️⃣ load participant rows
      const { data: parts, error: partsErr } = await supabase
        .from('chat_room_participants')
        .select('room_id, deleted_at, last_read, chat_rooms(id, type, name, store_id)')
        .eq('employee_id', employee.employee_id);
      if (partsErr) throw partsErr;

      // 2️⃣ filter out fully-deleted rooms without new messages
      const visible = [];
      for (let p of parts) {
        const { id, type, name, store_id } = p.chat_rooms;
        if (!p.deleted_at) {
          visible.push({ id, type, name, store_id, last_read: p.last_read, deleted_at: null });
        } else {
          // was deleted → check if any messages after deletion
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('chat_room_id', id)
            .gt('created_at', p.deleted_at);
          if (count > 0) {
            visible.push({ id, type, name, store_id, last_read: p.last_read, deleted_at: p.deleted_at });
          }
        }
      }

      // 3️⃣ compute unread_count
      const withUnread = await Promise.all(
        visible.map(async (r) => {
          const since = r.last_read || r.deleted_at || new Date(0).toISOString();
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('chat_room_id', r.id)
            .neq('sender_id', employee.employee_id)
            .gt('created_at', since);
          return { ...r, unread_count: count || 0 };
        })
      );

      // 4️⃣ group/store chats
      const store = withUnread.find(r => r.type === 'store');
      const groupChats = [
        ...(store ? [store] : []),
        ...withUnread.filter(r => r.type === 'group'),
      ];

      // 5️⃣ private rooms + de-dup by participant
      let priv = withUnread.filter(r => r.type === 'private');
      const roomIds = priv.map(r => r.id);
      const { data: others } = await supabase
        .from('chat_room_participants')
        .select('room_id, employee(employee_id, first_name, last_name, profile_photo_path)')
        .in('room_id', roomIds)
        .neq('employee_id', employee.employee_id);

      const unique = {};
      for (let r of priv) {
        const part = others.find(o => o.room_id === r.id);
        if (!part?.employee) continue;
        const emp = part.employee;
        const avatar = emp.profile_photo_path
          ? supabase.storage.from('profile-photo').getPublicUrl(emp.profile_photo_path).data.publicUrl
          : DEFAULT_AVATAR_URL;
        if (!unique[emp.employee_id]) {
          unique[emp.employee_id] = {
            roomId:        r.id,
            participantId: emp.employee_id,
            name:          `${emp.first_name} ${emp.last_name}`,
            avatar,
            unread_count:  r.unread_count,
          };
        }
      }
      const privateChats = Object.values(unique);

      return { groupChats, privateChats };
    },
    enabled: !!employee,
    staleTime: Infinity,
  });
}
