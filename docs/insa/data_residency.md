# INSA Data Residency Compliance

**Reference:** Information Network Security Administration (INSA) - Data Residency and Sovereignty Guidelines

## Overview
Markova AI Call Center processes sensitive voice data and user interactions. To comply with INSA data sovereignty regulations, the platform operates in a specialized `DATA_RESIDENCY_MODE`.

## Enforcement Mechanisms
1. **STT Provider Locking**: When `DATA_RESIDENCY_MODE=true`, the system forcibly locks the Speech-to-Text (STT) provider to the domestic `hasab_ai` (Addis Ababa datacenter). External APIs (OpenAI Whisper, Deepgram, Groq) are bypassed.
2. **Local TTS Synthesis**: Text-to-Speech (TTS) for Amharic defaults to `addisai`, ensuring no voice synthesis workloads are processed outside Ethiopian sovereign territory.
3. **Database Residency**: The primary PostgreSQL and Redis clusters are hosted on local infrastructure (or compliant INSA-approved domestic cloud zones).

## Verification
Any violation of the `DATA_RESIDENCY_MODE` triggers an immediate system-level alert (`DATA_RESIDENCY_VIOLATION`) and falls back to local processing or aborts the request.
