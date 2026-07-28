import type { Metadata } from "next";
import { CombatPrototype } from "./CombatPrototype";

export const metadata: Metadata = {
  title: "Combat Behavior Workbench — 3D 전투 패턴 프로토타입",
  description:
    "HFSM, Behavior Tree, Blackboard와 3D 전투 패턴을 한 화면에서 검증하는 전투 기획 워크벤치 프로토타입",
};

export default function Home() {
  return <CombatPrototype />;
}
