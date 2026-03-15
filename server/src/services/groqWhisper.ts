import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

export interface WhisperTranscription {
  text: string;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  duration?: number;
}

export interface GroqWhisperConfig {
  apiKey: string;
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo';
  responseFormat?: 'text' | 'json' | 'verbose_json';
  language?: string;
  temperature?: number;
  timestampGranularities?: ('word' | 'segment')[];
}

export class GroqWhisperService {
  private apiKey: string;
  private baseUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';

  constructor(config: GroqWhisperConfig) {
    this.apiKey = config.apiKey;
  }

  /**
   * Transcribe audio file using Groq Whisper API
   */
  async transcribeAudio(
    filePath: string,
    options?: {
      model?: 'whisper-large-v3' | 'whisper-large-v3-turbo';
      language?: string;
      temperature?: number;
      timestampGranularities?: ('word' | 'segment')[];
    }
  ): Promise<WhisperTranscription> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const formData = new FormData();
    formData.append('file', fileBuffer, { filename: fileName });
    formData.append('model', options?.model || 'whisper-large-v3-turbo');
    
    if (options?.language) {
      formData.append('language', options.language);
    }
    
    if (options?.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }
    
    if (options?.timestampGranularities) {
      formData.append('timestamp_granularities', JSON.stringify(options.timestampGranularities));
    }

    try {
      const response = await axios.post(this.baseUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 120000 // 2 minute timeout for large files
      });

      return {
        text: response.data.text || '',
        language: response.data.language,
        segments: response.data.segments,
        duration: response.data.duration
      };
    } catch (error: any) {
      throw new Error(`Groq Whisper API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Transcribe from audio URL
   */
  async transcribeFromUrl(
    audioUrl: string,
    options?: {
      model?: 'whisper-large-v3' | 'whisper-large-v3-turbo';
      language?: string;
    }
  ): Promise<WhisperTranscription> {
    // Download audio to temp file
    const tempDir = '/tmp/groq-transcriptions';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `audio-${Date.now()}.mp3`);
    const response = await axios.get(audioUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    try {
      return await this.transcribeAudio(tempPath, options);
    } finally {
      // Cleanup temp file
      fs.unlinkSync(tempPath);
    }
  }
}

export const groqWhisper = {
  transcribe: async (apiKey: string, audioPath: string, options?: any) => {
    const service = new GroqWhisperService({ apiKey });
    return service.transcribeAudio(audioPath, options);
  },
  
  transcribeUrl: async (apiKey: string, audioUrl: string, options?: any) => {
    const service = new GroqWhisperService({ apiKey });
    return service.transcribeFromUrl(audioUrl, options);
  }
};
