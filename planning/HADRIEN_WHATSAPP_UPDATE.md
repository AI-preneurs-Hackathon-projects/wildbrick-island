# WhatsApp draft for Hadrien

Not sent. Ready for Yerzhan to copy after the main push is verified.

Hey Hadrien! Your camera branch is merged into main, including R/F and the on-screen hints. We resolved the UI conflicts while keeping the new voice controls. You can git pull --ff-only when your checkout is clean.

We also fixed recorded voice so it checks server setup before asking for the mic—no more recording an idea just to discover the service is disabled. Full tests/build pass, plus local rendered camera, voice-fallback and combat checks.

Next on our side: creator-account voice activation/testing, then visible hotkeys and five recent creations with 1–5 shortcuts. We’ll be touching input, bindings, UI and creation-history files, so please coordinate before editing those. If you’re free, real two-player combat/flight QA would help: moving + shooting, Down/G/T, R/F, and old versus rebuilt equipment. Send us any repros before changing the combat pipeline.

These latest changes are pushed to GitHub; they’re not deployed to the creator site yet. We’ll coordinate the next release after the remaining live checks.
