# 제출 전 인수 체크리스트

- [ ] v1 백업에서 v2로 복원해도 노드·전환·값 손실 0건.
- [ ] 3단계 이상 하위 상태 머신 진입·breadcrumb 복귀 성공.
- [ ] Entry/Any/Exit 및 스코프 경계 위반 검증 성공.
- [ ] 조건·이벤트·완료·시간 전환과 인터럽트 재현 성공.
- [ ] 중단점, 이벤트 주입, 블랙보드 실시간 변경, 되감기 재현 성공.
- [ ] 앱 재시작 뒤 패턴 세트·문서·레이아웃·카탈로그 유지.
- [ ] Unity UPM ZIP에 Runtime/Editor/Tests/Samples/Documentation 포함.
- [ ] Unreal Plugin ZIP에 Runtime/Editor/Tests/Resources 포함.
- [ ] Unity 6 Editor에서 패키지 설치·컴파일·Play Mode 실행·Debug Window 확인.
- [ ] Unreal에서 플러그인 컴파일·`.gpattern` 임포트·ActorComponent 실행 확인.
- [ ] 1500×920, 1100×760, 760×720, 540×720에서 가로 넘침과 겹침 0건.
- [ ] Typecheck, lint, unit, Studio embedded QA, Release build 전부 통과.
