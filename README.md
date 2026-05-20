---
title: Ukrainian Creative Writing Agent
emoji: ✒️
colorFrom: blue
colorTo: yellow
sdk: docker
pinned: false
---

# ✒️ Ukrainian Creative Writing Agent (C2 Proficiency)

[![TypeScript Built](https://img.shields.io/badge/Language-TypeScript-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![UI Premium](https://img.shields.io/badge/Interface-Glassmorphism_Web_GUI-success.svg?style=flat-square)](https://huggingface.co/spaces/katsufu/ukrainian-writing-agent)
[![Powered by Berget AI](https://img.shields.io/badge/AI_Engine-Berget_AI_%2F_Llama_3-purple.svg?style=flat-square)](https://berget.ai/)

Welcome to the **Ukrainian Creative Writing Agent** — an elite, highly interactive AI co-pilot designed to elevate Ukrainian literary composition, classical poetic mimicry, and dynamic register localization to native **C2 proficiency standards**.

---

## ✨ Premium Features & User Experience

Whether you are a writer, poet, or language researcher, this application acts as your ultimate creative collaborator:

*   **✨ Redesigned Tabbed Switcher (Free-form vs. Preset Template)**:
    *   **Free-form Agent Mode (Default)**: Enter any custom creative prompt in English or Ukrainian! The agent dynamically plans, consults libraries, drafts, self-critiques, and refines the text to match your specific instructions.
    *   **Preset Template Mode**: Access structured dropdown inputs to map transformations across specific eras, styles, and authors (e.g. internet slang to *Taras Shevchenko*, or neoromantic verse to *Lesya Ukrainka*).
*   **🧠 Low-Cost Personalized Session Memory (Linguistic Profile)**:
    *   Dynamically builds a compact, secure, and private style profile in your browser's `localStorage` based on your generation history.
    *   Capped at a strict **450 characters (only ~90 tokens)** to maintain perfect style continuity across subsequent runs while adding practically **zero overhead** to your API token bills!
*   **🔄 Real-time Server-Sent Events (SSE) Streaming**:
    *   Watch the AI's thoughts unfold live! The UI streams the agent's multi-step execution loop—including context discovery, dictionary lookups, self-critique, and refinements—in real time.
*   **🔊 Perfect Text-To-Speech (TTS) Proxy**:
    *   Listen to creations spoken with native Ukrainian accents. 
    *   Uses an Express-based server-side TTS proxy (`/api/tts-proxy`) that bypasses client-side CORS blocks and local operating system voice package limitations.
    *   Features high-fidelity, real-time **Karaoke-style subtitle highlights** matching the spoken voice word-by-word.
*   **📚 Multi-Style Polishing**:
    *   Expands capabilities beyond classical poetry to polish business prose, everyday conversational dialogue, and strict metrical structures.
    *   Features intelligent programmatic post-processing to eliminate Russianisms and calques (e.g. automatically standardizing "вжити міри" to "вжити заходів" for C2 compliance).
*   **🎨 Stunning Glassmorphic Web GUI**:
    *   Features modern, curated linen-beige aesthetics, floating ambient glowing background coordinates, and interactive developer trace drawers showing raw JSON payloads.

---

## ⚙️ Architectural Block Diagram

Built upon the highly elegant **"Your Agent"** blueprint, the system decouples the core decision loop from specific writing skills and local resources, allowing high-performance stateless execution:

```text
┌────────────────────────────────────────────────────────┐
│                   Web Application GUI                  │
│  (Tab Switcher, Live SSE Timeline, TTS Karaoke Player) │
└───────────────────────────┬────────────────────────────┘
                            │ GET /api/generate-stream?prompt=...&userMemory=...
┌───────────────────────────▼────────────────────────────┐
│                    Agent Core Engine                   │
│   Iterative Loop: Draft ➔ Tool Call ➔ Critique ➔ Refine│
│   (Injects compressed User Linguistic Profile Memory)  │
└──────┬──────────────────────────────────────────┬──────┘
       │ Loads Instructions                       │ Calls Actions
┌──────▼────────────────────┐              ┌──────▼────────────────────┐
│     Stateless Skills      │              │      External Tools       │
│  • custom_task [NEW]      │              │  • synonym_lookup         │
│  • stylistic_shift        │              │  • etymology_check        │
│  • rhyme_and_rhythm       │              │  • reference_ukrlib       │
└───────────────────────────┘              └───────────────────────────┘
```

---

## 💓 Secure Diagnostic Heartbeat

To ensure highly reliable deployments in production environments like **Hugging Face Spaces**, the server exposes a secure `/api/heartbeat` GET diagnostic health-check endpoint:
*   **Zero-Leak Safety**: Evaluates environment variables (like `BERGET_API_KEY`) and critical local filesystem resources (skills folder integrity) strictly in-memory without ever returning sensitive keys or passwords.
*   **Zero-Cost Integrity**: Checks configuration status locally without calling third-party LLM APIs, avoiding API usage fees during recurring container health-check probes.

---

## 📚 Technical Documentation

Detailed deep dives are available inside the `docs/` directory:
- [System Architecture Guide](docs/architecture_guide_en.md) - Core system design, SSE streaming protocols, and secure proxy integrations.

---

## 📄 License & Credits

Released under the MIT License. Powered by Llama 3 models via Berget AI serverless inference endpoints.
