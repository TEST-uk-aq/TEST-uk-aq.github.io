// Video controls are deliberately independent of Black Carbon data/chart loading.
// The versioned MP4 is a shared public editorial asset for TEST and LIVE.
const video = document.querySelector("#wood-video");
const playButton = document.querySelector("#wood-video-play");
const soundButton = document.querySelector("#wood-video-sound");
const captionsButton = document.querySelector("#wood-video-cc");
const captionsElement = document.querySelector("#wood-video-captions");
const status = document.querySelector("#wood-video-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (video && playButton && soundButton && captionsButton && captionsElement && status) {
  let captionsEnabled = true;

  const setStatus = (message) => {
    status.textContent = message;
    status.hidden = !message;
  };
  const updatePlay = () => {
    const playing = !video.paused && !video.ended;
    playButton.textContent = playing ? "Pause" : "Play";
    playButton.setAttribute("aria-label", playing ? "Pause video" : "Play video");
    playButton.setAttribute("aria-pressed", String(playing));
  };
  const updateSound = () => {
    const audible = !video.muted;
    soundButton.textContent = audible ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-label", audible ? "Mute video" : "Unmute video");
    soundButton.setAttribute("aria-pressed", String(audible));
  };
  const updateCaptions = () => {
    const track = captionsElement.track || video.textTracks?.[0];
    if (track) track.mode = captionsEnabled ? "showing" : "disabled";
    captionsButton.textContent = captionsEnabled ? "CC on" : "CC off";
    captionsButton.setAttribute("aria-label", captionsEnabled ? "Turn subtitles off" : "Turn subtitles on");
    captionsButton.setAttribute("aria-pressed", String(captionsEnabled));
  };

  video.muted = true;
  updatePlay();
  updateSound();
  updateCaptions();

  video.addEventListener("play", () => {
    setStatus("");
    updatePlay();
  });
  video.addEventListener("pause", updatePlay);
  video.addEventListener("ended", updatePlay);
  video.addEventListener("volumechange", updateSound);
  video.addEventListener("error", () => {
    setStatus("The video could not be loaded. Please try again later.");
    updatePlay();
  });
  captionsElement.addEventListener("load", updateCaptions);
  captionsElement.addEventListener("error", () => {
    captionsEnabled = false;
    updateCaptions();
    captionsButton.disabled = true;
    captionsButton.setAttribute("aria-label", "Subtitles unavailable");
    captionsButton.textContent = "CC unavailable";
    setStatus("Subtitles could not be loaded.");
  });

  playButton.addEventListener("click", async () => {
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
    } catch (_error) {
      setStatus("This browser could not start the video. Please try again.");
      updatePlay();
    }
  });
  soundButton.addEventListener("click", () => {
    video.muted = !video.muted;
    updateSound();
  });
  captionsButton.addEventListener("click", () => {
    if (captionsButton.disabled) return;
    captionsEnabled = !captionsEnabled;
    updateCaptions();
  });

  // Never auto-run a looping animation when reduced motion is requested.
  // Explicit Play remains available with the video visible and poster intact.
  reducedMotion.addEventListener?.("change", (event) => {
    if (event.matches && !video.paused) video.pause();
  });
  if (!reducedMotion.matches) {
    // Muted playback is generally allowed; Play remains available if blocked.
    video.play().catch(updatePlay);
  }
}
