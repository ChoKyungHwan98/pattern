import { useEffect, useRef } from "react";

const TOOL_NAVIGATION_CHANNEL = "game-design-studio:tool-navigation";

/**
 * 게임기획 스튜디오 공통 계약: 마우스 사이드 버튼(4번 뒤로·5번 앞으로)과 스튜디오 상단 뒤로가기.
 * 화면 = 열린 세트 id(없으면 세트 목록). 도구 안에 갈 곳이 없으면 스튜디오에 넘긴다.
 */
export function useScreenHistory(screen: string | undefined, go: (screen: string | undefined) => void) {
  const past = useRef<(string | undefined)[]>([]);
  const future = useRef<(string | undefined)[]>([]);
  const current = useRef(screen);
  const jumping = useRef(false);
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; }, [go]);

  useEffect(() => {
    if (current.current === screen) return;
    if (!jumping.current) {
      past.current.push(current.current);
      future.current = [];
    }
    jumping.current = false;
    current.current = screen;
  }, [screen]);

  useEffect(() => {
    const step = (direction: "back" | "forward") => {
      const from = direction === "back" ? past : future;
      const to = direction === "back" ? future : past;
      if (from.current.length === 0) return false;
      const target = from.current.pop();
      to.current.push(current.current);
      jumping.current = true;
      goRef.current(target);
      return true;
    };
    const hosted = new URLSearchParams(window.location.search).get("host") === "studio" && window.parent !== window;
    const swallow = (event: MouseEvent) => { if (event.button === 3 || event.button === 4) event.preventDefault(); };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      const direction = event.button === 3 ? "back" : "forward";
      if (!step(direction) && hosted) {
        window.parent.postMessage({ channel: TOOL_NAVIGATION_CHANNEL, type: "side-navigate", direction }, "*");
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (event.data?.channel !== TOOL_NAVIGATION_CHANNEL || event.data?.type !== "navigate-back") return;
      const handled = step("back");
      window.parent.postMessage({ channel: TOOL_NAVIGATION_CHANNEL, type: "navigate-back:result", requestId: event.data.requestId, handled }, "*");
    };
    window.addEventListener("mousedown", swallow);
    window.addEventListener("auxclick", swallow);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("mousedown", swallow);
      window.removeEventListener("auxclick", swallow);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("message", onMessage);
    };
  }, []);
}
