"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 24;
const BAR_MAX_HEIGHT = 36;

export function BackgroundAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    new Array(BAR_COUNT).fill(0.06)
  );

  const initAudioGraph = () => {
    const audio = audioRef.current;
    if (!audio || audioContextRef.current) return;

    try {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaElementSource(audio);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyserRef.current = analyser;

      const draw = () => {
        const node = analyserRef.current;
        if (node && isPlayingRef.current) {
          const data = new Uint8Array(node.frequencyBinCount);
          node.getByteFrequencyData(data);
          const next = new Array(BAR_COUNT);
          for (let i = 0; i < BAR_COUNT; i++) {
            const raw = data[Math.floor((i / BAR_COUNT) * 16)] / 255;
            next[i] = Math.max(0.06, raw);
          }
          setBarHeights(next);
        }
        animationFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      analyserRef.current = null;
    }
  };

  useEffect(() => {
    const audio = new Audio("/uniabuja_anthem.mp3");
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    const handleInteraction = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          initAudioGraph();
        }).catch(() => {
          setIsPlaying(false);
          isPlayingRef.current = false;
        });
        setIsMuted(false);
        setHasInteracted(true);
      }
    };

    document.addEventListener("pointerdown", handleInteraction);
    document.addEventListener("keydown", handleInteraction);

    return () => {
      document.removeEventListener("pointerdown", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      audio.pause();
      audio.src = "";
    };
  }, []);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      if (next) {
        audioRef.current?.pause();
        isPlayingRef.current = false;
        setIsPlaying(false);
      } else if (hasInteracted) {
        audioRef.current?.play().then(() => {
          isPlayingRef.current = true;
          setIsPlaying(true);
          if (!audioContextRef.current) initAudioGraph();
        }).catch(() => {
          isPlayingRef.current = false;
          setIsPlaying(false);
        });
      }
      return next;
    });
  };

  if (!hasInteracted) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-end gap-3">
      {isPlaying && !isMuted && (
        <div
          className="flex items-end gap-[3px] rounded-xl bg-black/30 p-2 backdrop-blur-[2px] dark:bg-black/40"
          aria-hidden="true"
        >
          {barHeights.map((height, i) => (
            <div
              key={i}
              className="w-[3px] rounded-t-sm bg-brand"
              style={{ height: `${Math.max(2, Math.round(height * BAR_MAX_HEIGHT))}px` }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={toggleMute}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-brand-strong shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:bg-brand-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 dark:bg-slate-800/90 dark:text-brand dark:hover:bg-brand-strong dark:hover:text-white"
        aria-label={isMuted ? "Unmute background audio" : "Mute background audio"}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>
    </div>
  );
}