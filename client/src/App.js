import React, { useState } from 'react';
import Room from './Room';

function App() {
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    setRoomId(newRoomId);
    setInRoom(true);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) setInRoom(true);
  };

  if (inRoom) return <Room roomId={roomId} />;

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="glass-panel p-8 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">CollabStream</h1>
        <button onClick={createRoom} className="w-full mb-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold neon-btn">Create New Room</button>
        <div className="flex items-center justify-center space-x-2 mb-6">
          <hr className="w-full border-slate-600" /><span className="text-slate-400 text-sm">OR</span><hr className="w-full border-slate-600" />
        </div>
        <form onSubmit={joinRoom} className="flex flex-col gap-4">
          <input type="text" placeholder="Enter Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full p-3 rounded-lg bg-slate-800/50 border border-slate-600 focus:outline-none focus:border-indigo-500 text-white" />
          <button type="submit" className="w-full py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold neon-btn">Join Room</button>
        </form>
      </div>
    </div>
  );
}
export default App;
