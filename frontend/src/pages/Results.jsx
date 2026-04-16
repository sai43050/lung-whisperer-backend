import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, Microscope, Stethoscope, Lightbulb, ScanLine, Loader2, Share2, Download, ShieldCheck, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getScanResult } from '../api';

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const stateResult = location.state?.result;
    if (stateResult) {
      setResult(stateResult);
      setLoading(false);
      return;
    }
    if (id) {
      getScanResult(id)
        .then(data => {
          setResult(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch scan:", err);
          setError("Could not load scan result. It may have been deleted or you may not have permission.");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative mb-8">
           <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full animate-pulse" />
           <Loader2 className="h-16 w-16 text-cyan-400 animate-spin relative z-10" />
        </div>
        <h2 className="text-xl font-display font-bold text-white mb-2">Generating Neural Report</h2>
        <p className="text-slate-500 text-sm font-mono uppercase tracking-[0.3em] animate-pulse">Analyzing Biomarkers...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="text-center py-20 flex flex-col items-center relative z-10 px-4">
        <div className="bg-rose-500/10 p-8 rounded-[2rem] border border-rose-500/20 mb-8 blur-none shadow-2xl">
          <AlertCircle className="h-20 w-20 text-rose-400" />
        </div>
        <h2 className="text-3xl font-display font-black text-white mb-4 tracking-tight">Access Denied / Not Found</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-10 font-light">
          {error || "We couldn't retrieve the diagnosis data for this record."}
        </p>
        <button
          onClick={() => navigate('/upload')}
          className="btn-primary px-10 py-4"
        >
          Return to Analysis Center
        </button>
      </div>
    );
  }

  const rawPrediction = result.prediction || "Unknown Result";
  const isAudio = typeof rawPrediction === 'string' && rawPrediction.startsWith("COUGH: ");
  const predictionText = typeof rawPrediction === 'string' 
    ? rawPrediction.replace("X-RAY: ", "").replace("COUGH: ", "")
    : "Analysis Complete";
  const isNormal = predictionText.toLowerCase().includes('normal') || predictionText.toLowerCase().includes('healthy');

  const accentColor = isNormal ? 'cyan' : 'rose';
  const accentHex = isNormal ? '#22d3ee' : '#fb7185';
  
  const findings = result.findings || [];
  const suggestions = result.suggestions || [];

  return (
    <div className="max-w-6xl mx-auto pt-6 pb-24 relative z-10 px-4 space-y-6">
      {/* Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2">
        <button
          onClick={() => navigate(isAudio ? '/upload-audio' : '/upload')}
          className="flex items-center text-slate-400 hover:text-white transition-all gap-2 group px-4 py-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5"
        >
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-wider font-mono">Back to Scan</span>
        </button>
        
        <div className="flex gap-3">
           <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
              <Share2 size={16} />
           </button>
           <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
              <Download size={16} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Visual Analysis */}
        <div className="xl:col-span-7 space-y-6">
          {/* Main Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-8 rounded-[2.5rem] relative overflow-hidden"
          >
            {/* Header Accent */}
            <div className={`absolute top-0 left-0 right-0 h-1.5`}
              style={{ background: `linear-gradient(90deg, ${accentHex}, transparent)` }} />
            
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`p-5 rounded-[1.5rem] shadow-2xl relative`}
                  style={{ background: `${accentHex}15`, border: `1px solid ${accentHex}30` }}>
                   <div className={`absolute inset-0 blur-xl opacity-20`} style={{ background: accentHex }} />
                   {isNormal
                    ? <CheckCircle2 className="h-10 w-10 text-cyan-400 relative z-10" />
                    : <AlertCircle className="h-10 w-10 text-rose-400 relative z-10" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                      Diagnosis Result • ID: #{String(result.id).padStart(5, '0')}
                    </span>
                    <div className="flex px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-mono text-emerald-400 uppercase">
                       Verified
                    </div>
                  </div>
                  <h1 className="text-4xl font-display font-black text-white tracking-tight leading-none mb-1">
                    {predictionText}
                  </h1>
                  <p className="text-slate-400 text-xs font-medium tracking-wide">
                    Neural Sequence Analyzed on {new Date(result.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="text-right sm:text-right w-full sm:w-auto">
                 <div className="inline-block px-4 py-2 rounded-2xl bg-black/40 border border-white/5">
                    <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1 text-center">Confidence Score</div>
                    <div className={`text-3xl font-display font-black text-center`} style={{ color: accentHex }}>
                       {result.confidence}%
                    </div>
                 </div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="mt-10">
               <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={`h-full rounded-full shadow-[0_0_15px_rgba(34,211,238,0.4)]`}
                    style={{ background: `linear-gradient(90deg, ${accentHex}, #8b5cf6)` }}
                  />
               </div>
            </div>
          </motion.div>

          {/* Visualization Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel p-6 rounded-[2.5rem] relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6 px-2">
               <h3 className="font-display font-black text-white flex items-center gap-3 text-lg uppercase tracking-tight">
                  <ScanLine className="text-cyan-400" size={24} />
                  AI Visualization
               </h3>
               <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Processing Core Active
               </div>
            </div>

            {result.gradcam ? (
              <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#020617] shadow-2xl group flex flex-col items-center justify-center p-6">
                
                {/* Simulated Medical Grid Background */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                
                {/* Advanced Scanner HUD Container */}
                <div className="relative inline-block overflow-hidden rounded-2xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] max-h-[600px] bg-black">
                  <img
                    src={result.gradcam}
                    alt="GradCAM Heatmap"
                    className="w-full h-full object-contain relative z-10"
                  />
                  
                  {/* Scanning Laser Animation */}
                  <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }} 
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    className="absolute left-0 right-0 h-0.5 bg-cyan-400 z-20 shadow-[0_0_15px_#22d3ee]" 
                  />
                  
                  {/* Corner Target Markers */}
                  <div className="absolute inset-2 pointer-events-none z-30">
                     <div className="w-10 h-10 border-t-2 border-l-2 border-cyan-400 absolute top-0 left-0" />
                     <div className="w-10 h-10 border-t-2 border-r-2 border-cyan-400 absolute top-0 right-0" />
                     <div className="w-10 h-10 border-b-2 border-l-2 border-cyan-400 absolute bottom-0 left-0" />
                     <div className="w-10 h-10 border-b-2 border-r-2 border-cyan-400 absolute bottom-0 right-0" />
                  </div>
                  
                  {/* Heatmap Legend */}
                  <div className="absolute bottom-4 right-4 flex flex-col gap-1 items-end bg-black/80 backdrop-blur-md p-3 rounded-xl border border-white/10 z-30">
                     <div className="text-[9px] font-mono font-bold text-white uppercase tracking-widest">GradCAM Intensity</div>
                     <div className="w-36 h-2 rounded-full mt-1" style={{ background: 'linear-gradient(90deg, rgba(0,0,255,0.5), rgba(0,255,255,0.8), rgba(255,255,0,0.9), rgba(255,0,0,1))' }} />
                     <div className="w-full flex justify-between text-[7px] font-mono text-slate-400 mt-1">
                       <span>LOW (0.0)</span><span>HIGH (1.0)</span>
                     </div>
                  </div>
                </div>

                <div className="w-full mt-6 relative z-10">
                  <div className="bg-cyan-500/10 backdrop-blur-md p-4 rounded-2xl border border-cyan-500/20 flex gap-3 items-start">
                     <Activity className="text-cyan-400 shrink-0 mt-0.5" size={16} />
                     <p className="text-cyan-100 text-xs leading-relaxed font-light opacity-90">
                        <strong className="text-cyan-400 font-bold uppercase tracking-wider block mb-1">Targeted Activation Map</strong>
                        The heat signature directly correlates with the highest predicted pathology index. Warmer regions (red/yellow) indicate focal points heavily weighted by the deep neural network during its decision matrix.
                     </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/5 bg-black/40 p-16 text-center flex flex-col items-center">
                <div className="p-6 bg-white/5 rounded-full border border-white/10 mb-6 group-hover:scale-110 transition-transform">
                  <Microscope className="h-12 w-12 text-slate-600" />
                </div>
                <h4 className="text-white font-bold mb-1">Detailed Mapping Not Available</h4>
                <p className="text-slate-500 text-sm font-light max-w-xs mx-auto leading-relaxed">
                  {isAudio 
                    ? 'Spectral acoustic data was processed via one-dimensional analysis. Heatmap generation is reserved for spatial vision models.' 
                    : 'The input scan was processed through the primary classification layer but GradCAM generation was offline.'}
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: Clinical Details */}
        <div className="xl:col-span-5 space-y-6">
          {/* Findings Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel p-8 rounded-[2.5rem] border-white/5"
          >
            <div className="flex items-center gap-3 mb-8">
               <div className="p-2.5 rounded-xl bg-clinical/10 border border-clinical/20 text-clinical shadow-lg shadow-clinical/10">
                  <Microscope size={20} />
               </div>
               <h3 className="font-display font-bold text-white text-xl uppercase tracking-tight">Clinical Insights</h3>
            </div>
            
            <div className="space-y-4">
              {findings.length > 0 ? (
                findings.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="group"
                  >
                    <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 hover:border-violet-500/20">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 shadow-[0_0_8px_#a78bfa]" />
                      <span className="text-sm text-slate-300 font-light leading-relaxed">{f}</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 italic text-sm font-light">
                   No specific localized pathological markings detected.
                </div>
              )}
            </div>
          </motion.div>

          {/* Actionable items */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel p-8 rounded-[2.5rem] border-white/5"
          >
            <div className="flex items-center gap-3 mb-8">
               <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Lightbulb size={20} />
               </div>
               <h3 className="font-display font-black text-white text-xl uppercase tracking-tight">AI Suggestions</h3>
            </div>

            <div className="space-y-4">
              {suggestions.length > 0 ? (
                suggestions.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex gap-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10"
                  >
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_8px_#fbbf24]" />
                    <span className="text-sm text-slate-200 font-bold">{s}</span>
                  </motion.div>
                ))
              ) : (
                <div className="flex gap-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                   <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                   <span className="text-sm text-slate-400 font-light">Maintain routine health monitoring as prescribed.</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Disclaimer / Note */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-[2rem] bg-black/40 border border-white/5 relative overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-4">
               <Stethoscope size={18} className="text-slate-500" />
               <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Medical Disclaimer</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed font-light">
              This report is generated by a neural network. It is intended for preliminary screening and triage. 
              Lung Whisperer AI is an <span className="text-white font-bold">Assistive Tool</span> and does not provide final definitive medical diagnosis. 
              Always consult a board-certified Radiologist.
            </p>
            <div className="mt-4 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span className="text-[9px] font-mono text-slate-600 uppercase">HIPAA Encrypted</span>
               </div>
               <div className="flex items-center gap-2">
                  <Activity size={14} className="text-cyan-500" />
                  <span className="text-[9px] font-mono text-slate-600 uppercase">Advanced System v4.1</span>
               </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-10">
        <button
          onClick={() => navigate(isAudio ? '/upload-audio' : '/upload')}
          className="px-10 py-4 glass-card text-white font-bold rounded-full hover:bg-white/10 transition-all border border-white/10 shadow-2xl"
        >
          New Clinical Analysis
        </button>
        <button
          onClick={() => navigate('/history')}
          className="btn-primary px-10 py-4 flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${accentHex}, #818cf8)`, boxShadow: `0 10px 30px ${accentHex}30` }}
        >
          View Longitudinal History
          <ChevronLeft className="rotate-180 h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
