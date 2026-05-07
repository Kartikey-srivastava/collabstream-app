import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import ReactPlayer from 'react-player/youtube';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MonitorX } from 'lucide-react';

const socket = io(process.env.REACT_APP_BACKEND_URL || '/');

const Room = ({ roomId }) => {
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Video Sync State
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  const [urlInput, setUrlInput] = useState('');
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef(null);

  // Media Controls State
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const userVideo = useRef();
  const peersRef = useRef([]);
  const myStreamRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      myStreamRef.current = stream;
      if (userVideo.current) userVideo.current.srcObject = stream;

      socket.emit('join-room', roomId, socket.id);

      socket.on('user-connected', userId => {
        const peer = createPeer(userId, socket.id, stream);
        peersRef.current.push({ peerID: userId, peer });
        setPeers(users => [...users, peer]);
      });

      socket.on('user-joined', payload => {
        const peer = addPeer(payload.signal, payload.callerID, stream);
        peersRef.current.push({ peerID: payload.callerID, peer });
        setPeers(users => [...users, peer]);
      });

      socket.on('receiving-returned-signal', payload => {
        const item = peersRef.current.find(p => p.peerID === payload.id);
        if (item) item.peer.signal(payload.signal);
      });
    });

    socket.on('receive-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('sync-video-state', (data) => {
      if (data.type === 'url') setVideoUrl(data.payload);
      if (data.type === 'play') setPlaying(true);
      if (data.type === 'pause') setPlaying(false);
      if (data.type === 'seek' && playerRef.current) {
        playerRef.current.seekTo(data.payload, 'seconds');
      }
    });

    return () => socket.disconnect();
  }, [roomId]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on('signal', signal => socket.emit('signal', { userToSignal, callerID, signal }));
    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on('signal', signal => socket.emit('returning-signal', { signal, callerID }));
    peer.signal(incomingSignal);
    return peer;
  }

  // --- Media Control Handlers ---

  const toggleAudio = () => {
    if (myStreamRef.current) {
      const audioTrack = myStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (myStreamRef.current) {
      const videoTrack = myStreamRef.current.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        peersRef.current.forEach(peerObj => {
          const myVideoTrack = myStreamRef.current.getVideoTracks()[0];
          peerObj.peer.replaceTrack(myVideoTrack, screenTrack, myStreamRef.current);
        });

        userVideo.current.srcObject = screenStream;
        setIsScreenSharing(true);

        // Stop sharing when user clicks native "Stop sharing" browser button
        screenTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Error sharing screen", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    const myVideoTrack = myStreamRef.current.getVideoTracks()[0];
    peersRef.current.forEach(peerObj => {
      const currentTrack = userVideo.current.srcObject.getVideoTracks()[0];
      peerObj.peer.replaceTrack(currentTrack, myVideoTrack, myStreamRef.current);
    });
    userVideo.current.srcObject = myStreamRef.current;
    setIsScreenSharing(false);
  };

  // --- End Media Control Handlers ---

  const handleUrlChange = (e) => {
    e.preventDefault();
    setVideoUrl(urlInput);
    socket.emit('video-state-change', { type: 'url', payload: urlInput });
    setUrlInput('');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msgData = { text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    socket.emit('send-message', msgData);
    setMessages(prev => [...prev, { ...msgData, senderId: 'me' }]);
    setChatInput('');
  };

  return (
    <div className="flex h-screen p-4 gap-4 relative">
      <div className="flex-1 flex flex-col gap-4">
        <div className="glass-panel p-4 rounded-xl flex justify-between items-center">
          <h2 className="text-xl font-bold">Room: <span className="text-indigo-400">{roomId}</span></h2>
          <form onSubmit={handleUrlChange} className="flex gap-2 w-1/2">
            <input
              type="text" placeholder="Paste YouTube URL..."
              value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 p-2 rounded-lg bg-slate-800/50 border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
            />
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold neon-btn">Load</button>
          </form>
        </div>

        <div className="glass-panel flex-1 rounded-xl overflow-hidden relative shadow-2xl">
          <ReactPlayer
            ref={playerRef} url={videoUrl} playing={playing} controls={true} width="100%" height="100%"
            onPlay={() => socket.emit('video-state-change', { type: 'play' })}
            onPause={() => socket.emit('video-state-change', { type: 'pause' })}
            onSeek={(e) => socket.emit('video-state-change', { type: 'seek', payload: e })}
          />
        </div>

        <div className="h-40 flex gap-4 overflow-x-auto pb-2 relative">
          <div className="glass-panel min-w-[240px] rounded-xl overflow-hidden border-2 border-indigo-500/50 relative">
            <video muted ref={userVideo} autoPlay playsInline className="w-full h-full object-cover" />

            {/* --- Media Control Bar --- */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-3 bg-slate-900/80 p-2 rounded-full backdrop-blur-md">
              <button onClick={toggleAudio} className={`p-2 rounded-full transition-all ${isAudioMuted ? 'bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button onClick={toggleVideo} className={`p-2 rounded-full transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                {isVideoOff ? <VideoOff size={16} /> : <VideoIcon size={16} />}
              </button>
              <button onClick={toggleScreenShare} className={`p-2 rounded-full transition-all ${isScreenSharing ? 'bg-indigo-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                {isScreenSharing ? <MonitorX size={16} /> : <MonitorUp size={16} />}
              </button>
            </div>
            {/* --- End Media Control Bar --- */}

          </div>
          {peers.map((peer, index) => (
            <Video key={index} peer={peer} />
          ))}
        </div>
      </div>

      <div className="w-80 glass-panel rounded-xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 font-semibold">
          Live Chat
        </div>
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.senderId === 'me' ? 'bg-indigo-600/80 self-end rounded-tr-none' : 'bg-slate-700/80 self-start rounded-tl-none'}`}>
              <p className="break-words">{msg.text}</p>
              <span className="text-[10px] text-slate-300 block mt-1 text-right">{msg.time}</span>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="p-3 border-t border-slate-700/50 bg-slate-800/30 flex gap-2">
          <input
            type="text" placeholder="Type a message..."
            value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 p-2 rounded-lg bg-slate-900/50 border border-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
          />
          <button type="submit" className="p-2 bg-indigo-600 rounded-lg neon-btn">Send</button>
        </form>
      </div>
    </div>
  );
};

const Video = ({ peer }) => {
  const ref = useRef();
  useEffect(() => {
    peer.on('stream', stream => {
      ref.current.srcObject = stream;
    });
  }, [peer]);
  return (
    <div className="glass-panel min-w-[240px] rounded-xl overflow-hidden">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
    </div>
  );
};

export default Room;