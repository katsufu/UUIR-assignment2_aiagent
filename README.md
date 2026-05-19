---
title: Ukrainian Creative Writing Agent
emoji: ✒️
colorFrom: purple
colorTo: blue
sdk: docker
pinned: false
---

# ✒️ Ukrainian Creative Writing Agent (C2 Proficiency)

[![TypeScript Built](https://img.shields.io/badge/Language-TypeScript-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![UI Premium](https://img.shields.io/badge/Interface-Glassmorphism_Web_GUI-success.svg?style=flat-square)](https://huggingface.co/spaces/katsufu/ukrainian-writing-agent)
[![Powered by Berget AI](https://img.shields.io/badge/AI_Engine-Berget_AI_%2F_Llama_3-purple.svg?style=flat-square)](https://berget.ai/)

Welcome to the **Ukrainian Creative Writing Agent** — an elite, highly interactive AI co-pilot designed to elevate Ukrainian literary composition, classical poetic mimicry, and dynamic register localization to native **C2 proficiency standards**.

---

## ✨ Experience the Magic

Whether you are a poet, translator, or language enthusiast, this application acts as your ultimate creative collaborator:

*   **🎨 Stunning Web Application**: Immerse yourself in a state-of-the-art interface featuring smooth glassmorphism, responsive ambient backdrops, and an interactive trace timeline showing you exactly how the AI thinks, critiques, and perfects its output.
*   **💡 Real-Time Proofread Highlighting**: Watch your poetry transform! The system dynamically compares its initial creative draft against the polished final result, illuminating all classical refinements and purified terminology in **vibrant glowing Cyan**.
*   **🔄 Dynamic Stylistic Control**: Freely mix and match eras and styles. Transform modern internet slang into the classical cadence of *Taras Shevchenko*, or rewrite classical verses into *Lviv Hvara (Batiar Slang)*.
*   **🔊 Interactive Text-To-Speech (TTS)**: Listen to the AI's poetic creations with native Ukrainian pronunciation. The UI dynamically highlights each word karaoke-style as it's spoken.
*   **🗣️ Phonetic Guidance**: Beyond just writing text, the AI provides explicit phonetic rules, stress marks (наголос), and rhythmic breakdowns for perfect oral delivery.

---

## ⚙️ Under the Hood (For Developers)

Built upon the highly elegant **"Your Agent"** blueprint, the system decouples the core decision loop from specific writing skills, allowing seamless expansion:

```text
┌────────────────────────────────────────────────────────┐
│                   Web Application GUI                  │
│  (Dynamic Dropdowns, TTS Karaoke, Light Linen Theme)   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST /api/generate
┌───────────────────────────▼────────────────────────────┐
│                    Agent Core Engine                   │
│   Iterative Loop: Draft ➔ Tool Call ➔ Critique ➔ Refine│
└──────┬──────────────────────────────────────────┬──────┘
       │ Loads Instructions                       │ Calls Actions
┌──────▼────────────────────┐              ┌──────▼────────────────────┐
│     Stateless Skills      │              │      External Tools       │
│  • stylistic_shift        │              │  • synonym_lookup         │
│  • rhyme_and_rhythm       │              │  • etymology_check        │
│                           │              │  • reference_ukrlib       │
└───────────────────────────┘              └───────────────────────────┘
```

---

## 📚 Documentation
For developers and technical reviewers, detailed documentation is available in the `docs/` directory:
- [System Architecture Guide](docs/architecture_guide_en.md)

---

## 📄 License & Credits
Released under the MIT License. Powered by Llama 3 models via Berget AI serverless inference endpoints.
