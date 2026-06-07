# Product Requirements Document: Voxa — Next-Gen AAC Platform

## 1. Executive Summary & Product Vision

**Vision:** To build a revolutionary, cross-platform AAC ecosystem that eliminates clinical and technological friction. This platform will empower non-speaking and minimally speaking individuals by combining rigorously researched linguistic frameworks with cutting-edge artificial intelligence, seamless multi-platform syncing, and universal accessibility.

**Problem Statement:** Current market-leading AAC apps are often siloed on specific operating systems (predominantly iOS), possess steep learning curves that cause device abandonment, lack native support for Gestalt Language Processors, and rely on outdated predictive text mechanisms.

## 2. Platform Architecture & Interoperability

To disrupt the current oligopoly, the platform must prioritize universal access and frictionless data portability.

* **Cross-Platform Availability:** The system must natively support Web, iOS, Android, Windows, and Chromebook environments to close the "Android gap" and make AAC affordable on non-proprietary hardware.
* **Cloud-Based Team Synchronization:** The platform will utilize cloud architecture to allow real-time board editing and usage reporting. This allows SLPs and caregivers to modify vocabulary from their personal devices without taking the primary communication device away from the user.
* **Open-Source Interoperability:** The platform must natively support the import and export of the Open Board Format (`.obf` and `.obz` files). This open-licensed format ensures users are never locked into a walled garden and can migrate their highly customized communication boards (containing personalized pictures and layouts) from other legacy software seamlessly.

## 3. Accessibility & UI/UX Standards (WCAG 2.2)

The physical interface must be designed to accommodate severe motor impairments, involuntary movements, and visual processing deficits.

* **Optimal Touch Targets:** To mitigate "fat-finger" errors and accommodate motor spasticity, all interactive buttons must strictly adhere to WCAG 2.2 Level AA target size minimums. Buttons must be an absolute minimum of 1 cm × 1 cm (0.4 in × 0.4 in) to support adequate kinetic selection time.
* **Pointer Gestures & Interaction Modes:** The UI must eliminate reliance on complex gestures. In compliance with WCAG 2.2 guidelines, single-pointer alternatives must be provided for all dragging or swiping actions.
* **Visual Accommodations:** For users with Cortical Visual Impairment (CVI), the UI must provide high-contrast visual themes, including true black or dark gray backgrounds, to reduce visual fatigue.
* **Alternative Access Integration:** The software must natively interface with mechanical switch-scanning systems and advanced optical eye-tracking hardware. The UI will feature adjustable "dwell times" and magnetic "snap-to-item" target locking to compensate for involuntary eye movements.

## 4. Linguistic Frameworks & Vocabulary Design

The vocabulary architecture must simultaneously serve both analytic and gestalt language development paradigms.

* **Motor Planning Consistency:** The core vocabulary grid must enforce immutable button placement to build automaticity. Consistent physical locations for core words reduce the cognitive load of visual scanning, allowing users to rely on rapid muscle memory.
* **Native Gestalt Language Processing (GLP) Support:** Moving beyond single-word analytic building blocks, the platform must allow for the storage of whole, intonationally rich phrase chunks. To support early-stage GLPs, the system must allow video linking and the use of custom recorded human speech (rather than synthesized voices) for specific buttons, as GLPs often attach intense meaning to specific melodic intonations.
* **Standardized Color Coding:** The platform will natively implement the Modified Fitzgerald Key to help users visually map grammatical structures. This standard assigns Blue to Adjectives, Green to Verbs, Yellow to Pronouns, Orange to Nouns, Pink to Prepositions/Social words, and White to Conjunctions.

## 5. Next-Generation Artificial Intelligence Features

The platform will utilize machine learning and generative AI to significantly increase communication speed and expressive authenticity.

* **LLM-Powered Predictive Text:** Traditional AAC relies on basic n-gram prediction. This platform will integrate advanced Large Language Models (LLMs) to correct input and predict subsequent words or whole sentences based on deep conversational context. Crucially, the LLM will be trained to reflect the user's specific communication style, saving physical effort while preserving their unique voice.
* **PictoBERT Integration:** For symbol-based communicators, the system will utilize Transformer-based models (such as PictoBERT) to accurately predict the next logical pictogram in a sequence. By fine-tuning these models to individual user patterns, the app will dynamically surface relevant vocabulary based on context, drastically reducing the time spent navigating folders.
* **Generative AI for Symbol Creation:** Caregivers frequently waste hours searching for relevant icons. The platform will include an AI image generation tool equipped with strict safety guardrails. Users can input a descriptive text prompt or upload a reference picture, and the AI will instantly generate up to four tailored, style-matching symbols for a new button.
* **Bilingual Code-Switching & Neural Voices:** The platform will utilize advanced neural text-to-speech engines (similar to Acapela Neural Voices) to provide high-quality, regionally accurate dialects. The software must support true bilingual profiles, allowing a user to seamlessly switch between two languages (e.g., English and North American Spanish) mid-sentence, with the AI dynamically adjusting the phonetic pronunciation rules for each respective word.
