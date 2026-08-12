import { NoteGenerator } from '../rhythm/NoteGenerator.js';

/**
 * 譜面エディタのタイムライン背景表示用に、音声波形の概形とオンセット強度を計算する。
 */
export class SongAnalyzer {
  /**
   * @param {AudioBuffer} buffer
   * @param {number} bucketCount タイムライン表示用に間引くバケット数
   */
  static buildWaveformOverview(buffer, bucketCount = 800) {
    const channelData = buffer.getChannelData(0);
    const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));
    const peaks = new Float32Array(bucketCount);
    for (let b = 0; b < bucketCount; b++) {
      let max = 0;
      const start = b * samplesPerBucket;
      const end = Math.min(channelData.length, start + samplesPerBucket);
      for (let i = start; i < end; i++) {
        const v = Math.abs(channelData[i]);
        if (v > max) max = v;
      }
      peaks[b] = max;
    }
    return { peaks: Array.from(peaks), bucketCount, durationSec: buffer.duration };
  }

  /**
   * オンセット解析結果を返す（エディタでの候補位置ハイライト等に使用）。
   * @param {AudioBuffer} buffer
   */
  static analyzeOnsets(buffer) {
    return NoteGenerator.analyzeOnsets(buffer);
  }
}
