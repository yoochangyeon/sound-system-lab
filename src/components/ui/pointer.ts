/** 포인터 캡처. 일부 브라우저·합성 이벤트에서는 예외가 나므로 실패해도 드래그는 계속한다. */
export function capture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* 캡처 없이도 svg 위에서는 드래그된다 */
  }
}
