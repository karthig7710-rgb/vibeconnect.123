import { useState } from 'react';
import { Check } from 'lucide-react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { errMsg } from '../api.js';

export default function ShareSongModal({ song, onClose }) {
  const { friends, sendMessage, toast } = useChat();
  const [sent, setSent] = useState({});
  const [busy, setBusy] = useState('');

  const send = async (f) => {
    setBusy(f._id);
    try {
      await sendMessage(f._id, { song });
      setSent((s) => ({ ...s, [f._id]: true }));
    } catch (e) {
      toast({ title: 'Could not share', body: errMsg(e) });
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal title={`Share “${song.title}”`} onClose={onClose}>
      {friends.length === 0 && <p className="text-sm text-slate-400">Add a friend first, then you can share songs with them.</p>}
      {friends.map((f) => (
        <div key={f._id} className="mb-1 flex items-center gap-3 rounded-2xl px-2 py-2">
          <Avatar user={f} size={40} showStatus />
          <p className="flex-1 truncate font-semibold">{f.username}</p>
          {sent[f._id] ? (
            <span className="flex items-center gap-1 text-sm text-emerald-400"><Check size={16} /> Sent</span>
          ) : (
            <button className="btn-primary !px-4 !py-1.5" disabled={busy === f._id} onClick={() => send(f)}>{busy === f._id ? '…' : 'Send'}</button>
          )}
        </div>
      ))}
    </Modal>
  );
}
