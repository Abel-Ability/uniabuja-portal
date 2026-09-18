"use client";

import { useEffect, useRef, useState } from "react";

export function BackgroundAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [barHeights, setBarHeights] = useState<number[]>(new Array(16).fill(0.1));

  useEffect(() => {
    const audio = new Audio("/uniabuja_anthem.mp3");
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    const handleInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        initAudioContext();
        audio.play().then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
        }).catch(() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
      }
    };

    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("keydown", handleInteraction, { once: true });
    document.addEventListener("touchstart", handleInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      cleanup();
    };
  }, [hasInteracted]);

  const initAudioContext = () => {
    if (audioContextRef.current) return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaElementSource(audioRef.current!);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    analyserRef.current = analyser;
    animateBars();
  };

  const animateBars = () => {
    const analyser = analyserRef.current;
    if (!analyser || isMutedRef.current || !isPlayingRef.current) {
      setBarHeights(new Array(16).fill(0.1));
      animationFrameRef.current = requestAnimationFrame(animateBars);
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const bars = 16;
    const heights = [];
    for (let i = 0; i < bars; i++) {
      const value = dataArray[i] / 255;
      heights.push(Math.max(0.1, value));
    }
    setBarHeights(heights);

    animationFrameRef.current = requestAnimationFrame(animateBars);
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (isMuted) {
        audioRef.current.pause();
        setIsPlaying(false);
        isPlayingRef.current = false;
      } else if (!isMuted && hasInteracted) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
        }).catch(() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
      }
    }
  }, [isMuted, hasInteracted]);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      return next;
    });
  };

  if (!hasInteracted) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex items-end gap-3">
        {isPlaying && !isMuted && (
          <div className="flex items-end gap-1 h-10 mb-1 pr-2" aria-hidden="true">
            {barHeights.map((height, i) => (
              <div
                key={i}
                className="w-1.5 rounded-t bg-primary/60 transition-all duration-75 ease-out"
                style={{
                  height: `${height * 100}%`,
                  animationDelay: `${i * 30}ms`,
                }}
              />
            ))}
          </div>
        )}
        <button
          onClick={toggleMute}
          className="fixed bottom-4 right-4 z-50 p-2 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={isMuted ? "Unmute background audio" : "Mute background audio"}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}