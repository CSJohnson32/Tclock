Drop your hero background video clips in this folder using these exact filenames:

  hero-1.mp4
  hero-2.mp4
  hero-3.mp4

The hero section cycles through them automatically, crossfading every 7 seconds.

Tips before uploading:
- Trim each clip to a short, seamless loop (5-15 seconds works well).
- Resize to 1920x1080 (or 1280x720 for smaller file size) — Pexels downloads are
  often larger than needed for a background video.
- Strip the audio track since the videos play muted anyway:
    ffmpeg -i input.mp4 -an -vf scale=1920:-2 -crf 28 hero-1.mp4
- Aim for under ~3-5MB per clip so the hero loads quickly on mobile/slow connections.

Want more or fewer clips? Add/remove <video> elements in the .hero__bg block in
index.html (matching filenames), the JS slideshow in script.js will automatically
pick up however many .hero__video elements exist.
