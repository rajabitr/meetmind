import { Audio } from 'expo-av';
import { AUDIO_CONFIG } from '../config/constants';

export class AudioCaptureService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private rotating = false;
  private onChunkReady: ((uri: string) => void) | null = null;
  private chunkInterval: ReturnType<typeof setInterval> | null = null;

  async requestPermission(): Promise<boolean> {
    const { granted } = await Audio.requestPermissionsAsync();
    return granted;
  }

  async startCapture(onChunk: (uri: string) => void): Promise<void> {
    this.onChunkReady = onChunk;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    this.isRecording = true;
    await this.recordChunk();

    this.chunkInterval = setInterval(() => {
      if (this.isRecording && !this.rotating) {
        this.rotateRecording();
      }
    }, AUDIO_CONFIG.CHUNK_DURATION_MS);
  }

  private async recordChunk(): Promise<void> {
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    this.recording = recording;
  }

  private async rotateRecording(): Promise<void> {
    if (!this.recording || this.rotating) return;
    this.rotating = true;

    try {
      const prevRecording = this.recording;
      this.recording = null;

      // MUST stop previous before starting new (iOS only allows one)
      await prevRecording.stopAndUnloadAsync();
      const uri = prevRecording.getURI();

      // Start new recording after previous is fully stopped
      if (this.isRecording) {
        await this.recordChunk();
      }

      // Process previous chunk in background
      if (uri && this.onChunkReady) {
        this.onChunkReady(uri);
      }
    } catch (err) {
      console.error('Rotate recording error:', err);
      // Try to recover by starting a fresh recording
      if (this.isRecording && !this.recording) {
        try {
          await this.recordChunk();
        } catch {}
      }
    } finally {
      this.rotating = false;
    }
  }

  async stopCapture(): Promise<void> {
    this.isRecording = false;

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
        const uri = this.recording.getURI();
        if (uri && this.onChunkReady) {
          this.onChunkReady(uri);
        }
      } catch (err) {
        console.error('Stop recording error:', err);
      }
      this.recording = null;
    }
  }
}
