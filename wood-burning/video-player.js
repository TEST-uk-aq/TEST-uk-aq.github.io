// Custom player UI for the shared public UK AQ Black Carbon video.
// The local WebVTT remains the canonical timing/content source. We display its
// cue text in one consistent overlay rather than browser-specific cue fragments.
const frame = document.querySelector("#wood-video-frame");
const video = document.querySelector("#wood-video");
const playButton = document.querySelector("#wood-video-play");
const soundButton = document.querySelector("#wood-video-sound");
const volumeSlider = document.querySelector("#wood-video-volume");
const progress = document.querySelector("#wood-video-progress");
const timeLabel = document.querySelector("#wood-video-time");
const captionsButton = document.querySelector("#wood-video-cc");
const fullscreenButton = document.querySelector("#wood-video-fullscreen");
const captionsElement = document.querySelector("#wood-video-captions");
const captionPanel = document.querySelector("#wood-video-subtitles");
const status = document.querySelector("#wood-video-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const noHover = matchMedia("(hover: none)");
const preferNativeOnIPhone = /iPhone|iPod/i.test(navigator.userAgent)
  && typeof video?.webkitEnterFullscreen === "function";
const controls = frame?.querySelector(".wb-video-controls");

if (frame && video && controls && playButton && soundButton && volumeSlider && progress &&
    timeLabel && captionsButton && fullscreenButton && captionsElement && captionPanel && status) {
  const track = captionsElement.track;
  let captionsEnabled = true;
  let nativeFullscreen = false;
  let captionsAvailable = true;
  let nativeCaptionsElement = null;
  let touchVideoTap = false;
  let scrubbing = false;
  let hideControlsTimer = null;
  const CONTROLS_IDLE_MS = 4500;

  const cancelControlsTimer = () => {
    if (hideControlsTimer !== null) clearTimeout(hideControlsTimer);
    hideControlsTimer = null;
  };
  const hideControls = () => {
    cancelControlsTimer();
    frame.classList.remove("is-controls-visible");
  };
  const scheduleControlsHide = () => {
    cancelControlsTimer();
    hideControlsTimer = setTimeout(() => {
      hideControlsTimer = null;
      if (scrubbing) {
        scheduleControlsHide();
        return;
      }
      frame.classList.remove("is-controls-visible");
    }, CONTROLS_IDLE_MS);
  };
  const showControls = () => {
    frame.classList.add("is-controls-visible");
    scheduleControlsHide();
  };

  const setStatus = (message) => {
    status.textContent = message;
    status.hidden = !message;
  };

  const timeText = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const value = Math.floor(seconds);
    return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
  };

  const syncPlayback = () => {
    const playing = !video.paused && !video.ended;
    playButton.dataset.state = playing ? "playing" : "paused";
    playButton.setAttribute("aria-label", playing ? "Pause video" : "Play video");
    playButton.setAttribute("title", playing ? "Pause" : "Play");
    playButton.setAttribute("aria-pressed", String(playing));
  };

  const syncVolume = () => {
    const muted = video.muted || video.volume === 0;
    soundButton.dataset.muted = String(muted);
    soundButton.setAttribute("aria-label", muted ? "Unmute video" : "Mute video");
    soundButton.setAttribute("title", muted ? "Unmute" : "Mute");
    soundButton.setAttribute("aria-pressed", String(!muted));
    volumeSlider.value = String(Math.round(video.volume * 100));
    volumeSlider.setAttribute("aria-valuetext", Math.round(video.volume * 100) + " per cent" + (muted ? ", muted" : ""));
  };

  const syncTimeline = () => {
    const duration = video.duration;
    const available = Number.isFinite(duration) && duration > 0;
    progress.disabled = !available;
    const fraction = available ? Math.min(1, Math.max(0, video.currentTime / duration)) : 0;
    progress.value = String(Math.round(fraction * 1000));
    progress.style.setProperty("--wb-video-progress", (fraction * 100) + "%");
    progress.setAttribute("aria-valuetext", timeText(video.currentTime) + " of " + timeText(available ? duration : 0));
    timeLabel.textContent = timeText(video.currentTime) + " / " + timeText(available ? duration : 0);
  };

  const renderCaptions = () => {
    const cues = track.activeCues;
    const cue = cues && cues.length ? cues[0] : null;
    if (!captionsEnabled || !captionsAvailable || nativeFullscreen ||
        video.webkitDisplayingFullscreen === true || document.fullscreenElement === video || !cue) {
      captionPanel.hidden = true;
      captionPanel.textContent = "";
      return;
    }
    // A text-only conversion prevents source markup from becoming page HTML.
    const text = typeof cue.getCueAsHTML === "function"
      ? cue.getCueAsHTML().textContent
      : String(cue.text || "").replace(/<[^>]*>/g, "");
    captionPanel.textContent = String(text || "").trim();
    captionPanel.hidden = !captionPanel.textContent;
  };

  const syncNativeCaptions = () => {
    // The metadata track supplies the inline cues but can NEVER be painted.
    // A separate subtitles track exists only in browser-owned native fullscreen.
    if (!nativeFullscreen || !captionsEnabled || !captionsAvailable) {
      if (nativeCaptionsElement) {
        nativeCaptionsElement.track.mode = "disabled";
        nativeCaptionsElement.remove();
        nativeCaptionsElement = null;
      }
      return;
    }
    if (nativeCaptionsElement) return;
    const element = document.createElement("track");
    element.kind = "subtitles";
    element.srclang = "en";
    element.label = "English subtitles";
    element.src = captionsElement.getAttribute("src");
    element.default = true;
    nativeCaptionsElement = element;
    video.append(element);
    const enableNativeCues = () => {
      if (nativeFullscreen && captionsEnabled && captionsAvailable &&
          nativeCaptionsElement === element) element.track.mode = "showing";
    };
    element.addEventListener("load", enableNativeCues);
    enableNativeCues();
  };

  const syncCaptions = () => {
    // Always suppress our custom box when the browser owns video fullscreen.
    frame.classList.toggle("is-native-fullscreen", nativeFullscreen);
    // Metadata cues are active but never natively drawn in inline playback.
    track.mode = "hidden";
    syncNativeCaptions();
    captionsButton.setAttribute("aria-pressed", String(captionsEnabled && captionsAvailable));
    captionsButton.setAttribute("aria-label", captionsEnabled && captionsAvailable ? "Turn subtitles off" : "Turn subtitles on");
    captionsButton.setAttribute("title", captionsEnabled && captionsAvailable ? "Subtitles on" : "Subtitles off");
    captionsButton.disabled = !captionsAvailable;
    renderCaptions();
  };

  const syncFullscreen = () => {
    const isFullscreen = document.fullscreenElement === frame || nativeFullscreen;
    fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit full screen" : "Enter full screen");
    fullscreenButton.setAttribute("title", isFullscreen ? "Exit full screen" : "Full screen");
    fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
  };

  const togglePlayback = async () => {
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
      setStatus("");
    } catch (_error) {
      setStatus("The video could not start. Please try again.");
      syncPlayback();
    }
  };

  video.muted = true;
  video.volume = 0.7;
  video.controls = false;
  syncPlayback();
  syncVolume();
  syncTimeline();
  syncCaptions();
  syncFullscreen();

  video.addEventListener("play", () => { setStatus(""); syncPlayback(); });
  video.addEventListener("pause", syncPlayback);
  video.addEventListener("ended", () => { syncPlayback(); syncTimeline(); });
  video.addEventListener("loadedmetadata", syncTimeline);
  video.addEventListener("durationchange", syncTimeline);
  video.addEventListener("timeupdate", () => { syncTimeline(); renderCaptions(); });
  video.addEventListener("seeked", () => { syncTimeline(); renderCaptions(); });
  video.addEventListener("volumechange", syncVolume);
  video.addEventListener("error", () => {
    setStatus("The video could not be loaded. Please try again later.");
    syncPlayback();
  });
  track.addEventListener("cuechange", renderCaptions);
  captionsElement.addEventListener("load", () => {
    captionsAvailable = true;
    syncCaptions();
  });
  captionsElement.addEventListener("error", () => {
    captionsAvailable = false;
    syncCaptions();
    captionsButton.setAttribute("aria-label", "Subtitles unavailable");
    captionsButton.setAttribute("title", "Subtitles unavailable");
    setStatus("Subtitles could not be loaded.");
  });

  playButton.addEventListener("click", togglePlayback);

  // On a touchscreen, tapping the picture toggles the overlay, not playback.
  // Touch users can then operate the conventional Play/Pause button.
  video.addEventListener("pointerdown", (event) => {
    touchVideoTap = event.pointerType === "touch" || event.pointerType === "pen";
  });
  video.addEventListener("click", () => {
    if (touchVideoTap || noHover.matches) {
      touchVideoTap = false;
      if (frame.classList.contains("is-controls-visible")) hideControls();
      else showControls();
    } else {
      togglePlayback();
    }
  });
  // Keep controls available after a touch, including volume and seek changes.
  controls.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen" || noHover.matches) {
      showControls();
    }
  });
  controls.addEventListener("input", () => {
    if (noHover.matches || frame.classList.contains("is-controls-visible")) showControls();
  });
  controls.addEventListener("click", () => {
    if (noHover.matches || frame.classList.contains("is-controls-visible")) showControls();
  });
  progress.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen" || noHover.matches) {
      scrubbing = true;
      showControls();
    }
  });
  for (const eventName of ["pointerup", "pointercancel"]) {
    document.addEventListener(eventName, () => {
      if (!scrubbing) return;
      scrubbing = false;
      scheduleControlsHide();
    });
  }
  document.addEventListener("pointerdown", (event) => {
    if ((event.pointerType === "touch" || event.pointerType === "pen") &&
        !frame.contains(event.target)) hideControls();
  });

  soundButton.addEventListener("click", () => {
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = 0.7;
      video.muted = false;
    } else {
      video.muted = true;
    }
    syncVolume();
  });
  volumeSlider.addEventListener("input", () => {
    const value = Math.max(0, Math.min(100, Number(volumeSlider.value) || 0));
    video.volume = value / 100;
    video.muted = value === 0;
    syncVolume();
  });
  progress.addEventListener("input", () => {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    video.currentTime = Math.min(duration, Math.max(0, Number(progress.value) / 1000 * duration));
    syncTimeline();
    renderCaptions();
  });
  captionsButton.addEventListener("click", () => {
    if (!captionsAvailable) return;
    captionsEnabled = !captionsEnabled;
    syncCaptions();
  });

  const enterNativeFullscreen = () => {
    // Hide the custom panel before handing the picture to iOS native video UI.
    nativeFullscreen = true;
    syncCaptions();
    try {
      video.webkitEnterFullscreen();
    } catch (error) {
      nativeFullscreen = false;
      syncCaptions();
      throw error;
    }
  };

  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement === frame) {
      try { await document.exitFullscreen(); } catch (_error) { setStatus("Could not exit full screen."); }
      return;
    }
    if (nativeFullscreen) {
      if (typeof video.webkitExitFullscreen === "function") video.webkitExitFullscreen();
      return;
    }
    try {
      if (preferNativeOnIPhone) {
        enterNativeFullscreen();
      } else if (typeof frame.requestFullscreen === "function") {
        await frame.requestFullscreen();
      } else if (typeof video.webkitEnterFullscreen === "function") {
        enterNativeFullscreen();
      } else {
        setStatus("Full screen is not supported by this browser.");
      }
    } catch (_error) {
      if (typeof video.webkitEnterFullscreen === "function") {
        try { enterNativeFullscreen(); }
        catch (_fallbackError) { setStatus("Full screen could not be opened."); }
      } else {
        setStatus("Full screen could not be opened.");
      }
    }
    syncFullscreen();
  });

  document.addEventListener("fullscreenchange", () => {
    // Handle platforms that report fullscreen on the video rather than the frame.
    if (document.fullscreenElement === video) nativeFullscreen = true;
    else if (!document.fullscreenElement && video.webkitDisplayingFullscreen !== true) nativeFullscreen = false;
    syncCaptions();
    syncFullscreen();
  });
  video.addEventListener("webkitbeginfullscreen", () => {
    nativeFullscreen = true;
    syncCaptions();
    syncFullscreen();
  });
  video.addEventListener("webkitendfullscreen", () => {
    nativeFullscreen = false;
    syncCaptions();
    syncFullscreen();
  });

  // Never autoplay an endlessly looping animation when reduced motion is requested.
  // Explicit Play still works, including after a runtime preference change.
  reducedMotion.addEventListener?.("change", (event) => {
    if (event.matches && !video.paused) video.pause();
  });
  if (!reducedMotion.matches) video.play().catch(syncPlayback);
}
