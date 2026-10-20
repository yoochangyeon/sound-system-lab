// X32 스타일 콘솔: 왼쪽 화면 버튼(HOME/SENDS/ROUTING/MAIN), HOME에 채널 스트립 전체.
import ConsoleApp from '../shared/ConsoleApp';
import { X32_PROFILE } from './profile';

export default function X32Console() {
  return <ConsoleApp variant="x32" profile={X32_PROFILE} />;
}
