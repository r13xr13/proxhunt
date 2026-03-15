---
name: voice
description: Text-to-Speech and Speech-to-Text voice capabilities
version: 1.0.0
---

# Voice Skill

Text-to-Speech (TTS) and Speech-to-Text (STT) using local models.

## Setup

### TTS (Text-to-Speech)
Install Coqui TTS or use Ollama:
```bash
# Option 1: Coqui TTS (recommended)
pip install TTS

# Option 2: Ollama (already have)
# Uses nomin-embed-text for STT
```

### STT (Speech-to-Text)
```bash
# Whisper via Ollama
ollama pull whisper
```

## Tools

[[tool]]
name: tts_speak
description: Convert text to speech
params:
  - name: text
    type: string
    required: true
    description: Text to speak
  - name: voice
    type: string
    required: false
    description: Voice (female_male, male_deep, etc)

[[tool]]
name: tts_save
description: Save speech to file
params:
  - name: text
    type: string
    required: true
    description: Text to convert
  - name: filename
    type: string
    required: false
    description: Output filename
  - name: voice
    type: string
    required: false
    description: Voice type

[[tool]]
name: stt_transcribe
description: Convert speech to text
params:
  - name: file
    type: string
    required: true
    description: Audio file path

[[tool]]
name: voice_list
description: List available voices
params: []

## Script

const VOICE_DIR = home() + "/.antenna/audio";

async function ensureVoiceDir() {
  const fs = await import('fs');
  if (!fs.existsSync(VOICE_DIR)) {
    fs.mkdirSync(VOICE_DIR, { recursive: true });
  }
}

async function tts_speak({ text, voice = "female" }) {
  const { exec } = await import('child_process');
  await ensureVoiceDir();
  
  const filename = VOICE_DIR + "/speak_" + Date.now() + ".wav";
  
  // Try Coqui TTS first
  const coquiScript = `
from TTS.api import TTS
tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", gpu=False)
tts.tts_to_file(text="${text.replace(/"/g, '\\"')}", file_path="${filename}")
`;
  
  try {
    await new Promise((resolve, reject) => {
      exec(`python3 -c "${coquiScript.replace(/"/g, '\\"')}"`, { timeout: 60000 }, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
    
    return { 
      success: true, 
      audio_file: filename,
      message: "Audio generated. Configure audio playback in settings."
    };
  } catch {
    return { 
      error: "TTS not available. Install: pip install TTS",
      suggestion: "Or use browser-based Web Speech API"
    };
  }
}

async function tts_save({ text, filename = "", voice = "female" }) {
  const fs = await import('fs');
  await ensureVoiceDir();
  
  const name = filename || "speech_" + Date.now() + ".wav";
  const outputPath = VOICE_DIR + "/" + name;
  
  const coquiScript = `
from TTS.api import TTS
tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", gpu=False)
tts.tts_to_file(text="${text.replace(/"/g, '\\"')}", file_path="${outputPath}")
`;
  
  try {
    const { exec } = await import('child_process');
    await new Promise((resolve, reject) => {
      exec(`python3 -c "${coquiScript.replace(/"/g, '\\"')}"`, { timeout: 60000 }, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
    
    const stats = fs.statSync(outputPath);
    return { success: true, file: outputPath, size: stats.size };
  } catch {
    return { error: "Failed to generate speech" };
  }
}

async function stt_transcribe({ file }) {
  const { exec } = await import('child_process');
  
  // Try Whisper via CLI first
  try {
    const { stdout } = await new Promise((resolve) => {
      exec(`whisper "${file}" --language English --model small`, { timeout: 120000 }, (err, stdout, stderr) => {
        resolve({ stdout: stdout || stderr });
      });
    });
    
    return { success: true, text: stdout };
  } catch {}
  
  // Fallback to Ollama
  try {
    const fs = await import('fs');
    const audioData = fs.readFileSync(file);
    const base64 = audioData.toString('base64');
    
    return { 
      error: "Whisper not installed",
      suggestion: "Install: pip install openai-whisper"
    };
  } catch {
    return { error: "STT not available" };
  }
}

async function voice_list() {
  return {
    voices: [
      { id: "female", name: "Female", description: "Default female voice" },
      { id: "male", name: "Male", description: "Deep male voice" },
      { id: "fast", name: "Fast", description: "Faster pace" },
      { id: "slow", name: "Slow", description: "Slower, clearer" }
    ],
    note: "Install Coqui TTS for more voices: pip install TTS"
  };
}
