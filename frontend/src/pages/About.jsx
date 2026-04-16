import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Code, Server, Brain, HeartPulse, Wind, Mic, Radio, Wifi, ShieldCheck, Zap, Globe, Cpu } from 'lucide-react';

const techStack = [
  {
    icon: Code,
    title: 'Frontend Architecture',
    color: 'text-cyan-400',
    glow: 'rgba(6,182,212,0.3)',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    items: ['React 18 + Vite', 'Tailwind CSS', 'Framer Motion', 'Recharts'],
  },
  {
    icon: Server,
    title: 'Backend Core',
    color: 'text-indigo-400',
    glow: 'rgba(99,102,241,0.3)',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    items: ['FastAPI (Python)', 'SQLAlchemy + SQLite', 'Socket.IO (WebRTC)', 'JWT Authentication'],
  },
  {
    icon: Brain,
    title: 'Neural Engine',
    color: 'text-violet-400',
    glow: 'rgba(139,92,246,0.3)',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    items: ['TorchXRayVision DenseNet', 'ResNet-18 Audio Model', 'GradCAM Visualization', 'Google Gemini LLM'],
  },
  {
    icon: Wifi,
    title: 'Cloud Infrastructure',
    color: 'text-emerald-400',
    glow: 'rgba(16,185,129,0.3)',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    items: ['Docker Operations', 'Railway Deployment', 'Vercel Edge Scaling', 'Real-time API Linkage'],
  },
];

const features = [
  { icon: HeartPulse, title: 'Bio-Telemetry', desc: 'Real-time SpO2, BPM, and respiratory simulation with automated clinical triage.' },
  { icon: Wind, title: 'AI Radiography', desc: 'DenseNet-121 architecture trained on NIH datasets for immediate pathology detection.' },
  { icon: Mic, title: 'Acoustic Intelligence', desc: 'Deep learning classification of cough biomarkers for symptomatic identification.' },
  { icon: Brain, title: 'LLM Reports', desc: 'Context-aware clinical summaries synthesized via Google Gemini from archival data.' },
  { icon: Radio, title: 'WebRTC P2P', desc: 'Military-grade encrypted video consultation channel via Socket.IO signaling.' },
  { icon: ShieldCheck, title: 'Vault Security', desc: 'RBAC with JWT-based sessions, ensuring high-integrity medical data persistence.' },
];

export default function About() {
  return (
    <div className="max-w-6xl mx-auto pt-6 pb-24 space-y-12 relative z-10 px-4">
      
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-10 md:p-16 rounded-[4rem] border-white/5 text-center relative overflow-hidden group"
      >
        {/* Animated Background Pulse */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-40 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-1000" />
        
        <div className="relative z-10">
            <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Neural Protocol v4.1 (Advanced)</span>

          <h1 className="text-5xl md:text-7xl font-display font-black text-white mb-6 tracking-tight leading-none">
            Digital <span className="text-gradient-cyan">Respiratory</span> AI
          </h1>
          <p className="text-slate-400 text-lg md:text-xl font-light leading-relaxed max-w-3xl mx-auto italic">
            "A high-fidelity, multi-modal diagnostic ecosystem bridging the gap between deep learning and clinical application."
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
             {[
               { icon: Zap, label: 'Instant Diagnosis' },
               { icon: Globe, label: 'P2P Networking' },
               { icon: Cpu, label: 'Edge Computing' }
             ].map(badge => (
               <div key={badge.label} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-black/40 border border-white/5 group-hover:border-white/10 transition-all">
                  <badge.icon size={14} className="text-cyan-400" />
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">{badge.label}</span>
               </div>
             ))}
          </div>
        </div>
      </motion.div>

      {/* Tech Stack Grid */}
      <div>
        <div className="flex items-center gap-3 mb-10 px-4">
           <div className="w-10 h-1 rounded-full bg-cyan-500 shadow-[0_0_10px_#22d3ee]" />
           <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">System Architecture</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {techStack.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className={`glass-card p-8 rounded-[2.5rem] border ${t.border} relative overflow-hidden group`}
              >
                <div className={`absolute inset-0 bg-shimmer opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity`} />
                
                <div className={`p-4 rounded-2xl ${t.bg} mb-6 border ${t.border} w-fit shadow-2xl transition-transform group-hover:rotate-12`}>
                  <Icon size={24} className={t.color} />
                </div>
                
                <h3 className={`font-display font-black text-sm uppercase tracking-widest mb-4 ${t.color}`}>{t.title}</h3>
                
                <ul className="space-y-3">
                  {t.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-xs text-slate-400 font-light group-hover:text-slate-200 transition-colors">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0`} style={{ background: t.color, boxShadow: `0 0 8px ${t.glow}` }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Capabilities Section */}
      <div className="pt-8">
        <div className="flex items-center gap-3 mb-10 px-4">
           <div className="w-10 h-1 rounded-full bg-violet-500 shadow-[0_0_10px_#8b5cf6]" />
           <h2 className="text-3xl font-display font-black text-white uppercase tracking-tight">Neural Capabilities</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="glass-card p-8 rounded-[2.5rem] border-white/5 hover:border-white/10 group transition-all"
              >
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 inline-flex mb-6 group-hover:border-cyan-500/40 transition-all group-hover:bg-cyan-500/10">
                  <Icon size={22} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-display font-black text-lg text-white mb-3 uppercase tracking-tighter group-hover:text-cyan-300 transition-colors">
                   {f.title}
                </h3>
                <p className="text-slate-500 text-xs font-light leading-relaxed group-hover:text-slate-400 transition-colors">
                   {f.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Clinical Disclaimer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="glass-panel p-8 rounded-[3rem] border border-amber-500/20 bg-amber-500/5 relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10 text-center md:text-left">
           <div className="p-4 bg-amber-500 rounded-full shadow-2xl shadow-amber-950/40">
              <ShieldCheck className="text-amber-950" size={32} />
           </div>
           <div>
              <h4 className="text-lg font-display font-black text-amber-500 uppercase tracking-widest mb-1">Clinical Safeguard Protocol</h4>
              <p className="text-amber-100/60 text-[11px] font-light leading-relaxed max-w-4xl italic">
                 Lung Whisperer is an AI-assisted research and triage facilitator. All data outputs are preliminary and must be verified by a board-certified medical professional prior to clinical intervention. 
                 The system serves to augment, not replace, professional medical judgement.
              </p>
           </div>
        </div>
      </motion.div>
      
      {/* Visual Ticker */}
      <div className="pt-8 text-center opacity-30">
         <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.5em]">
            Precision Healthcare Architecture • Open Source Core • HIPAA Ready
         </span>
      </div>
    </div>
  );
}
