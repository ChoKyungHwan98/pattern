# 구현 상태

마지막 갱신: 2026-07-30

## 완료

- 이전 하드코딩 재생 데모를 `archive/playback-demo-20260730` 브랜치에 보관
- `codex/fsm-authoring-foundation` 작업 브랜치 생성
- Vite + React + Tauri 2 데스크톱 구조 전환
- 버전 1 `ProjectDocument`와 UUID 기반 참조 계약
- Typed Command 기반 상태·전환·행동·타임라인·자산 편집
- Immer patch 기반 Ctrl+Z/Y, 자동 저장, 프로젝트 열기·저장
- React Flow FSM 상태 추가·삭제·이름 변경·배치·전환 연결
- 시작 상태, 전환 조건·우선순위·인터럽트, 행동 참조 편집
- FSM 사전 검증과 한국어 오류
- 60Hz 정수 tick 문서 구동 FSM 런타임과 판단 기록
- 같은 입력을 100회 실행하는 결정론 테스트
- 프레임 단위 다중 트랙 행동 타임라인과 판정 블록 편집 기반
- GLB·GLTF·FBX 로컬 가져오기와 AnimationMixer 미리보기
- Vite 빌드, ESLint, TypeScript, Vitest, Cargo check 통과

## 진행 중

- Gate 1: 저장 문서의 전체 Zod 검증, 마이그레이션, 누락 자산 재연결
- Gate 2: 타임라인 리사이즈·다중 선택·복사/붙여넣기·스냅
- Gate 2: 리그·소켓 매핑과 실제 캐릭터/모션 연결
- Gate 2: 연속 검 궤적 충돌, 화염구 물리, 가드·패링·회피 실행
- Gate 3: 플레이어 직접 조작, 리플레이, 시각 디버그, 분석 연결

## 완료로 간주하지 않는 항목

- 실제 인간형 모델과 필수 모션 세트가 로컬 라이브러리에 연결되기 전에는 Gate 2가 아니다.
- 검 궤적과 투사체 연속 충돌 테스트를 통과하기 전에는 전투 판정이 완료된 것이 아니다.
- Unity·Unreal 내보내기는 공통 CombatIR과 미지원 기능 검사 전에는 제공하지 않는다.
