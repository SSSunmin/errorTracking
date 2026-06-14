/**
 * 이벤트 샘플링 결정 — sampleRate 0~1.
 * rand는 [0,1) 난수(주입 가능, 테스트용). rate>=1이면 항상, <=0이면 절대 전송.
 */
export function shouldSample(rate: number, rand: number): boolean {
  if (!Number.isFinite(rate) || rate >= 1) return true;
  if (rate <= 0) return false;
  return rand < rate;
}
