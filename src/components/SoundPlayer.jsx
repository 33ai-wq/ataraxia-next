import { useEffect, useRef, useState, useCallback } from 'react';

const AMBIENT_TRACKS = [
  { id: 'ambient-pad', name: 'Ambient Pad', type: 'pad', baseFreq: 110, color: '#00d4aa' },
  { id: 'rain-forest', name: 'Rain Forest', type: 'noise', filterType: 'lowpass', freq: 800, color: '#4a90d9' },
  { id: 'singing-bowl', name: 'Singing Bowl 432Hz', type: 'tone', freq: 432, color: '#d4a500' },
];

export default function SoundPlayer({ onReady }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.25);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTrackSelector, setShowTrackSelector] = useState(false);
  const audioContextRef = useRef(null);
  const tracksRef = useRef({});
  const fadeIntervalRef = useRef(null);

  // Initialize Web Audio API
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;

    AMBIENT_TRACKS.forEach((track, index) => {
      if (track.type === 'pad') {
        // Create a rich pad sound with multiple oscillators
        const oscillators = [];
        const gains = [];
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        filter.Q.value = 2;
        
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        
        // Fundamental + harmonics for rich pad
        const frequencies = [track.baseFreq, track.baseFreq * 2, track.baseFreq * 3, track.baseFreq * 1.5];
        const gainValues = [0.4, 0.2, 0.1, 0.15];
        
        frequencies.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          
          const gain = ctx.createGain();
          gain.gain.value = gainValues[i];
          
          osc.connect(gain).connect(filter);
          osc.start(0);
          
          oscillators.push(osc);
          gains.push(gain);
        });
        
        filter.connect(masterGain).connect(ctx.destination);
        
        tracksRef.current[track.id] = { 
          oscillators, 
          gains, 
          filter, 
          masterGain, 
          playing: false 
        };
      } else if (track.type === 'noise') {
        // Generate filtered noise for rain/forest
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        const filter = ctx.createBiquadFilter();
        filter.type = track.filterType || 'lowpass';
        filter.frequency.value = track.freq || 1000;
        filter.Q.value = 1;
        
        const gain = ctx.createGain();
        gain.gain.value = 0;
        
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start(0);
        
        tracksRef.current[track.id] = { source, filter, gain, playing: false };
      } else if (track.type === 'tone') {
        // Singing bowl - sine wave with slight detune for richness
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = track.freq;
        
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = track.freq * 2.001; // Slight detune
        
        const gain1 = ctx.createGain();
        gain1.gain.value = 0.3;
        const gain2 = ctx.createGain();
        gain2.gain.value = 0.15;
        
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        
        osc1.connect(gain1).connect(masterGain);
        osc2.connect(gain2).connect(masterGain);
        masterGain.connect(ctx.destination);
        
        osc1.start(0);
        osc2.start(0);
        
        tracksRef.current[track.id] = { osc1, osc2, gain1, gain2, masterGain, playing: false };
      }
      
      if (index === AMBIENT_TRACKS.length - 1) {
        setIsLoaded(true);
        onReady?.();
      }
    });

    return () => {
      Object.values(tracksRef.current).forEach(track => {
        if (track.oscillators) track.oscillators.forEach(o => o.stop());
        if (track.osc1) track.osc1.stop();
        if (track.osc2) track.osc2.stop();
        if (track.source) track.source.stop();
      });
      ctx.close();
    };
  }, [onReady]);

  const fadeIn = useCallback((trackId, targetVolume = 0.25, duration = 2000) => {
    const track = tracksRef.current[trackId];
    if (!track || !audioContextRef.current) return;
    
    const steps = 60;
    const stepTime = duration / steps;
    const volumeStep = targetVolume / steps;
    let currentVolume = 0;
    
    track.masterGain?.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    track.gain?.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    track.playing = true;
    
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    
    fadeIntervalRef.current = setInterval(() => {
      currentVolume += volumeStep;
      if (currentVolume >= targetVolume) {
        track.masterGain?.gain.setValueAtTime(targetVolume, audioContextRef.current.currentTime);
        track.gain?.gain.setValueAtTime(targetVolume, audioContextRef.current.currentTime);
        clearInterval(fadeIntervalRef.current);
      } else {
        track.masterGain?.gain.setValueAtTime(currentVolume, audioContextRef.current.currentTime);
        track.gain?.gain.setValueAtTime(currentVolume, audioContextRef.current.currentTime);
      }
    }, stepTime);
  }, []);

  const fadeOut = useCallback((trackId, duration = 1000) => {
    const track = tracksRef.current[trackId];
    if (!track || !audioContextRef.current) return;
    
    const currentVol = track.masterGain?.gain.value || track.gain?.gain.value || 0;
    const steps = 30;
    const stepTime = duration / steps;
    const volumeStep = currentVol / steps;
    let currentVolume = currentVol;
    
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    
    fadeIntervalRef.current = setInterval(() => {
      currentVolume -= volumeStep;
      if (currentVolume <= 0) {
        track.masterGain?.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        track.gain?.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        track.playing = false;
        clearInterval(fadeIntervalRef.current);
      } else {
        track.masterGain?.gain.setValueAtTime(currentVolume, audioContextRef.current.currentTime);
        track.gain?.gain.setValueAtTime(currentVolume, audioContextRef.current.currentTime);
      }
    }, stepTime);
  }, []);

  const playTrack = useCallback((index) => {
    if (index === currentTrackIndex && isPlaying) return;
    
    const prevTrack = AMBIENT_TRACKS[currentTrackIndex];
    const nextTrack = AMBIENT_TRACKS[index];
    
    if (tracksRef.current[prevTrack.id]?.playing) {
      fadeOut(prevTrack.id, 500);
    }
    
    setCurrentTrackIndex(index);
    
    if (isPlaying || !tracksRef.current[prevTrack.id]?.playing) {
      fadeIn(nextTrack.id, volume);
      setIsPlaying(true);
    }
  }, [currentTrackIndex, isPlaying, volume, fadeIn, fadeOut]);

  const togglePlay = useCallback(() => {
    const track = tracksRef.current[AMBIENT_TRACKS[currentTrackIndex].id];
    if (!track) return;
    
    if (isPlaying) {
      fadeOut(AMBIENT_TRACKS[currentTrackIndex].id);
      setIsPlaying(false);
    } else {
      fadeIn(AMBIENT_TRACKS[currentTrackIndex].id, volume);
      setIsPlaying(true);
    }
  }, [currentTrackIndex, isPlaying, volume, fadeIn, fadeOut]);

  const setVolumeLevel = useCallback((newVolume) => {
    setVolume(newVolume);
    const track = tracksRef.current[AMBIENT_TRACKS[currentTrackIndex].id];
    if (track && isPlaying) {
      track.masterGain?.gain.setValueAtTime(newVolume, audioContextRef.current?.currentTime);
      track.gain?.gain.setValueAtTime(newVolume, audioContextRef.current?.currentTime);
    }
  }, [currentTrackIndex, isPlaying]);

  // Expose methods for parent
  useEffect(() => {
    window.__ataraxiaSoundPlayer = {
      play: () => { const t = tracksRef.current[AMBIENT_TRACKS[currentTrackIndex].id]; if (t) fadeIn(AMBIENT_TRACKS[currentTrackIndex].id, volume); setIsPlaying(true); },
      pause: () => { const t = tracksRef.current[AMBIENT_TRACKS[currentTrackIndex].id]; if (t) fadeOut(AMBIENT_TRACKS[currentTrackIndex].id); setIsPlaying(false); },
      toggle: togglePlay,
      setTrack: playTrack,
      setVolume: setVolumeLevel,
      getCurrentTrack: () => AMBIENT_TRACKS[currentTrackIndex],
      isLoaded: () => isLoaded,
    };
  }, [currentTrackIndex, isPlaying, volume, isLoaded, fadeIn, fadeOut, togglePlay, playTrack, setVolumeLevel]);

  const currentTrack = AMBIENT_TRACKS[currentTrackIndex];

  return (
    <div className="fixed bottom-6 right-6 z-50 group">
      {/* Track Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowTrackSelector(!showTrackSelector)}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full text-fg text-sm"
          aria-label="Select soundscape"
        >
          <span className="text-lg">{isPlaying ? '🔊' : '🔇'}</span>
          <span className="hidden sm:inline">{currentTrack.name}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showTrackSelector && (
          <div className="absolute bottom-full right-0 mb-2 w-56 bg-card border border-border rounded-lg overflow-hidden shadow-xl animate-slideUp">
            {AMBIENT_TRACKS.map((track, index) => (
              <button
                key={track.id}
                onClick={() => { playTrack(index); setShowTrackSelector(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                  index === currentTrackIndex 
                    ? 'bg-accent-dim text-accent border-b border-border' 
                    : 'hover:bg-bg-elevated text-fg'
                }`}
              >
                <span className="text-lg">{index === currentTrackIndex ? '▶' : '⬜'}</span>
                <span>{track.name}</span>
                {index === currentTrackIndex && isPlaying && <span className="ml-auto text-xs text-accent">Playing</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Volume Slider - hover to reveal */}
      <div className="absolute bottom-14 right-0 w-32 bg-card border border-border rounded-full px-3 py-2 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
          className="w-full h-2 appearance-none bg-border rounded-full accent-accent"
          aria-label="Volume"
        />
      </div>
    </div>
  );
}