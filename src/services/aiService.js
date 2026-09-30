/**
 * AI service — wraps whichever LLM provider is configured (OpenAI GPT-4o mini
 * or Gemini 1.5 Flash, per the recommended stack) for:
 *   1. Generating fresh JAMB-style quiz questions (Smart Practice)
 *   2. Powering the Voice Study Coach's chat replies
 *   3. Transcribing voice-coach audio messages (Whisper)
 *
 * If no API key is configured for the selected provider, every function
 * below falls back to a clearly-labeled local mock so the rest of the app
 * (token deduction, session creation, saving to the AI question bank) stays
 * fully testable without live credentials.
 */

const QUIZ_PROVIDER = process.env.AI_QUIZ_PROVIDER || "openai";
const COACH_PROVIDER = process.env.AI_COACH_PROVIDER || "openai";

// --- OpenAI ---

async function callOpenAIChat({ systemPrompt, userPrompt, jsonMode }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: userPrompt },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI chat completion failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response had no message content");
  return content;
}

// --- Gemini ---

async function callGeminiChat({ systemPrompt, userPrompt, jsonMode }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt }],
        },
      ],
      ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini generateContent failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini response had no text content");
  return content;
}

/**
 * Routes to the configured provider's chat call. Throws if the provider's
 * API key isn't set (callers catch this and fall back to a local mock),
 * or if the provider itself errors.
 */
async function generateWithProvider({ systemPrompt, userPrompt, jsonMode, provider }) {
  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('AI provider "gemini" not configured (GEMINI_API_KEY not set)');
    }
    return callGeminiChat({ systemPrompt, userPrompt, jsonMode });
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('AI provider "openai" not configured (OPENAI_API_KEY not set)');
  }
  return callOpenAIChat({ systemPrompt, userPrompt, jsonMode });
}

const LETTERS = ["A", "B", "C", "D"];

function mockQuestions({ subjectName, topic, difficulty, questionCount, providerLabel }) {
  return Array.from({ length: questionCount }).map((_, i) => {
    const correctIdx = i % 4;
    return {
      text: `[Mock AI question ${i + 1}] ${subjectName} — ${topic} (${difficulty}): sample question text.`,
      options: LETTERS.map(
        (letter, idx) => `${letter}. Option ${idx + 1}${idx === correctIdx ? " (correct)" : ""}`
      ),
      correctAnswer: LETTERS[correctIdx],
      explanation: `This is a placeholder explanation for question ${i + 1}. Configure ${providerLabel} to generate real content.`,
    };
  });
}

/**
 * Generates `questionCount` fresh JAMB-style multiple-choice questions for a
 * given subject/topic/difficulty. Falls back to a deterministic local mock
 * if the configured AI provider has no API key set or the call fails.
 */
async function generateQuizQuestions({ subjectId, subjectName, topic, difficulty, questionCount }) {
  const systemPrompt =
    "You are a JAMB (Nigerian university entrance exam) question-setter. " +
    "Always respond with ONLY a JSON object, no prose, no markdown fences.";
  const userPrompt = `Generate exactly ${questionCount} JAMB-style multiple-choice questions for the subject
"${subjectName}", topic "${topic}", difficulty "${difficulty}".

Return this exact JSON shape:
{ "questions": [
  { "text": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A", "explanation": "..." }
] }`;

  try {
    const raw = await generateWithProvider({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      provider: QUIZ_PROVIDER,
    });
    const cleaned = raw.replace(/^```json\s*|```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error("AI response did not include a non-empty questions[] array");
    }
    return parsed.questions;
  } catch (err) {
    console.warn(`[aiService] falling back to mock quiz questions: ${err.message}`);
    return mockQuestions({
      subjectName,
      topic,
      difficulty,
      questionCount,
      providerLabel: `${QUIZ_PROVIDER.toUpperCase()}_API_KEY`,
    });
  }
}

/**
 * Generates a personalized coach reply, given the user's message and a
 * summary of their real history/scores/progress (per spec section 5.2:
 * "The LLM should have system-prompt access to the user's real history").
 */
async function generateCoachReply({ message, userContext }) {
  const systemPrompt = `You are Juniper, a warm and encouraging JAMB study coach.
The student's real progress data (use it, don't invent numbers): ${JSON.stringify(userContext)}
Give a short (2-4 sentence), specific, actionable reply. Reference their real stats when it's helpful.
Do not use markdown formatting — this reply may be read aloud by a text-to-speech engine.`;

  try {
    const raw = await generateWithProvider({
      systemPrompt,
      userPrompt: message,
      jsonMode: false,
      provider: COACH_PROVIDER,
    });
    return { replyText: raw.trim(), suggestions: [] };
  } catch (err) {
    console.warn(`[aiService] falling back to mock coach reply: ${err.message}`);
    const { averageScore = 0, weakestSubject } = userContext || {};
    const focus = weakestSubject ? weakestSubject : "your weakest topics";
    return {
      replyText: `You're averaging ${averageScore}% right now. A good next step is spending 15 focused minutes a day on ${focus} — consistency moves the needle faster than long cram sessions.`,
      suggestions: ["Review my weakest topics", "Suggest a study plan for this week"],
    };
  }
}

/**
 * Transcribes a voice-coach audio message via OpenAI Whisper. `file` is a
 * multer in-memory file object ({ buffer, originalname, mimetype }).
 * Throws if OPENAI_API_KEY isn't set — callers should catch and surface a
 * clear error rather than silently mocking spoken input.
 */
async function transcribeAudio(file) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Audio transcription requires OPENAI_API_KEY to be set");
  }

  const form = new FormData();
  form.append("model", process.env.OPENAI_WHISPER_MODEL || "whisper-1");
  form.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype || "audio/m4a" }),
    file.originalname || "audio.m4a"
  );

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Whisper transcription failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data.text) throw new Error("Whisper response had no text field");
  return data.text;
}

/**
 * Optional TTS step for coach replies (ElevenLabs). Synthesizes speech,
 * uploads the resulting audio to object storage, and returns a public URL.
 * Returns null when no ElevenLabs key or no storage is configured — the
 * client should treat a null replyAudioUrl as "text-only reply, no audio".
 */
async function synthesizeSpeech(text) {
  if (!process.env.ELEVENLABS_API_KEY) return null;

  const { isConfigured, uploadBuffer } = require("./storageService");
  if (!isConfigured()) {
    console.warn("[aiService] ELEVENLABS_API_KEY is set but object storage isn't configured — skipping TTS");
    return null;
  }

  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // "Rachel" default voice
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const key = `coach-audio/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
    return await uploadBuffer(key, Buffer.from(arrayBuffer), "audio/mpeg");
  } catch (err) {
    console.warn(`[aiService] TTS synthesis failed, continuing text-only: ${err.message}`);
    return null;
  }
}

module.exports = {
  generateQuizQuestions,
  generateCoachReply,
  transcribeAudio,
  synthesizeSpeech,
};
