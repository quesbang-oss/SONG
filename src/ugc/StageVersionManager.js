/**
 * ステージのバージョン文字列（例: v1.0, v1.1）を管理する（仕様書#53）。
 */
export class StageVersionManager {
  static initial() {
    return '1.0';
  }

  /**
   * マイナーバージョンを1つ上げる（例: "1.2" -> "1.3"）。
   * @param {string} version
   */
  static bumpMinor(version) {
    const [major, minor = '0'] = String(version || '1.0').split('.');
    const nextMinor = parseInt(minor, 10) + 1;
    return `${major}.${nextMinor}`;
  }

  /**
   * メジャーバージョンを1つ上げ、マイナーをリセットする（例: 大幅な譜面変更時）。
   * @param {string} version
   */
  static bumpMajor(version) {
    const [major = '1'] = String(version || '1.0').split('.');
    return `${parseInt(major, 10) + 1}.0`;
  }
}
