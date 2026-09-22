# 패턴 디자이너

게임의 전투 행동을 FSM, HFSM, 행동 트리로 설계하고 구조를 검증하는 로컬 데스크톱 도구입니다.
통합 스튜디오의 짙은 중립색·청록 강조색을 공유하되, 전문 도구 안에서는 그래프 편집에 필요한
정보만 남기는 방향으로 구성했습니다.

## 현재 구현

- FSM·HFSM·행동 트리를 한 패턴 목록에서 전환
- 노드 선택·이동·추가, 포트 연결, 자동 배치
- 선택한 노드에만 나타나는 문맥형 속성 패널
- 필요할 때 여는 검증·실행 기록·블랙보드 보조 패널
- 시작 상태, 끊어진 전환, 잘못된 계층, 행동 트리 순환 구조 검증
- XState 기반 FSM·HFSM 실행 어댑터
- Mistreevous 기반 행동 트리 실행 어댑터
- 실행·일시 정지·한 단계 실행·중지와 노드 상태 표시
- 1280×720에서 전체 페이지 스크롤 없이 동작하는 반응형 레이아웃

편집 데이터는 패턴 디자이너의 `GraphDefinition`을 정본으로 유지합니다. XState와
Mistreevous 형식은 실행할 때 어댑터가 생성하므로, 특정 라이브러리의 저장 형식에 프로젝트가
종속되지 않습니다.

## 실행

```bash
npm install
npm run dev
```

데스크톱 모드:

```bash
npm run desktop:dev
```

검증:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

설계 기준은 [편집기 셸 명세](docs/EDITOR_SHELL_SPEC.md), 외부 구현 조사와 채택 근거는
[FSM·HFSM·행동 트리 GitHub 조사](docs/GITHUB_FSM_HFSM_RESEARCH.md), 라이선스는
[서드파티 고지](THIRD_PARTY_NOTICES.md)에 정리되어 있습니다.
