// 첫 재생 전 볼륨 안내(기획서 S08).
export function VolumeNotice({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  return (
    <div className="sim-notice" role="dialog" aria-modal="true" aria-labelledby="sim-notice-title">
      <div className="sim-notice-box">
        <h3 id="sim-notice-title">🔈 볼륨을 먼저 낮춰 주세요</h3>
        <p>
          이어폰·스피커 볼륨을 낮춘 뒤 시작하세요. 하울링 실습에서는 소리가 커질 수 있습니다. 사이트에는 소리 크기 상한(안전 리미터)이
          있습니다.
        </p>
        <div className="sim-notice-actions">
          <button type="button" className="sim-btn" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="sim-btn is-primary" onClick={onAccept} autoFocus>
            볼륨 낮췄어요, 재생
          </button>
        </div>
      </div>
    </div>
  );
}
