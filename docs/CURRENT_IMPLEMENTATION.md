# Current Implementation Status

This document outlines the architectural components and features implemented in the Maize Advisory project up to the current stage.

## 1. Knowledge Base and Data Layer
*   **Rulepacks:** Deterministic agronomic rules are defined in YAML format under `knowledge/rulepacks/`. Current rulepacks cover irrigation, pest management (Fall Armyworm), fertilizer dosing, and sowing windows.
*   **Compilation Pipeline:** The `scripts/build-kb.ts` script validates the YAML files against Zod schemas and compiles them into a single static TypeScript object (`packages/core/src/knowledge_compiled.ts`). This ensures the app can access rule data synchronously in the browser without filesystem dependencies.

## 2. Core Reasoning Engine
*   **Rule Evaluation:** The `RuleEngine` (`packages/core/src/reasoning/rules.ts`) accepts structured intents and state features (crop stage, soil type, weather). It iterates over the compiled rulepacks to find matching conditions based on thresholds (e.g., soil moisture depletion limits).
*   **Structured Output:** Instead of outputting text, the engine produces strict `Advisory` objects comprising a headline, discrete facts (e.g., treatment threshold, recommended dose), and cautions.

## 3. Natural Language Understanding (NLU) Pipeline
*   **Hybrid Architecture:** The intent classification layer (`packages/core/src/nlu/inference.ts`) operates on a hybrid model.
*   **Cloud LLM Extraction:** Primary intent and slot extraction is routed to a Groq API model instructed to return strict JSON matching the defined intent taxonomy.
*   **Local Fallback:** If the network request fails, the system degrades gracefully to a local keyword-matching heuristic (`mockPredict`) to guarantee offline resilience.
*   **Script Routing:** Romanized Kannada utterances are detected and transliterated before intent classification.

## 4. Application UI and Expression
*   **Tech Stack:** React 18 frontend built via Vite, configured as a Progressive Web App (PWA).
*   **Design System:** Styling relies strictly on native CSS custom properties (`tokens.css`, `card.css`, `base.css`) without CSS-in-JS or external frameworks.
*   **Advisory Rendering:** The UI utilizes an `AdvisoryCard` component to deterministically render the structured output from the Rule Engine. 
*   **Speech Input:** Integrated Web Speech API enables voice capture with dynamic language toggling between English and Kannada.

## 5. Generative Chat Integration
*   **Contextual Overrides:** A Groq LLM service (`packages/app/src/llm.ts`) operates alongside the deterministic rule engine. 
*   **Grounded Responses:** The LLM receives the structured output from the Rule Engine (or retrieved text from datasets) as a strict agronomic context. It generates a conversational markdown response grounded entirely in the provided facts.
*   **General Knowledge Fallback:** If the user query falls outside the scope of the local datasets and rule engine, the LLM falls back to standard agronomic knowledge to maintain conversational continuity.
*   **Markdown Parsing:** A custom React markdown parser renders the LLM text output dynamically above the deterministic UI cards.
