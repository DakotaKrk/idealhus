# MediaPipe Tasks Vision (lokal kopia)

- Paket: @mediapipe/tasks-vision 1.1.1 från npm (licens Apache-2.0), hämtat 2026-10-29.
- Filer: vision_bundle.mjs, wasm/vision_wasm_internal.js och .wasm (SIMD-varianten).
- Modell: modell/selfie_segmenter.tflite (float16) från storage.googleapis.com/mediapipe-models.
- Används av samtal.js för bakgrundsoskärpa och bakgrundsbild i videomöten. Allt körs lokalt i webbläsaren –
  ingen bild skickas någonstans.
