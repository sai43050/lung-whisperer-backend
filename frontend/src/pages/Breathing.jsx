import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Play, Pause, RotateCcw, Info, Activity, ShieldCheck, Heart } from 'lucide-react';

const techniques = [
  {
    name: 'Box Breathing',
    benefit: 'Neutralizes high stress states',
    desc: 'Equal phases of inhale, hold, exhale, and hold. Used by elite athletes and Navy SEALs for peak cognitive control.',
    timing: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 },
    color: '#06b6d4'
  },
  {
    name: '4-7-8 Relax',
    benefit: 'Induces deep parasympathetic shift',
    desc: 'Known as a natural tranquilizer. This rhythmic pattern significantly reduces sympathetic nervous system arousal.',
    timing: { inhale: 4, hold1: 7, exhale: 8, hold2: 0 },
    color: '#8b5cf6'
  },
  {
    name: 'Diaphragmatic',
    benefit: 'Optimizes oxygen absorption',
    desc: 'Traditional belly breathing technique to engage the diaphragm and maximize alveolar ventilation.',
    timing: { inhale: 5, hold1: 2, exhale: 5, hold2: 0 },
    color: '#10b981'
  },
  {
    name: 'Pursed Lip',
    benefit: 'Airway diameter maintenance',
    desc: 'Therapeutic for obstructive conditions. Keeps airways open longer during the exhalation phase.',
    timing: { inhale: 2, hold1: 0, exhale: 4, hold2: 0 },
    color: '#f43f5e'
  },
  {
    name: 'Power Breath',
    benefit: 'Hyper-vitalization of cells',
    desc: 'Rapid rhythmic breathing to increase mitochondrial efficiency and alertness through controlled hyper-oxygenation.',
    timing: { inhale: 1, hold1: 0, exhale: 1, hold2: 0 },
    color: '#f59e0b'
  }
];

const Breathing = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState('READY');
  const [count, setCount] = useState(0);
  const [round, setRound] = useState(0);
  const [totalMins, setTotalMins] = useState(0);

  const currentEx = techniques[selectedIdx];

  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await getBreathingHistory();
      if (Array.isArray(data)) {
        setHistory(data);
        const total = data.reduce((acc, s) => acc + s.duration_minutes, 0);
        setTotalMins(total);
        const roundCount = data.reduce((acc, s) => acc + s.rounds, 0);
        setRound(roundCount);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveSession = async () => {
    if (round > 0) {
      try {
        // Calculate duration for the JUST completed session
        // We track session specific rounds and duration temporarily
        await logBreathingSession(currentEx.name, sessionRounds, sessionMins);
        fetchHistory(); // Refresh
      } catch (e) {
        console.error(e);
      }
    }
  };

  const [sessionRounds, setSessionRounds] = useState(0);
  const [sessionMins, setSessionMins] = useState(0);

  useEffect(() => {
    let isMounted = true;

    if (isActive) {
      setSessionRounds(0);
      setSessionMins(0);
      const runExercise = async () => {
        const { inhale, hold1, exhale, hold2 } = currentEx.timing;
        
        while (isActive && isMounted) {
          // Inhale
          setPhase('INHALE');
          for (let i = inhale; i > 0 && isActive; i--) {
            setCount(i);
            await new Promise(r => setTimeout(r, 1000));
          }
          if (!isActive) break;
          
          // Hold 1
          if (hold1 > 0) {
            setPhase('RETAIN');
            for (let i = hold1; i > 0 && isActive; i--) {
              setCount(i);
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          if (!isActive) break;
          
          // Exhale
          setPhase('EXHALE');
          for (let i = exhale; i > 0 && isActive; i--) {
            setCount(i);
            await new Promise(r => setTimeout(r, 1000));
          }
          if (!isActive) break;
          
          // Hold 2
          if (hold2 > 0) {
            setPhase('RETAIN');
            for (let i = hold2; i > 0 && isActive; i--) {
              setCount(i);
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          if (!isActive) break;
          
          setSessionRounds(r => r + 1);
          setSessionMins(m => m + (inhale + hold1 + exhale + hold2) / 60);
        }
      };
      runExercise();
    } else {
      if (sessionRounds > 0) {
         logBreathingSession(currentEx.name, sessionRounds, sessionMins).then(() => fetchHistory());
      }
      setPhase('READY');
      setCount(0);
    }
    return () => { isMounted = false; };
  }, [isActive, selectedIdx]);

  return (
    <div className="space-y-6 pt-6 max-w-5xl mx-auto pb-24 relative z-10 px-4">
      {/* Background Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 sm:p-12 rounded-[3rem] border-white/5 shadow-2xl overflow-hidden relative"
      >
        {/* Top Glow Bar */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Wind size={14} className="text-emerald-400" />
               </div>
               <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Respiratory Optimization</span>
            </div>
            <h1 className="text-4xl font-display font-black text-white tracking-tight">Lung <span className="text-gradient-cyan">Therapy</span></h1>
            <p className="text-slate-400 mt-2 font-light max-w-sm">
               Neuro-respiratory exercises designed to stabilize heart rate variability.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5">
             <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Sync active</span>
             </div>
             <div className="flex items-center gap-2 px-3">
                <ShieldCheck size={16} className="text-cyan-400" />
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Clinical Grade</span>
             </div>
          </div>
        </div>

        {/* Technique Picker */}
        <div className="flex gap-3 overflow-x-auto pb-6 custom-scrollbar no-scrollbar mb-10">
          {techniques.map((ex, idx) => (
            <button
              key={ex.name}
              onClick={() => { setSelectedIdx(idx); setIsActive(false); }}
              className={`flex-shrink-0 px-6 py-3.5 rounded-2xl text-xs font-bold border transition-all duration-500 relative overflow-hidden group ${
                selectedIdx === idx 
                  ? 'text-white border-transparent' 
                  : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="relative z-10">{ex.name}</span>
              {selectedIdx === idx && (
                <motion.div 
                  layoutId="active-tab"
                  className="absolute inset-0 z-0"
                  style={{ background: `linear-gradient(135deg, ${ex.color}, ${ex.color}99)` }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Info Side */}
          <div className="lg:col-span-12 xl:col-span-5 space-y-8 order-2 xl:order-1">
             <div className="glass-card p-8 rounded-[2rem] border-white/5">
                <h3 className="text-2xl font-display font-black text-white mb-4 uppercase tracking-tight">{currentEx.name}</h3>
                <div className="flex items-center gap-3 mb-6 p-3 rounded-2xl bg-white/5 border border-white/5">
                   <div className="p-2 rounded-xl" style={{ background: `${currentEx.color}20`, border: `1px solid ${currentEx.color}40`, color: currentEx.color }}>
                      <Activity size={18} />
                   </div>
                   <p className="text-sm font-bold text-slate-200">{currentEx.benefit}</p>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed font-light mb-8">
                  {currentEx.desc}
                </p>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                  {[
                    { label: 'Session Rounds', val: round, icon: RotateCcw, color: 'cyan' },
                    { label: 'Target Mins', val: totalMins.toFixed(1), icon: Wind, color: 'violet' },
                    { label: 'Weekly Score', val: Math.min(1000, Math.floor(totalMins * 10)).toString(), icon: TrendingUp, color: 'emerald' }
                  ].map((s, i) => (
                    <div key={i} className="text-center">
                       <div className="text-2xl font-display font-black text-white">{s.val}</div>
                       <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">{s.label.split(' ')[1]}</div>
                    </div>
                  ))}
                </div>
             </div>

             <div className="flex flex-wrap gap-3">
                {Object.entries(currentEx.timing).map(([k, v]) => (
                  v > 0 && (
                    <div key={k} className="flex-1 min-w-[100px] p-4 rounded-2xl bg-black/40 border border-white/5 text-center">
                       <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">{k.replace(/[0-9]/g, '')}</div>
                       <div className="text-white font-display font-black text-xl">{v}s</div>
                    </div>
                  )
                ))}
             </div>
          </div>

          {/* Animation Circle Side */}
          <div className="lg:col-span-12 xl:col-span-7 flex flex-col items-center justify-center order-1 xl:order-2">
            <div className="relative w-80 h-80 flex items-center justify-center">
              
              {/* Complex Background Rings */}
              <div className="absolute inset-0 rounded-full border border-white/5" />
              <div className="absolute inset-[15%] rounded-full border border-white/5" />
              
              <AnimatePresence>
                {isActive && (
                  <>
                    {/* Primary Pulsing Pulse */}
                    <motion.div 
                      key="pulse-outer"
                      className="absolute rounded-full border border-cyan-400/20"
                      initial={{ width: '40%', height: '40%', opacity: 0 }}
                      animate={{ 
                        width: phase === 'INHALE' ? '120%' : phase === 'EXHALE' ? '40%' : '100%',
                        height: phase === 'INHALE' ? '120%' : phase === 'EXHALE' ? '40%' : '100%',
                        opacity: [0.1, 0.4, 0.1],
                      }}
                      transition={{ 
                        duration: phase === 'INHALE' ? currentEx.timing.inhale : phase === 'EXHALE' ? currentEx.timing.exhale : 2,
                        ease: "easeInOut"
                      }}
                    />
                    
                    {/* Ring 2 - lagging */}
                    <motion.div 
                      key="pulse-mid"
                      className="absolute rounded-full border border-violet-400/20"
                      initial={{ width: '40%', height: '40%', opacity: 0 }}
                      animate={{ 
                        width: phase === 'INHALE' ? '140%' : phase === 'EXHALE' ? '40%' : '110%',
                        height: phase === 'INHALE' ? '140%' : phase === 'EXHALE' ? '40%' : '110%',
                        opacity: [0.05, 0.2, 0.05],
                      }}
                      transition={{ 
                        duration: (phase === 'INHALE' ? currentEx.timing.inhale : phase === 'EXHALE' ? currentEx.timing.exhale : 2) + 0.5,
                        ease: "easeOut"
                      }}
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Main Breathing Focal Point */}
              <motion.div 
                onClick={() => setIsActive(!isActive)}
                className={`w-56 h-56 rounded-full flex flex-col items-center justify-center cursor-pointer relative z-10 transition-all duration-1000 ${
                  isActive 
                    ? 'shadow-[0_0_80px_rgba(6,182,212,0.15)] overflow-hidden' 
                    : 'bg-black/60 border border-white/10 hover:border-cyan-500/40 hover:bg-white/5'
                }`}
                animate={{
                  scale: phase === 'INHALE' ? 1.4 : phase === 'EXHALE' ? 1 : 1.3,
                  borderColor: isActive ? `${currentEx.color}40` : 'rgba(255,255,255,0.1)',
                  background: isActive ? `${currentEx.color}10` : 'rgba(0,0,0,0.6)'
                }}
                transition={{ 
                  duration: phase === 'INHALE' ? currentEx.timing.inhale : phase === 'EXHALE' ? currentEx.timing.exhale : 1,
                  ease: "easeInOut"
                }}
              >
                {/* Internal HUD bars */}
                {isActive && (
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                     <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />
                     <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                  </div>
                )}

                <AnimatePresence mode="wait">
                  <motion.div 
                    key={phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center"
                  >
                     <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.4em] mb-2">{phase}</span>
                     <div className="text-6xl font-display font-black text-white mb-2 tabular-nums drop-shadow-2xl">
                        {count > 0 ? count : (!isActive ? <Play size={48} className="text-white fill-white ml-2" /> : <div className="p-4 rounded-full border border-white/20 animate-spin" />)}
                     </div>
                     {isActive && <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest font-bold">seconds remaining</span>}
                  </motion.div>
                </AnimatePresence>
                
                {/* Pulse Ring */}
                {isActive && (
                   <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-ping opacity-10" />
                )}
              </motion.div>

              {/* Orbital Icon */}
              {!isActive && (
                <div className="absolute bottom-4 right-4 animate-float">
                   <div className="p-3 rounded-2xl bg-black/80 border border-white/10 shadow-2xl">
                      <Heart size={20} className="text-rose-500 animate-pulse" />
                   </div>
                </div>
              )}
            </div>

            <div className="mt-12 text-center">
               <button 
                  onClick={() => setIsActive(!isActive)}
                  className={`px-12 py-4 rounded-full font-display font-black text-sm uppercase tracking-widest transition-all duration-500 ${
                    isActive 
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' 
                      : 'btn-primary'
                  }`}
               >
                  {isActive ? 'Cease Session' : 'Initiate Session'}
               </button>
            </div>
          </div>
        </div>

      </motion.div>

      {/* Advisory Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
         <div className="glass-card p-6 rounded-[2rem] border-white/5 flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
               <Info size={18} />
            </div>
            <div>
               <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-tight">Postural Guidance</h4>
               <p className="text-slate-500 text-xs font-light leading-relaxed">
                  For optimal lung expandability, sit upright with shoulders relaxed and back aligned. Ensure deep abdominal descent during inhalation.
               </p>
            </div>
         </div>
         <div className="glass-card p-6 rounded-[2rem] border-white/5 flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
               <Activity size={18} />
            </div>
            <div>
               <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-tight">Biological Response</h4>
               <p className="text-slate-500 text-xs font-light leading-relaxed">
                  These exercises modulate the Vagus nerve, effectively lowering the cortisol response within 2-3 minutes of continuous execution.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Breathing;

function TrendingUp(props) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
