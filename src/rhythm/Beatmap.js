import { Note } from './Note.js';

/**
 * 1つの譜面（曲・BPM・ノーツ列・フェーズ境界）を表すクラス。
 */
export class Beatmap {
  /**
   * @param {Object} params
   * @param {number} params.bpm
   * @param {number} params.duration 曲の長さ（秒）
   * @param {Note[]} [params.notes]
   * @param {number[]} [params.phaseMarkers] フェーズ切り替わり時刻（秒）の配列。長さ4（PHASE2〜4開始 + FINAL開始）を想定。
   * @param {string} [params.difficulty]
   */
  constructor({ bpm, duration, notes = [], phaseMarkers = null, difficulty = 'NORMAL' }) {
    this.bpm = bpm;
    this.duration = duration;
    /** @type {Note[]} */
    this.notes = notes;
    this.difficulty = difficulty;
    this.phaseMarkers = phaseMarkers || this._defaultPhaseMarkers(duration);
  }

  _defaultPhaseMarkers(duration) {
    // 曲を5等分し、PHASE1〜4 + FINAL BREAKの境界を作る
    return [1, 2, 3, 4].map((i) => Number(((duration * i) / 5).toFixed(3)));
  }

  get beatSec() {
    return 60 / this.bpm;
  }

  addNote(note) {
    this.notes.push(note);
    this.sortNotes();
    return note;
  }

  removeNote(noteId) {
    this.notes = this.notes.filter((n) => n.id !== noteId);
  }

  sortNotes() {
    this.notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  }

  /**
   * 指定した時間窓に含まれるノーツを返す（レンダリング用）。
   */
  getNotesInWindow(startSec, endSec) {
    return this.notes.filter((n) => n.time >= startSec && n.time <= endSec);
  }

  resetRuntimeState() {
    this.notes.forEach((n) => n.resetRuntimeState());
  }

  get noteCount() {
    return this.notes.length;
  }

  toJSON() {
    return {
      bpm: this.bpm,
      duration: Number(this.duration.toFixed(3)),
      difficulty: this.difficulty,
      phaseMarkers: this.phaseMarkers,
      notes: this.notes.map((n) => n.toJSON())
    };
  }

  static fromJSON(json) {
    return new Beatmap({
      bpm: json.bpm,
      duration: json.duration,
      difficulty: json.difficulty,
      phaseMarkers: json.phaseMarkers,
      notes: (json.notes || []).map(Note.fromJSON)
    });
  }
}
