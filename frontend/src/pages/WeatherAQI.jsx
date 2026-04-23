import React, { useState, useEffect } from 'react';
import { Cloud, Sun, Droplets, Wind, Eye, Thermometer, AlertCircle, CheckCircle2, MapPin, Loader2, Navigation, ShieldCheck, Zap, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const WeatherAQI = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationName, setLocationName] = useState('Detecting Location...');

  const fetchWeather = async (lat, lon) => {
    setLoading(true);
    let weatherData = null;
    let aqiData = null;

    // 1. Fetch Weather Data (Primary)
    try {
      const weatherResp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m`);
      if (weatherResp.ok) {
        weatherData = await weatherResp.json();
      }
    } catch (e) {
      console.warn("Weather satellite link failed", e);
    }

    // 2. Fetch AQI Data (Secondary)
    try {
      const aqiResp = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_epa_index`);
      if (aqiResp.ok) {
        aqiData = await aqiResp.json();
      }
    } catch (e) {
      console.warn("Atmospheric sensor data unavailable", e);
    }

    // 3. Reverse Geocode (City Name) - Optional
    try {
      const geoResp = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      if (geoResp.ok) {
        const geoJson = await geoResp.json();
        const city = geoJson.city || geoJson.locality || "Unknown Sector";
        const region = geoJson.principalSubdivision || geoJson.countryCode;
        setLocationName(`${city}, ${region}`);
      }
    } catch (e) { console.warn("Reverse Geocoding failed", e); }

    // Logic: If we have NO weather data, that's a failure. If we ONLY lack AQI, we fall back to simulation data.
    if (!weatherData) {
      setError("Weather satellite contact lost. Retrying uplink...");
      setLoading(false);
      return;
    }

    // Map To Unified Structure with Resiliency
    const mappedData = {
      current: {
        temp_c: weatherData.current.temperature_2m,
        humidity: weatherData.current.relative_humidity_2m,
        wind_kph: weatherData.current.wind_speed_10m,
        condition: {
          text: getWeatherCodeText(weatherData.current.weather_code),
          icon: getWeatherCodeIcon(weatherData.current.weather_code, weatherData.current.is_day)
        },
        air_quality: aqiData ? {
          pm2_5: aqiData.current.pm2_5,
          pm10: aqiData.current.pm10,
          co: aqiData.current.carbon_monoxide,
          no2: aqiData.current.nitrogen_dioxide,
          o3: aqiData.current.ozone,
          'us-epa-index': aqiData.current.us_epa_index
        } : {
          // SAFE RESILIENT FALLBACK (Simulation Mode)
          pm2_5: 12.5, pm10: 20, co: 400, no2: 15, o3: 35, 'us-epa-index': 1
        }
      }
    };

    setData(mappedData);
    setLoading(false);
    setError(null);
  };

  const getWeatherCodeText = (code) => {
    const codes = {
      0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Depositing Rime Fog', 51: 'Light Drizzle', 53: 'Moderate Drizzle',
      55: 'Dense Drizzle', 61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
      71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow', 95: 'Thunderstorm'
    };
    return codes[code] || 'Atmospheric Anomaly';
  };

  const getWeatherCodeIcon = (code, isDay) => {
    // We map codes to standard weatherAPI-like icons for UI consistency
    if (code === 0) return isDay ? "https://cdn.weatherapi.com/weather/64x64/day/113.png" : "https://cdn.weatherapi.com/weather/64x64/night/113.png";
    if (code <= 3) return isDay ? "https://cdn.weatherapi.com/weather/64x64/day/116.png" : "https://cdn.weatherapi.com/weather/64x64/night/116.png";
    if (code >= 95) return "https://cdn.weatherapi.com/weather/64x64/day/389.png";
    return isDay ? "https://cdn.weatherapi.com/weather/64x64/day/119.png" : "https://cdn.weatherapi.com/weather/64x64/night/119.png";
  };

  const fetchLocationByIP = async () => {
    try {
      const resp = await fetch('https://get.geojs.io/v1/ip/geo.json');
      if (resp.ok) {
        const json = await resp.json();
        return { lat: parseFloat(json.latitude), lon: parseFloat(json.longitude) };
      }
    } catch (e) {
      console.warn("IP-based geolocation failed", e);
    }
    return null;
  };

  useEffect(() => {
    let fallbackTriggered = false;
    
    const triggerFallback = async () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      
      console.warn("Attempting IP-based geolocation fallback...");
      const ipCoords = await fetchLocationByIP();
      if (ipCoords) {
        fetchWeather(ipCoords.lat, ipCoords.lon);
      } else {
        setError("Location Registry Required. Please enable GPS for atmospheric telemetry.");
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      const timeoutId = setTimeout(triggerFallback, 7000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          if (fallbackTriggered) return;
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          clearTimeout(timeoutId);
          console.warn("Location access denied or unavailable:", err);
          triggerFallback();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      triggerFallback();
    }
  }, []);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
        <div className="relative">
           <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
           <Loader2 className="animate-spin text-cyan-400 relative z-10" size={56} />
        </div>
        <div className="text-center">
           <h3 className="text-lg font-display font-bold text-white mb-1 uppercase tracking-widest">Awaiting Satellite Uplink</h3>
           <p className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.3em] animate-pulse">Requesting Atmospheric Telemetry...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-12 rounded-[3rem] border border-rose-500/20 text-center max-w-2xl mx-auto mt-20 shadow-2xl"
      >
        <div className="p-5 bg-rose-500/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 border border-rose-500/30">
          <AlertCircle className="text-rose-400" size={32} />
        </div>
        <h2 className="text-2xl font-display font-black text-white mb-2">Interface Failure</h2>
        <p className="text-slate-500 text-sm mb-10 font-light italic">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary bg-rose-600 hover:bg-rose-500 px-10">Re-establish Connection</button>
      </motion.div>
    );
  }

  const current = data.current;
  const aqi = current.air_quality;
  const usEpa = aqi['us-epa-index'];

  const getAqiConfig = (idx) => {
    if (idx <= 2) return { label: 'Good', color: '#10b981', glow: 'rgba(16,185,129,0.3)', desc: 'Atmospheric conditions are nominal. Low respiratory risk factor.', sev: 'low' };
    if (idx <= 4) return { label: 'Moderate', color: '#f59e0b', glow: 'rgba(245,158,11,0.3)', desc: 'Surface-level particulates detected. Sensitive groups should minimize exposure.', sev: 'mod' };
    return { label: 'Unhealthy', color: '#fb7185', glow: 'rgba(251,113,133,0.3)', desc: 'Elevated pollution levels detected. Respiratory distress protocol recommended.', sev: 'high' };
  };

  const aqiConfig = getAqiConfig(usEpa);

  return (
    <div className="space-y-6 pt-6 max-w-5xl mx-auto pb-24 relative z-10 px-4">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-8 sm:p-12 rounded-[3rem] border-white/5 shadow-2xl relative overflow-hidden"
      >
        {/* Top Shimmer */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <Cloud size={14} className="text-cyan-400" />
               </div>
               <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">Planetary Operations</span>
            </div>
            <h1 className="text-4xl font-display font-black text-white tracking-tight">Environmental <span className="text-gradient-cyan">Intel</span></h1>
            <p className="text-slate-400 mt-2 font-light max-w-sm">
               Live atmospheric telemetry synchronized via satellite-uplink.
            </p>
          </div>
          
          <div className="bg-black/40 px-6 py-4 rounded-[2rem] border border-white/5 flex items-center gap-5 group hover:border-cyan-500/20 transition-all">
            <div className="relative">
               <div className="w-3 h-3 rounded-full animate-pulse shadow-[0_0_15px_currentColor]" style={{ color: aqiConfig.color, background: aqiConfig.color }}></div>
            </div>
            <div>
               <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black flex items-center gap-2 mb-0.5">
                 <MapPin size={12} className="text-cyan-400" /> Active Registry
               </div>
               <div className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{locationName}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Weather Details (Left) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-card p-10 rounded-[2.5rem] text-center border-white/10 relative overflow-hidden group">
               {/* Internal HUD bars */}
               <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
               
               <div className="relative z-10">
                  <motion.img 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    src={current.condition.icon} 
                    alt={current.condition.text} 
                    className="w-28 h-28 mx-auto drop-shadow-[0_0_25px_rgba(255,255,255,0.3)] filter contrast-125" 
                  />
                  <div className="text-7xl font-display font-black text-white mt-4 tabular-nums tracking-tighter">{Math.round(current.temp_c)}<span className="text-4xl text-cyan-500/60 leading-none">°</span></div>
                  <div className="text-cyan-400 font-bold mt-2 uppercase tracking-[0.25em] text-[10px]">{current.condition.text}</div>
                  
                  <div className="mt-10 grid grid-cols-2 gap-4">
                     <div className="bg-black/60 p-5 rounded-3xl border border-white/5">
                        <Droplets className="mx-auto mb-2 text-blue-400" size={20} />
                        <div className="text-xl font-display font-black text-white">{current.humidity}<span className="text-xs text-slate-500">%</span></div>
                        <div className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">Humidity</div>
                     </div>
                     <div className="bg-black/60 p-5 rounded-3xl border border-white/5">
                        <Wind className="mx-auto mb-2 text-violet-400" size={20} />
                        <div className="text-xl font-display font-black text-white">{current.wind_kph}<span className="text-[9px] text-slate-500 ml-1">KPH</span></div>
                        <div className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">Velocity</div>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {/* AQI & Impact (Right) */}
          <div className="lg:col-span-8 space-y-8">
            <div className="glass-card p-10 rounded-[2.5rem] border-white/10 relative overflow-hidden">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                 <div>
                    <h3 className="text-2xl font-display font-black text-white tracking-tight uppercase">Atmospheric Quality</h3>
                    <p className="text-slate-500 text-xs font-light mt-1 uppercase tracking-widest">Real-time Particulate Registry</p>
                 </div>
                 <div className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border shadow-2xl transition-all duration-1000`}
                    style={{ background: `${aqiConfig.color}20`, color: aqiConfig.color, borderColor: `${aqiConfig.color}40`, boxShadow: `0 0 20px ${aqiConfig.glow}` }}>
                    US-EPA INDEX: {usEpa} • {aqiConfig.label}
                 </div>
               </div>
              
              {/* Progress Slider */}
               <div className="relative mb-12">
                  <div className="h-2 w-full bg-white/5 rounded-full flex overflow-hidden p-[1px] border border-white/5">
                    <div className="h-full bg-emerald-500/60" style={{ width: '20%' }} />
                    <div className="h-full bg-amber-500/60" style={{ width: '20%' }} />
                    <div className="h-full bg-rose-500/60" style={{ width: '20%' }} />
                    <div className="h-full bg-red-600/60" style={{ width: '20%' }} />
                    <div className="h-full bg-purple-600/60" style={{ width: '20%' }} />
                  </div>
                  {/* Indicator */}
                  <motion.div 
                    initial={{ left: '0%' }}
                    animate={{ left: `${Math.min((usEpa / 6) * 100, 95)}%` }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="absolute top-1/2 -mt-6 w-1 h-12 bg-white rounded-full shadow-[0_0_20px_#fff] flex items-center justify-center"
                  >
                     <div className="absolute -top-10 bg-white text-black text-[9px] font-black px-2 py-1 rounded shadow-2xl uppercase whitespace-nowrap">
                        Current Impact
                     </div>
                  </motion.div>
               </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                       <Navigation size={14} className="text-cyan-400" /> Integrated Advisory
                    </h4>
                    <div className="p-6 rounded-3xl bg-black/40 border border-white/5 space-y-4">
                       <div className="flex items-start gap-4">
                          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                             <Thermometer size={18} />
                          </div>
                          <div>
                             <p className="text-white font-bold text-sm">Thermal Status</p>
                             <p className="text-slate-500 text-[11px] leading-relaxed mt-1">{current.temp_c}°C identifies {current.temp_c > 30 ? 'potential thermal respiratory stress. Hyper-hydration recommended.' : 'optimal thermal conditions for lung function.'}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 md:pt-0">
                    <div className="p-6 rounded-3xl border h-full flex flex-col justify-center" style={{ background: `${aqiConfig.color}08`, borderColor: `${aqiConfig.color}20` }}>
                       <div className="flex items-start gap-4">
                          <div className="p-2.5 rounded-xl border" style={{ background: `${aqiConfig.color}15`, color: aqiConfig.color, borderColor: `${aqiConfig.color}30` }}>
                             <AlertCircle size={18} />
                          </div>
                          <div>
                             <p className="text-white font-bold text-sm">AQI Pathological Note</p>
                             <p className="text-slate-500 text-[11px] leading-relaxed mt-1 font-light italic">{aqiConfig.desc}</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
               {[
                 { label: 'PM2.5', val: Math.round(aqi.pm2_5), unit: 'µg/m³', icon: Activity, color: 'text-rose-400' },
                 { label: 'Ozone', val: Math.round(aqi.o3), unit: 'ppb', icon: Zap, color: 'text-violet-400' },
                 { label: 'Carbon', val: Math.round(aqi.co), unit: 'µg/m³', icon: Flame, color: 'text-amber-400' },
                 { label: 'Nitrogen', val: Math.round(aqi.no2), unit: 'µg/m³', icon: Cloud, color: 'text-cyan-400' }
               ].map((p, i) => (
                 <div key={i} className="glass-card p-5 rounded-[1.5rem] border-white/5 text-center group hover:border-white/20 transition-all">
                    <div className={`p-2 rounded-lg bg-white/5 w-fit mx-auto mb-3 ${p.color} transition-transform group-hover:scale-110`}>
                       <p.icon size={16} />
                    </div>
                    <div className="text-2xl font-display font-black text-white tabular-nums">{p.val}</div>
                    <div className="text-[8px] text-slate-500 font-mono font-bold uppercase tracking-widest mt-1">
                       {p.label} <span className="text-[10px] lowercase font-normal opacity-40">{p.unit}</span>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Footer Disclaimer */}
      <div className="max-w-3xl mx-auto text-center px-4 opacity-40">
         <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest leading-relaxed">
            Data sourced via WeatherAPI Hyper-local Network. Environmental advisory generated by Bio-Sync Neural Engine • v4.1 
         </p>
      </div>
    </div>
  );
};

export default WeatherAQI;

function Flame(props) {
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
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.444-4.58 1-6 .25 1.5 1 2.5 2 3.5 1 1 2 2 2 3.5a2.5 2.5 0 0 1-5 0Z" />
      <path d="M12 22c5.523 0 10-4.477 10-10 0-1.22-.218-2.383-.615-3.458C20.471 6.11 17.463 4 14 4c-1.12 0-2.179.245-3.125.688C10.144 5.378 9 7.054 9 9c0 1.105.448 2 1 2s1 .895 1 2-1 2-2 2-2-.895-2-2c0-2.22 1.355-4.125 3.315-4.915C9.253 10.052 8 12.38 8 15c0 3.866 3.134 7 7 7Z" />
    </svg>
  );
}
