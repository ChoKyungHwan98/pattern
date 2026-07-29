# 전투 AI 제작소

게임 기획자가 행동 타임라인과 FSM을 직접 만들고 60Hz 전투 런타임에서 검증하는
Tauri 2 + React 데스크톱 제작 도구다.

## 실행

필요 환경:

- Node.js 22 이상
- Rust stable
- Windows WebView2

```powershell
npm install
npm run desktop:dev
```

브라우저 UI만 확인하려면 `npm run dev` 후 `http://127.0.0.1:5174`를 연다.

## 검사

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
cd src-tauri
cargo check
```

## 현재 범위

- 프로젝트 열기·저장·자동 저장
- Typed Command와 Ctrl+Z/Y
- FSM 상태·전환·조건·우선순위·행동 참조 편집
- 프레임 단위 다중 트랙 행동 편집 기반
- GLB·GLTF·FBX 로컬 가져오기와 애니메이션 미리보기
- 문서 구동 결정론적 60Hz FSM 실험과 판단 기록

전체 Gate와 미완료 조건은 [PRODUCT_DIRECTION.md](./PRODUCT_DIRECTION.md)와
[STATUS.md](./STATUS.md)를 참고한다.
