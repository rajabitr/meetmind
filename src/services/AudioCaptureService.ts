import { Audio } from 'expo-av';
import { AUDIO_CONFIG } from '../config/constants';

export class AudioCaptureService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
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
      if (this.isRecording) this.rotateRecording();
    }, AUDIO_CONFIG.CHUNK_DURATION_MS);
  }

  private async recordChunk(): Promise<void> {
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    this.recording = recording;
  }

  private async rotateRecording(): Promise<void> {
    if (!this.recording) return;

    const prevRecording = this.recording;
    this.recording = null;

    // Start new recording immediately to minimize gap
    await this.recordChunk();

    // Process previous chunk
    await prevRecording.stopAndUnloadAsync();
    const uri = prevRecording.getURI();
    if (uri && this.onChunkReady) {
      this.onChunkReady(uri);
    }
  }

  async stopCapture(): Promise<void> {
    this.isRecording = false;

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      if (uri && this.onChunkReady) {
        this.onChunkReady(uri);
      }
      this.recording = null;
    }
  }
}
