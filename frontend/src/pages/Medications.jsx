import { motion, AnimatePresence } from 'framer-motion';
import { getMedications, addMedication, toggleMedication, deleteMedication } from '../api';
import { useToast } from '../components/Toast';

const Medications = () => {
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDose, setNewDose] = useState('');
  const [newTime, setNewTime] = useState('08:00');

  useEffect(() => {
    fetchMeds();
  }, []);

  const fetchMeds = async () => {
    try {
      setLoading(true);
      const data = await getMedications();
      setMeds(data);
    } catch (err) {
      showToast('System synchronization failure. Metadata inaccessible.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleMed = async (id) => {
    try {
      const updated = await toggleMedication(id);
      setMeds(meds.map(m => m.id === id ? updated : m));
      showToast(`Medication ${updated.taken ? 'recorded' : 'reverted'}.`, 'success');
    } catch (err) {
      showToast('Toggle command rejected.', 'error');
    }
  };

  const deleteMed = async (id) => {
    try {
      await deleteMedication(id);
      setMeds(meds.filter(m => m.id !== id));
      showToast('Entry purged from timeline.', 'warning');
    } catch (err) {
      showToast('Erase command failed.', 'error');
    }
  };

  const addMed = async () => {
    if (!newName) return;
    try {
      const added = await addMedication(newName, newDose, newTime);
      setMeds([...meds, added]);
      setNewName(''); setNewDose(''); setShowAdd(false);
      showToast('New composition synchronized.', 'success');
    } catch (err) {
      showToast('Failed to create reminder.', 'error');
    }
  };

  const adherence = Math.round((meds.filter(m => m.taken).length / meds.length) * 100) || 0;

  return (
    <div className="space-y-6 pt-6 max-w-5xl mx-auto pb-24 relative z-10 px-4">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-500/5 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 sm:p-12 rounded-[3.5rem] border-white/5 shadow-2xl relative overflow-hidden"
      >
        {/* Top Shimmer */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <Pill size={14} className="text-violet-400" />
               </div>
               <span className="text-[10px] font-mono font-bold text-violet-400 uppercase tracking-widest">Medical Compliance Protocol</span>
            </div>
            <h1 className="text-4xl font-display font-black text-white tracking-tight">Health <span className="text-gradient-cyan">Timeline</span></h1>
            <p className="text-slate-400 mt-2 font-light max-w-sm">
               Digital medication synchronization and adherence monitoring.
            </p>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-violet-950/40 transition-all active:scale-95"
          >
            <Plus size={18} /> Add New Entry
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence>
              {showAdd && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  className="glass-card p-8 rounded-[2.5rem] border-violet-500/30 mb-8 bg-violet-500/5 backdrop-blur-3xl overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-display font-black text-white">Create Reminder</h3>
                     <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white transition-colors">
                        <AlertCircle size={18} className="rotate-45" />
                     </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                       <label className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest ml-1">Composition Name</label>
                       <input 
                        type="text" 
                        placeholder="e.g. Salbutamol Inhaler" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-violet-500/40 outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest ml-1">Clinical Dosage</label>
                       <input 
                        type="text" 
                        placeholder="e.g. 500 MG / 2 Puffs" 
                        value={newDose}
                        onChange={(e) => setNewDose(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-violet-500/40 outline-none transition-all placeholder:text-slate-600"
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest ml-1">Standard Interval</label>
                       <div className="relative">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                          <input 
                            type="time" 
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm text-white focus:border-violet-500/40 outline-none transition-all"
                          />
                       </div>
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={addMed}
                        className="w-full bg-white text-violet-950 font-black text-xs uppercase tracking-[0.2em] rounded-2xl py-4.5 hover:bg-slate-200 transition-all shadow-xl shadow-white/5 active:scale-[0.98]"
                      >
                        Synchronize Entry
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">Synchronizing Encrypted Data...</span>
                </div>
              ) : (
                <AnimatePresence>
                  {meds.map((med, i) => (
                    <motion.div 
                      key={med.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`glass-card p-6 rounded-[2rem] border-white/10 flex items-center gap-6 group transition-all relative overflow-hidden ${med.taken ? 'opacity-40 grayscale-[0.5]' : 'hover:border-violet-500/40 hover:bg-white/5'}`}
                    >
                      {/* Status accent */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${med.taken ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                      <div className={`p-5 rounded-2xl transition-all duration-700 ${med.taken ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 text-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.1)] group-hover:bg-rose-500 group-hover:text-white transition-all group-hover:scale-105'}`}>
                        <Pill size={24} />
                      </div>
                      <div className="flex-grow">
                         <div className="flex items-center gap-3 mb-1">
                            <h4 className={`text-xl font-display font-black tracking-tight ${med.taken ? 'text-slate-400' : 'text-white'}`}>{med.name}</h4>
                            {med.taken && <CheckCircle2 size={16} className="text-emerald-500" />}
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 rounded-lg bg-black/40 border border-white/5">{med.dose || med.dosage}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} className="text-slate-600" /> {med.time}</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleMed(med.id)}
                          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                            med.taken 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 shadow-none' 
                              : 'bg-white text-black hover:bg-slate-200 shadow-white/10'
                          }`}
                        >
                          {med.taken ? 'Recorded' : 'Signal Taken'}
                        </button>
                        <button onClick={() => deleteMed(med.id)} className="p-2.5 rounded-xl bg-white/5 border border-transparent hover:border-rose-500/30 hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              
              {!loading && meds.length === 0 && (
                <div className="text-center py-20 bg-black/20 rounded-[3rem] border border-white/5 border-dashed">
                   <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                      <LayoutDashboard className="text-slate-700" size={32} />
                   </div>
                   <h3 className="text-white font-bold mb-1">Timeline Empty</h3>
                   <p className="text-slate-600 text-xs font-light">No medications synchronized for today.</p>
                </div>
              )}
</div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card p-10 rounded-[3rem] border-white/5 text-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
               <div className="relative w-40 h-40 mx-auto mb-8">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <motion.circle 
                      initial={{ strokeDasharray: "0 282" }}
                      animate={{ strokeDasharray: `${adherence * 2.82} 282` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      cx="50" cy="50" r="45" fill="none" stroke="url(#cyan-grad)" strokeWidth="10" 
                      strokeLinecap="round"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                    />
                    <defs>
                       <linearGradient id="cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                       </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-5xl font-display font-black text-white">{adherence}<span className="text-xl opacity-30">%</span></div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-black mt-1">Compliance</div>
                  </div>
               </div>
               <p className="text-xs text-slate-400 font-light leading-relaxed max-w-[200px] mx-auto">
                 {adherence >= 80 
                  ? "Optimal adherence profile. Biological stability reached." 
                  : "Critical adherence deficit. Immediate action recommended."}
               </p>
               <div className="mt-8 flex justify-center">
                  <div className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400 uppercase tracking-widest">
                     Verified Data
                  </div>
               </div>
            </div>

            <div className="glass-card p-8 rounded-[3rem] border-white/5">
              <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                <Calendar size={14} className="text-violet-400" /> Compliance Trend
              </h4>
              <div className="flex gap-2.5 items-end h-32 pt-4 px-1">
                {[80, 100, 90, 60, 100, 40, 20].map((h, i) => (
                  <div key={i} className="flex-grow flex flex-col items-center gap-3">
                    <div className="w-full bg-white/5 rounded-t-xl relative group">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="rounded-t-xl transition-all duration-300" 
                        style={{ background: 'linear-gradient(to bottom, #8b5cf6, rgba(139,92,246,0.3))', opacity: 0.3 + (h/100) * 0.7 }}
                      />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black text-white">{h}%</div>
                    </div>
                    <span className="text-[8px] text-slate-700 font-black uppercase">{'MTWTFSS'[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/20 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                  <Activity size={18} className="text-indigo-400" />
                  <span className="text-[10px] font-mono font-black text-indigo-300 uppercase tracking-widest">Auto-Alert System</span>
               </div>
               <p className="text-[11px] text-indigo-200/50 leading-relaxed font-light">
                  RespiraBot will trigger a high-priority notification if a vital dose is bypassed during clinical windows.
               </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Medications;
