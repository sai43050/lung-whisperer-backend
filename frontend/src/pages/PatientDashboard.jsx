import React, { useEffect, useState, useRef } from 'react';
import { simulateVitals, getVitalsHistory, sendAIChatMessage } from '../api';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Heart, Activity, Wind, AlertTriangle, ShieldCheck, MessageCircle, Send, X, Zap, TrendingUp, Mic, Bluetooth, BluetoothConnected, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

const VitalsCard = ({ title, value, unit, icon: Icon, accentColor, glowColor, borderColor, status }) => {
  const isAlert = status === 'alert';
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="relative p-6 rounded-2xl overflow-hidden"
      style={{
        background: isAlert
          ? 'linear-gradient(135deg, rgba(251,113,133,0.08) 0%, rgba(13,26,45,0.5) 100%)'
          : 'linear-gradient(135deg, rgba(13,26,45,0.6) 0%, rgba(7,13,26,0.5) 100%)',
        border: `1px solid ${isAlert ? 'rgba(251,113,133,0.3)' : borderColor}`,
        backdropFilter: 'blur(20px)',
        boxShadow: isAlert
          ? '0 0 25px rgba(251,113,133,0.2)'
          : `0 0 25px ${glowColor}`,
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {/* Background icon */}
      <div className="absolute -right-3 -bottom-3 opacity-5">
        <Icon size={80} />
      </div>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs font-mono font-semibold mb-2 uppercase tracking-widest">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-display font-black text-white">{value}</span>
            <span className="text-slate-500 text-xs font-mono uppercase ml-1">{unit}</span>
          </div>
        </div>
        <div
          className="p-3 rounded-xl flex-shrink-0"
          style={{
            background: `rgba(${accentColor.match(/\d+/g)?.slice(0,3).join(',')}, 0.12)`,
            border: `1px solid ${borderColor}`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
      </div>

      {isAlert && (
        <div className="mt-3 flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
          <AlertTriangle size={12} />
          <span>Alert threshold exceeded</span>
        </div>
      )}
    </motion.div>
  );
};

const CustomTooltip = ({ active, payload, label, color }) => {
  if (active && payload && payload.length) {
    return (
      <div className="px-3 py-2 rounded-xl text-xs font-mono"
        style={{
          background: 'rgba(3,7,18,0.95)',
          border: `1px solid ${color}40`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <p className="text-slate-500 mb-1">{label}</p>
        <p className="font-bold" style={{ color }}>{payload[0]?.value}</p>
      </div>
    );
  }
  return null;
};

const PatientDashboard = ({ user }) => {
  const [vitals, setVitals] = useState({ spo2: 98, respiratory_rate: 16, heart_rate: 75 });
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('Normal');
  const [recommendation, setRecommendation] = useState('Normal condition');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const intervalRef = useRef(null);
  const dataPushRef = useRef(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{
    sender: 'ai',
    text: `Hello ${user?.full_name || user?.username || 'there'}! I am RespiraBot, your AI health assistant. How can I help you today?`
  }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchHistory = async () => {
    if (!user?.user_id) return;
    try {
      const data = await getVitalsHistory(user.user_id);
      if (Array.isArray(data)) {
        const formatted = data.map(d => ({
          time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          spo2: d.spo2,
          heart_rate: d.heart_rate,
          respiratory_rate: d.respiratory_rate
        })).slice(-15);
        setHistory(formatted);
      }
    } catch (err) { 
      console.error(err);
      showToast("Unable to fetch vitals history. Check your connection.", "error");
    }
  };

  useEffect(() => { 
    if (user?.user_id) {
      fetchHistory(); 
    }
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const generateRandomVitals = (prev) => {
    const noise = (val, maxDelta, min, max) => {
      let next = val + (Math.random() * maxDelta * 2 - maxDelta);
      return parseFloat(Math.min(Math.max(next, min), max).toFixed(1));
    };
    return {
      spo2: noise(prev.spo2, 1, 85, 100),
      heart_rate: noise(prev.heart_rate, 3, 50, 140),
      respiratory_rate: noise(prev.respiratory_rate, 1, 10, 35)
    };
  };

  const triggerVitalsUpdate = async (forcedValues = null) => {
    try {
      let payload;
      if (forcedValues) {
        payload = forcedValues;
      } else {
        setVitals(prev => {
          // If bluetooth is active, we only randomize the non-connected ones (SpO2, RR)
          const base = bluetoothDevice ? { ...prev } : generateRandomVitals(prev);
          payload = bluetoothDevice ? {
            ...base,
            spo2: generateRandomVitals(prev).spo2,
            respiratory_rate: generateRandomVitals(prev).respiratory_rate
          } : base;
          return payload;
        });
      }
      
      const res = await simulateVitals(user?.user_id || 'guest', payload.spo2, payload.respiratory_rate, payload.heart_rate);
      setStatus(res.health_status);
      setRecommendation(res.recommendation);
      setVitals(payload);
      fetchHistory();
      
      if (res.health_status === 'Critical') {
        showToast("CRITICAL ALERT: Abnormal vitals detected!", "error");
      }
    } catch (err) { 
      console.error("Vitals update error", err);
    }
  };

  // --- Bluetooth Integration ---
  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      showToast("Bluetooth not supported in this browser.", "error");
      return;
    }

    try {
      setIsConnecting(true);
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service']
      });

      device.addEventListener('gattserverdisconnected', onDisconnected);
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      const characteristic = await service.getCharacteristic('heart_rate_measurement');

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleHeartRateChanged);

      setBluetoothDevice(device);
      setIsSimulating(true); // Auto-start data flow
      showToast(`Connected to ${device.name}. AccuVital™ Sync Active.`, "success");
      
      // Start regular persistence push
      if (dataPushRef.current) clearInterval(dataPushRef.current);
      dataPushRef.current = setInterval(() => triggerVitalsUpdate(), 10000);

    } catch (error) {
      console.error("Bluetooth Error:", error);
      if (error.name !== 'NotFoundError') {
         showToast("Sync command failed. Ensure device remains in range.", "error");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleHeartRateChanged = (event) => {
    const value = event.target.value;
    let flags = value.getUint8(0);
    let hrValue;
    if (flags & 0x01) hrValue = value.getUint16(1, true);
    else hrValue = value.getUint8(1);
    
    setVitals(prev => ({ ...prev, heart_rate: hrValue }));
  };

  const onDisconnected = () => {
    setBluetoothDevice(null);
    if (dataPushRef.current) clearInterval(dataPushRef.current);
    showToast("Wearable disconnected. Switching to internal bio-simulation.", "warning");
  };

  const toggleSimulation = () => {
    if (isSimulating) {
      clearInterval(intervalRef.current);
      if (dataPushRef.current) clearInterval(dataPushRef.current);
      if (bluetoothDevice) bluetoothDevice.gatt.disconnect();
    } else {
      intervalRef.current = setInterval(() => triggerVitalsUpdate(), 4000);
    }
    setIsSimulating(!isSimulating);
  };

  const forceEmergency = () => triggerVitalsUpdate({ spo2: 88, heart_rate: 125, respiratory_rate: 32 });

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg = { sender: 'user', text: chatInput };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const data = await sendAIChatMessage(newMsg.text);
      setChatMessages(prev => [...prev, { sender: 'ai', text: data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { sender: 'ai', text: "Sorry, my connection dropped. Try again." }]);
    } finally { setChatLoading(false); }
  };

  const statusConfig = {
    Normal: {
      bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.3)',
      color: '#34d399', label: 'All Systems Normal', icon: ShieldCheck, glow: 'rgba(52,211,153,0.2)'
    },
    Warning: {
      bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)',
      color: '#fbbf24', label: 'Warning Detected', icon: AlertTriangle, glow: 'rgba(251,191,36,0.2)'
    },
    Critical: {
      bg: 'rgba(251,113,133,0.08)', border: 'rgba(251,113,133,0.3)',
      color: '#fb7185', label: 'Critical Alert', icon: AlertTriangle, glow: 'rgba(251,113,133,0.2)'
    },
  };
  const cfg = statusConfig[status] || statusConfig.Normal;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-5 relative z-10 pt-4">

      {/* Header */}
      <div
        className="p-6 rounded-3xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(13,26,45,0.7) 0%, rgba(7,13,26,0.6) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Accent line */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), rgba(139,92,246,0.6), transparent)' }} />

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-black text-white tracking-tight">
              Welcome back,{' '}
              <span className="text-gradient capitalize">{user?.full_name || user?.username || 'Patient'}</span>
            </h1>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-mono mt-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
              </span>
              <span>Real-time medical analysis active</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={connectBluetooth}
              disabled={isConnecting}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 ${
                bluetoothDevice 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {isConnecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : bluetoothDevice ? (
                <BluetoothConnected size={14} />
              ) : (
                <Bluetooth size={14} />
              )}
              {bluetoothDevice ? 'Sync Active' : isConnecting ? 'Searching...' : 'Connect Wearable'}
            </button>
            <button
              onClick={toggleSimulation}
              className="px-5 py-2 text-white text-xs font-bold rounded-xl transition-all duration-300"
              style={{
                background: isSimulating
                  ? 'linear-gradient(135deg, rgba(251,113,133,0.6), rgba(251,113,133,0.4))'
                  : 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
                boxShadow: isSimulating ? '0 0 15px rgba(251,113,133,0.3)' : '0 0 20px rgba(6,182,212,0.35)',
              }}
            >
              {isSimulating ? '⬛ Stop Tracker' : '▶ Start Bio-Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <motion.div
        layout
        className="p-4 rounded-2xl flex items-center justify-between"
        style={{
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          boxShadow: `0 0 20px ${cfg.glow}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <StatusIcon className="w-5 h-5" style={{ color: cfg.color }} />
          <span className="font-display font-bold text-base uppercase tracking-widest" style={{ color: cfg.color }}>
            AI Assessment: {cfg.label}
          </span>
        </div>
        <div className="text-xs font-mono px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: cfg.color }}>
          {recommendation}
        </div>
      </motion.div>

      {/* Vitals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <VitalsCard
          title="Oxygen Saturation"
          value={vitals.spo2}
          unit="%"
          icon={Activity}
          accentColor="#22d3ee"
          glowColor="rgba(6,182,212,0.15)"
          borderColor="rgba(6,182,212,0.2)"
          status={vitals.spo2 < 95 ? 'alert' : 'normal'}
        />
        <VitalsCard
          title="Heart Rate"
          value={Math.round(vitals.heart_rate)}
          unit="bpm"
          icon={Heart}
          accentColor="#fb7185"
          glowColor="rgba(251,113,133,0.12)"
          borderColor="rgba(251,113,133,0.18)"
          status={vitals.heart_rate > 100 || vitals.heart_rate < 50 ? 'alert' : 'normal'}
        />
        <VitalsCard
          title="Respiratory Rate"
          value={Math.round(vitals.respiratory_rate)}
          unit="/min"
          icon={Wind}
          accentColor="#a78bfa"
          glowColor="rgba(139,92,246,0.12)"
          borderColor="rgba(139,92,246,0.18)"
          status={vitals.respiratory_rate > 24 ? 'alert' : 'normal'}
        />
      </div>

      {/* Quick Analysis Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          whileHover={{ y: -4 }}
          className="p-6 rounded-2xl flex flex-col justify-between group cursor-pointer overflow-hidden relative"
          onClick={() => navigate('/upload')}
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(13,26,45,0.6) 100%)',
            border: '1px solid rgba(6,182,212,0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap size={100} className="text-cyan-400" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  < Zap size={20} />
               </div>
               <h3 className="font-display font-bold text-white uppercase tracking-tight">Vision Intelligence</h3>
            </div>
            <p className="text-slate-400 text-xs mb-6 font-light leading-relaxed">Analyze chest radiology with neural heatmaps for clinical triage.</p>
            <span className="text-cyan-400 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1">Launch X-Ray Hub →</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="p-6 rounded-2xl flex flex-col justify-between group cursor-pointer overflow-hidden relative"
          onClick={() => navigate('/upload-audio')}
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(13,26,45,0.6) 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Mic size={100} className="text-violet-400" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <Activity size={20} />
               </div>
               <h3 className="font-display font-bold text-white uppercase tracking-tight">Bio-Acoustic Hub</h3>
            </div>
            <p className="text-slate-400 text-xs mb-6 font-light leading-relaxed">Neural analysis of cough biomarkers and spectral sound patterns.</p>
            <span className="text-violet-400 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1">Launch Cough AI →</span>
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { key: 'spo2', label: 'SpO₂ Trend', unit: '%', color: '#22d3ee', domain: [85, 100] },
          { key: 'heart_rate', label: 'Heart Rate Trend', unit: 'BPM', color: '#fb7185', domain: ['auto', 'auto'] },
        ].map(chart => (
          <div
            key={chart.key}
            className="p-5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(13,26,45,0.6) 0%, rgba(7,13,26,0.5) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-white text-sm tracking-wide">{chart.label}</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md"
                style={{ background: `${chart.color}15`, color: chart.color, border: `1px solid ${chart.color}30` }}>
                {chart.unit}
              </span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chart.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.5)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis domain={chart.domain} tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.5)', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<CustomTooltip color={chart.color} />} />
                  <Area type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2.5}
                    isAnimationActive={false}
                    fill={`url(#grad-${chart.key})`} dot={false} activeDot={{ r: 5, fill: chart.color, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Chatbot */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isChatOpen ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-80 sm:w-[380px] rounded-3xl flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(10,18,35,0.97), rgba(3,7,18,0.98))',
                border: '1px solid rgba(6,182,212,0.2)',
                boxShadow: '0 0 40px rgba(6,182,212,0.15), 0 30px 60px rgba(0,0,0,0.7)',
                backdropFilter: 'blur(40px)',
              }}
            >
              {/* Chat Header */}
              <div className="p-4 flex justify-between items-center"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg" style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.25)' }}>
                    <Activity size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-white text-sm">RespiraBot</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">AI Active</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)}
                  className="text-slate-600 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5 transition-all">
                  <X size={16} />
                </button>
              </div>

              {/* Messages */}
              <div className="h-[320px] overflow-y-auto p-4 custom-scrollbar space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[82%] px-4 py-3 rounded-2xl text-xs leading-relaxed"
                      style={msg.sender === 'user' ? {
                        background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                        color: 'white',
                        borderBottomRightRadius: '4px',
                        boxShadow: '0 4px 12px rgba(6,182,212,0.25)',
                      } : {
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: 'rgba(226,232,240,0.9)',
                        borderBottomLeftRadius: '4px',
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl flex gap-1.5 items-center"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderBottomLeftRadius: '4px' }}>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <span key={i} className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleChatSubmit}
                className="p-3 flex gap-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="input-dark flex-grow px-4 py-2.5 text-xs"
                  placeholder="Ask a health question..."
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-2.5 rounded-xl disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', boxShadow: '0 0 15px rgba(6,182,212,0.3)' }}
                >
                  <Send size={15} className="text-white" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.button
              key="fab"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsChatOpen(true)}
              className="flex items-center justify-center gap-3 text-white rounded-full shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                boxShadow: '0 0 30px rgba(6,182,212,0.45)',
                padding: '1rem 1.5rem',
              }}
            >
              <MessageCircle size={22} />
              <span className="font-display font-bold text-sm hidden sm:inline">RespiraBot</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PatientDashboard;
