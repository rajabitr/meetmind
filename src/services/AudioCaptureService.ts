import { Audio } from 'expo-av';
import { AUDIO_CONFIG } from '../config/constants';

// Silence threshold in dBFS (-160 is complete silence, -30 is quiet speech)
const SILENCE_THRESHOLD = -45;

export class AudioCaptureService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private rotating = false;
  private onChunkReady: ((uri: string) => void) | null = null;
  private chunkInterval: ReturnType<typeof setInterval> | null = null;
  private peakMeter = -160;

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
      {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      }
    );
    this.recording = recording;
    this.peakMeter = -160;

    // Poll metering during recording to track peak level
    recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && status.metering !== undefined) {
        if (status.metering > this.peakMeter) {
          this.peakMeter = status.metering;
        }
      }
    });
    recording.setProgressUpdateInterval(500);
  }

  private async rotateRecording(): Promise<void> {
    if (!this.recording || this.rotating) return;
    this.rotating = true;

    try {
      const prevRecording = this.recording;
      const wasSilent = this.peakMeter < SILENCE_THRESHOLD;
      this.recording = null;

      // MUST stop previous before starting new (iOS only allows one)
      await prevRecording.stopAndUnloadAsync();
      const uri = prevRecording.getURI();

      // Start new recording after previous is fully stopped
      if (this.isRecording) {
        await this.recordChunk();
      }

      // Only send chunk if there was actual audio (not silence)
      if (uri && this.onChunkReady && !wasSilent) {
        this.onChunkReady(uri);
      }
    } catch (err) {
      console.error('Rotate recording error:', err);
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
        const wasSilent = this.peakMeter < SILENCE_THRESHOLD;
        await this.recording.stopAndUnloadAsync();
        const uri = this.recording.getURI();
        if (uri && this.onChunkReady && !wasSilent) {
          this.onChunkReady(uri);
        }
      } catch (err) {
        console.error('Stop recording error:', err);
      }
      this.recording = null;
    }
  }
}
