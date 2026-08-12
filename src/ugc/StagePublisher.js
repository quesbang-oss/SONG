import { generateStageCode, encodeBase64Url, decodeBase64Url } from '../utils/helpers.js';

/**
 * ステージ共有コード（例: YKSB-82A4-F91C）とURL共有を扱う（仕様書#37〜#38）。
 *
 * 重要：音楽ファイルそのものは共有せず、譜面・ボス・ルール等のステージ情報のみを
 * 共有する（仕様書#7〜#8）。SAFE SONGの場合はIDのみで済むが、LOCAL音源の場合は
 * 友達側が「同じファイル」を自分の端末から指定する必要がある旨をUI側で明示する。
 */
export class StagePublisher {
  /**
   * ステージにShareCodeを割り当てる（未設定の場合のみ新規発行）。
   * @param {Object} stage
   */
  static ensureShareCode(stage) {
    if (!stage.shareCode) stage.shareCode = generateStageCode();
    return stage.shareCode;
  }

  /**
   * ステージ情報をURLセーフな文字列にエンコードする（URL共有・QR共有の元データ）。
   * 画像データが大きい場合はURL共有には不向きなため、呼び出し側でサイズを確認すること。
   * @param {Object} stage
   */
  static encodeShareable(stage) {
    return encodeBase64Url({
      v: stage.version || '1.0',
      name: stage.name,
      song: stage.song,
      beatmap: stage.beatmap,
      boss: stage.boss,
      rules: stage.rules,
      difficulty: stage.difficulty,
      creator: stage.creator,
      shareCode: stage.shareCode
    });
  }

  static decodeShareable(str) {
    return decodeBase64Url(str);
  }

  /**
   * 現在のページを基準にした共有URLを生成する。
   * @param {Object} stage
   */
  static buildShareUrl(stage) {
    const encoded = this.encodeShareable(stage);
    const url = new URL(window.location.href);
    url.hash = `stage=${encoded}`;
    return url.toString();
  }

  /**
   * 現在のURLハッシュにステージデータが埋め込まれていればデコードする。
   */
  static readFromLocationHash() {
    const hash = window.location.hash || '';
    const match = hash.match(/stage=([^&]+)/);
    if (!match) return null;
    try {
      return this.decodeShareable(decodeURIComponent(match[1]));
    } catch (err) {
      console.error('[StagePublisher] URL共有データのデコードに失敗しました', err);
      return null;
    }
  }
}
