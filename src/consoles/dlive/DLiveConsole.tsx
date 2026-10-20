// dLive 스타일 콘솔: 위쪽 처리 탭(Preamp/Gate/PEQ/Compressor)으로 한 구역씩 크게, Mix·I/O·NEQ 화면.
// GEQ는 28밴드(31.5 Hz~16 kHz)만 보인다.
import ConsoleApp from '../shared/ConsoleApp';
import { DLIVE_GEQ_FIRST, DLIVE_GEQ_LAST, DLIVE_PROFILE } from './profile';

export default function DLiveConsole() {
  return <ConsoleApp variant="dlive" profile={DLIVE_PROFILE} geqFirst={DLIVE_GEQ_FIRST} geqLast={DLIVE_GEQ_LAST} />;
}
