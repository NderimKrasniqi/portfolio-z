"use client";

import { createContext, useContext, type ReactNode } from "react";
import { HOME_MUSIC_VIDEO_ID, useHomeMusic } from "./home-music";

const MusicContext = createContext<ReturnType<typeof useHomeMusic> | null>(null);

/** The player lives above route pages so navigation never replaces its iframe. */
export function SiteMusicProvider({ children }: { children: ReactNode }) {
  const music = useHomeMusic();
  const { musicOpen, musicFrame, handleMusicFrameLoad } = music;
  return (
    <MusicContext.Provider value={music}>
      {children}
      <div id="homeMusicPlayer" style={{ position: "fixed", left: -9999, top: 0, width: 1, height: 1, overflow: "hidden", pointerEvents: "none" }} aria-hidden={!musicOpen}>
        {musicOpen && (
          <iframe ref={musicFrame} title="AJ Ghent — Singing Guitar Vibes, Pt. 2" src={`https://www.youtube.com/embed/${HOME_MUSIC_VIDEO_ID}?enablejsapi=1&autoplay=1&controls=0&playsinline=1&loop=1&playlist=${HOME_MUSIC_VIDEO_ID}&rel=0&fs=0&origin=${encodeURIComponent(window.location.origin)}`} allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={handleMusicFrameLoad} />
        )}
      </div>
    </MusicContext.Provider>
  );
}

export function SiteMusicControl() {
  const music = useContext(MusicContext);
  if (!music) return null;
  const { musicOpen, musicPlaying, toggleMusic } = music;
  return (
      <button id="homeMusicToggle" className={`home-music-toggle${musicPlaying ? "" : " is-muted"}`} type="button" aria-label={musicPlaying ? "Pause Singing Guitar Vibes, Pt. 2" : "Play Singing Guitar Vibes, Pt. 2"} aria-pressed={musicPlaying} aria-expanded={musicOpen} aria-controls="homeMusicPlayer" title="Singing Guitar Vibes, Pt. 2 — AJ Ghent" onClick={toggleMusic}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="music-speaker" d="M4 9v6h4l5 4V5L8 9H4z" />
          <path className="music-wave" d="M16 6.5a7 7 0 0 1 0 11" />
          <path className="music-wave" d="M14 9a3 3 0 0 1 0 6" />
          <path className="music-slash" d="m17 10 4 4m0-4-4 4" />
        </svg>
      </button>

  );
}
