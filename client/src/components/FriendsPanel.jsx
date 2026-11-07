import { useEffect, useState } from 'react';
import { Search, UserPlus, Check, X, Clock, MessageCircle, UserMinus } from 'lucide-react';
import { api, errMsg } from '../api.js';
import { useChat } from '../context/ChatContext.jsx';
import Avatar from './Avatar.jsx';

export default function FriendsPanel({ onOpenChat }) {
  const { friends, requests, sendRequest, acceptRequest, removeRequest, unfriend, toast } = useChat();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const search = async (query = q) => {
    if (query.trim().length < 2) return setResults([]);
    setSearching(true);
    try {
      const r = await api.get('/users/search', { params: { q: query.trim() } });
      setResults(r.data.users);
    } catch (e) {
      toast({ title: 'Search failed', body: errMsg(e) });
    } finally {
      setSearching(false);
    }
  };

  // debounced live search
  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // keep result statuses fresh when requests/friends change
  useEffect(() => { if (q.trim().length >= 2) search(q); /* eslint-disable-next-line */ }, [requests, friends.length]);

  const act = (fn) => async (...a) => {
    try { await fn(...a); } catch (e) { toast({ title: 'Something went wrong', body: errMsg(e) }); }
  };

  return (
    <div className="scroll-y h-full px-4 pb-4 pt-4">
      <h2 className="text-xl font-extrabold">Friends</h2>
      <div className="relative mt-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input !pl-10" placeholder="Search by username" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {q.trim().length >= 2 && (
        <section className="mt-4">
          <h3 className="mb-2 text-xs font-semibold text-slate-400">{searching ? 'Searching…' : `Results (${results.length})`}</h3>
          {!searching && results.length === 0 && <p className="text-sm text-slate-500">No one found with “{q}”.</p>}
          {results.map((u) => (
            <Row key={u._id} user={u}>
              {u.status === 'none' && <button className="btn-primary !px-3 !py-1.5" onClick={act(() => sendRequest(u._id))}><UserPlus size={15} /> Add</button>}
              {u.status === 'sent' && <span className="flex items-center gap-1 text-xs text-slate-400"><Clock size={14} /> Requested</span>}
              {u.status === 'received' && <button className="btn-primary !px-3 !py-1.5" onClick={act(() => acceptRequest(u.requestId))}><Check size={15} /> Accept</button>}
              {u.status === 'friend' && <span className="text-xs text-emerald-400">Friends</span>}
            </Row>
          ))}
        </section>
      )}

      {requests.incoming.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-xs font-semibold text-slate-400">Requests for you ({requests.incoming.length})</h3>
          {requests.incoming.map((r) => (
            <Row key={r._id} user={r.from}>
              <button className="icon-btn !h-9 !w-9 bg-emerald-500/15 text-emerald-300" onClick={act(() => acceptRequest(r._id))} aria-label="Accept"><Check size={16} /></button>
              <button className="icon-btn !h-9 !w-9 bg-rose-500/15 text-rose-300" onClick={act(() => removeRequest(r._id))} aria-label="Decline"><X size={16} /></button>
            </Row>
          ))}
        </section>
      )}

      {requests.outgoing.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-xs font-semibold text-slate-400">Sent</h3>
          {requests.outgoing.map((r) => (
            <Row key={r._id} user={r.to}>
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={act(() => removeRequest(r._id))}>Cancel</button>
            </Row>
          ))}
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-xs font-semibold text-slate-400">Your friends ({friends.length})</h3>
        {friends.length === 0 && <p className="text-sm text-slate-500">Nobody here yet. Search above to add someone.</p>}
        {friends.map((f) => (
          <Row key={f._id} user={f} status>
            <button className="icon-btn !h-9 !w-9" onClick={() => onOpenChat(f._id)} aria-label={`Message ${f.username}`}><MessageCircle size={17} /></button>
            <button
              className="icon-btn !h-9 !w-9 hover:text-rose-300"
              onClick={() => window.confirm(`Remove ${f.username} from your friends?`) && act(() => unfriend(f._id))()}
              aria-label={`Remove ${f.username}`}
            ><UserMinus size={17} /></button>
          </Row>
        ))}
      </section>
    </div>
  );
}

function Row({ user, status, children }) {
  return (
    <div className="mb-1 flex animate-rise items-center gap-3 rounded-2xl px-2 py-2 hover:bg-raised/50">
      <Avatar user={user} size={42} showStatus={status} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{user.username}</p>
        {user.bio && <p className="truncate text-xs text-slate-400">{user.bio}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}
