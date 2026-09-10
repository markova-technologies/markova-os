/**
 * Hexagon Architecture Voice & Model Registry for Markova OS
 * Single source of truth for all TTS engines, LLM cores, and STT pipelines.
 */

export const VOICE_PROVIDERS = {
  edge_tts: {
    id: 'edge_tts',
    name: 'Edge TTS (Amharic Native Core)',
    badge: 'Free / Built-in',
    tag: 'Primary Native',
    description: 'Ultra low-latency primary neural voice engine with native Ethiopian phonetic accuracy.',
    voices: [
      { id: 'am-ET-MekdesNeural', name: 'Mekdes (Female)', gender: 'female', lang: 'am-ET', flag: '🇪🇹', tag: 'Amharic Primary', recommended: true },
      { id: 'am-ET-AmehaNeural', name: 'Ameha (Male)', gender: 'male', lang: 'am-ET', flag: '🇪🇹', tag: 'Amharic Secondary' },
      { id: 'en-US-AriaNeural', name: 'Aria (English Female)', gender: 'female', lang: 'en-US', flag: '🇺🇸', tag: 'English Bilingual' },
      { id: 'en-US-GuyNeural', name: 'Guy (English Male)', gender: 'male', lang: 'en-US', flag: '🇺🇸', tag: 'English Bilingual' }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI TTS (Quality Fallback)',
    badge: 'Cloud HD',
    tag: 'Studio Fallback',
    description: 'High-definition expressive voices for multilingual and English interactions.',
    voices: [
      { id: 'alloy', name: 'Alloy', gender: 'neutral', lang: 'multi', flag: '🌐', tag: 'Balanced Tone' },
      { id: 'echo', name: 'Echo', gender: 'male', lang: 'multi', flag: '🌐', tag: 'Deep Resonant' },
      { id: 'fable', name: 'Fable', gender: 'male', lang: 'multi', flag: '🇬🇧', tag: 'British Expressive' },
      { id: 'onyx', name: 'Onyx', gender: 'male', lang: 'multi', flag: '🌐', tag: 'Authoritative' },
      { id: 'nova', name: 'Nova', gender: 'female', lang: 'multi', flag: '🌐', tag: 'Warm & Friendly' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female', lang: 'multi', flag: '🌐', tag: 'Clear & Bright' }
    ]
  },
  azure: {
    id: 'azure',
    name: 'Azure Speech Services (Enterprise)',
    badge: 'Enterprise SLA',
    tag: 'Telecom Grade',
    description: 'Microsoft Cognitive Services with high fidelity Amharic acoustic neural models.',
    voices: [
      { id: 'am-ET-MekdesNeural', name: 'Mekdes (Neural Studio)', gender: 'female', lang: 'am-ET', flag: '🇪🇹', tag: 'Studio Quality' },
      { id: 'am-ET-AmehaNeural', name: 'Ameha (Neural Studio)', gender: 'male', lang: 'am-ET', flag: '🇪🇹', tag: 'Studio Quality' }
    ]
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs Multilingual',
    badge: 'Hyper-Realistic',
    tag: 'Expressive Tone',
    description: 'Lifelike emotive cadences with rich human intonation.',
    voices: [
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', lang: 'en-US', flag: '🇺🇸', tag: 'Calm Professional' },
      { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew', gender: 'male', lang: 'en-US', flag: '🇺🇸', tag: 'News Anchor' },
      { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'male', lang: 'en-US', flag: '🇺🇸', tag: 'Conversational' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', lang: 'en-US', flag: '🇺🇸', tag: 'Friendly Empathic' }
    ]
  }
};

export const MODEL_PROVIDERS = {
  groq: {
    id: 'groq',
    name: 'Groq LPU Engine',
    badge: '⚡ Ultra-Low Latency (<150ms)',
    recommended: true,
    description: 'LPUs engineered for near-zero latency phone conversations. Amharic LLM optimized.',
    models: [
      { id: 'groq/compound-mini', name: 'Compound Mini', speed: '<120ms', quality: 'Speed Champion', recommended: true, badge: '🚀 Instant Amharic Turns' },
      { id: 'groq/compound', name: 'Groq Compound', speed: '<200ms', quality: 'Top Quality', badge: '⚡ High Accuracy' },
      { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', speed: '~250ms', quality: 'Deep Multilingual', badge: '🌍 Multilingual Depth' }
    ]
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: '📊 Native Amharic Fluency',
    description: 'High-accuracy Ethiopian dialect comprehension and conversational reasoning.',
    models: [
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', speed: '~250ms', quality: 'Flawless Amharic', recommended: true, badge: '⭐ Native Fluency' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', speed: '~280ms', quality: 'Next-Gen Flash', badge: '🧠 Smart Reasoning' }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI GPT Series',
    badge: '🧠 High Reasoning',
    description: 'Industry-standard reasoning and broad domain general intelligence.',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', speed: '~350ms', quality: 'High Efficiency', badge: '🎯 Balanced Performance' },
      { id: 'gpt-4o', name: 'GPT-4o Omni', speed: '~600ms', quality: 'Maximum Intelligence', badge: '🧠 Flagship Model' }
    ]
  }
};

export const STT_PROVIDERS = [
  {
    id: 'elevenlabs_scribe',
    name: 'ElevenLabs Scribe v2',
    latency: '<180ms',
    badge: '🏆 Benchmark Winner (63.5% WER)',
    recommended: true,
    description: 'Tested and proven lowest word-error-rate for spoken Amharic dialects and noisy phone lines.'
  },
  {
    id: 'groq_whisper',
    name: 'Groq Whisper-large-v3',
    latency: '<100ms',
    badge: '⚡ Sub-100ms Fast Fallback',
    recommended: false,
    description: 'Hardware accelerated Whisper running on Groq LPUs for rapid phonetic capture.'
  }
];
