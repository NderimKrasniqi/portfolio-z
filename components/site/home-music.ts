"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type YouTubePlayerEvent = {
  data: number;
};

type YouTubePlayer = {
  destroy?: () => void;
  mute?: () => void;
  pauseVideo?: () => void;
  playVideo?: () => void;
  setVolume?: (volume: number) => void;
  unMute?: () => void;
};

type YouTubeApi = {
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    CUED: number;
  };
  Player: new (
    element: HTMLIFrameElement,
    options: {
      playerVars?: Record<
        string,
        number | string
      >;
      events: {
        onReady?: () => void;
        onStateChange?: (
          event: YouTubePlayerEvent,
        ) => void;
        onError?: () => void;
        onAutoplayBlocked?: () => void;
      };
    },
  ) => YouTubePlayer;
};

type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

export const HOME_MUSIC_VIDEO_ID =
  "qBrgKLPYoNM";

let youTubeApiPromise:
  | Promise<void>
  | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("YouTube is browser-only"),
    );
  }

  const youtubeWindow =
    window as YouTubeWindow;

  if (youtubeWindow.YT?.Player) {
    return Promise.resolve();
  }

  if (youTubeApiPromise) {
    return youTubeApiPromise;
  }

  youTubeApiPromise =
    new Promise<void>(
      (resolve, reject) => {
        let settled = false;
        let timeout = 0;

        const finish = (
          error?: Error,
        ) => {
          if (settled) return;

          settled = true;
          window.clearTimeout(timeout);

          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };

        const previous =
          youtubeWindow
            .onYouTubeIframeAPIReady;

        youtubeWindow
          .onYouTubeIframeAPIReady =
          () => {
            try {
              previous?.();
            } catch {
              // Another consumer owns its callback.
            }

            finish();
          };

        const existing =
          document.querySelector<HTMLScriptElement>(
            "script[data-zeudi-youtube-api]",
          );

        const script =
          existing ||
          document.createElement("script");

        if (!existing) {
          script.src =
            "https://www.youtube.com/iframe_api";
          script.async = true;
          script.dataset.zeudiYoutubeApi =
            "1";

          document.head.appendChild(
            script,
          );
        }

        script.addEventListener(
          "error",
          () =>
            finish(
              new Error(
                "YouTube API failed to load",
              ),
            ),
          { once: true },
        );

        timeout = window.setTimeout(
          () =>
            finish(
              new Error(
                "YouTube API timed out",
              ),
            ),
          8000,
        );
      },
    );

  return youTubeApiPromise;
}

export function useHomeMusic(
  active: boolean,
) {
  const [musicOpen, setMusicOpen] =
    useState(false);

  const [
    musicPlaying,
    setMusicPlaying,
  ] = useState(false);

  const musicFrame =
    useRef<HTMLIFrameElement>(null);

  const musicPlayer =
    useRef<YouTubePlayer | null>(null);

  const musicPlayingRef =
    useRef(false);

  useEffect(() => {
    musicPlayingRef.current =
      musicPlaying;
  }, [musicPlaying]);

  const sendMusicCommand =
    useCallback(
      (
        func:
          | "playVideo"
          | "pauseVideo"
          | "unMute",
      ) => {
        const frame =
          musicFrame.current;

        if (!frame?.contentWindow) {
          return;
        }

        frame.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func,
            args: [],
          }),
          "https://www.youtube.com",
        );
      },
      [],
    );

  const toggleMusic = useCallback(() => {
    if (!musicOpen) {
      setMusicOpen(true);
      setMusicPlaying(true);
      return;
    }

    const next = !musicPlaying;

    setMusicPlaying(next);

    if (!next) {
      setMusicOpen(false);
    }

    if (next) {
      musicPlayer.current
        ?.setVolume?.(64);

      musicPlayer.current
        ?.unMute?.();

      musicPlayer.current
        ?.playVideo?.();

      sendMusicCommand("unMute");
    }

    sendMusicCommand(
      next
        ? "playVideo"
        : "pauseVideo",
    );
  }, [
    musicOpen,
    musicPlaying,
    sendMusicCommand,
  ]);

  const handleMusicFrameLoad =
    useCallback(() => {
      sendMusicCommand(
        musicPlaying
          ? "playVideo"
          : "pauseVideo",
      );
    }, [
      musicPlaying,
      sendMusicCommand,
    ]);

  useEffect(() => {
    if (!musicOpen) {
      musicPlayer.current
        ?.pauseVideo?.();

      musicPlayer.current
        ?.destroy?.();

      musicPlayer.current = null;

      return;
    }

    let cancelled = false;
    const frame = musicFrame.current;

    if (!frame) return;

    loadYouTubeApi()
      .then(() => {
        const youtubeWindow =
          window as YouTubeWindow;

        if (
          cancelled ||
          !frame ||
          !youtubeWindow.YT?.Player
        ) {
          return;
        }

        const states =
          youtubeWindow.YT.PlayerState;

        try {
          const player =
            new youtubeWindow.YT.Player(
              frame,
              {
                playerVars: {
                  autoplay: 1,
                  controls: 0,
                  fs: 0,
                  loop: 1,
                  origin:
                    window.location.origin,
                  playlist:
                    HOME_MUSIC_VIDEO_ID,
                  playsinline: 1,
                  rel: 0,
                },
                events: {
                  onReady: () => {
                    if (cancelled) {
                      return;
                    }

                    player.setVolume?.(64);
                    player.unMute?.();

                    if (
                      musicPlayingRef.current
                    ) {
                      player.playVideo?.();
                    }
                  },

                  onStateChange:
                    (event) => {
                      if (cancelled) {
                        return;
                      }

                      if (
                        event.data ===
                        states.PLAYING
                      ) {
                        setMusicPlaying(
                          true,
                        );
                        return;
                      }

                      if (
                        event.data ===
                        states.ENDED
                      ) {
                        if (
                          musicPlayingRef
                            .current
                        ) {
                          player
                            .playVideo?.();
                        }

                        return;
                      }

                      if (
                        event.data ===
                          states.PAUSED ||
                        event.data ===
                          states.CUED
                      ) {
                        setMusicPlaying(
                          false,
                        );
                      }
                    },

                  onAutoplayBlocked:
                    () => {
                      if (cancelled) {
                        return;
                      }

                      setMusicPlaying(
                        false,
                      );
                    },

                  onError: () => {
                    if (cancelled) {
                      return;
                    }

                    setMusicPlaying(false);
                    setMusicOpen(false);
                  },
                },
              },
            );

          musicPlayer.current =
            player;
        } catch {
          // The iframe can still use
          // its autoplay URL.
        }
      })
      .catch(() => {
        // Keep the iframe available
        // if the API script is blocked.
      });

    return () => {
      cancelled = true;

      musicPlayer.current
        ?.destroy?.();

      musicPlayer.current = null;
    };
  }, [musicOpen]);

  useEffect(() => {
    if (active) return;

    queueMicrotask(() => {
      setMusicOpen(false);
      setMusicPlaying(false);
    });
  }, [active]);

  return {
    musicOpen,
    musicPlaying,
    musicFrame,
    toggleMusic,
    handleMusicFrameLoad,
  };
}
