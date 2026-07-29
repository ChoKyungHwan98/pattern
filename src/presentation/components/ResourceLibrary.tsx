import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box, FilePlus2, Search, Trash2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useProjectStore } from "../../application/ProjectStore";
import { createId, type AssetKind, type AssetRecord } from "../../domain/project";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as object);

const extensionKind = (path: string): AssetKind => {
  const lower = path.toLowerCase();
  if (lower.endsWith(".wav") || lower.endsWith(".mp3") || lower.endsWith(".ogg")) return "sound";
  return "character";
};

export function ResourceLibrary() {
  const { document, dispatch } = useProjectStore();
  const [query, setQuery] = useState("");
  const selected = document.assets.find((asset) => asset.id === document.editor.selectedAssetId);
  const assets = document.assets.filter((asset) =>
    `${asset.name} ${asset.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()),
  );

  const importAsset = async () => {
    if (isTauri()) {
      const selectedPath = await open({
        title: "전투 리소스 가져오기",
        multiple: false,
        filters: [
          {
            name: "캐릭터 · 모션 · 효과 · 소리",
            extensions: ["glb", "gltf", "fbx", "wav", "mp3", "ogg"],
          },
        ],
      });
      if (!selectedPath || Array.isArray(selectedPath)) return;
      addAsset(selectedPath);
      return;
    }
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = ".glb,.gltf,.fbx,.wav,.mp3,.ogg";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) addAsset(URL.createObjectURL(file), file.name);
    };
    input.click();
  };

  const addAsset = (path: string, fileName?: string) => {
    const name = fileName ?? path.split(/[\\/]/).at(-1) ?? "가져온 리소스";
    const asset: AssetRecord = {
      id: createId("asset"),
      name,
      kind: extensionKind(name),
      path,
      tags: [],
    };
    dispatch({ type: "asset/add", asset });
  };

  return (
    <div className="resource-layout">
      <aside className="library-panel">
        <div className="panel-heading">
          <div>
            <small>로컬 리소스</small>
            <strong>{document.assets.length}개</strong>
          </div>
          <button className="icon-button" onClick={importAsset} title="리소스 가져오기">
            <FilePlus2 size={17} />
          </button>
        </div>
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="이름 또는 태그 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="asset-list">
          {assets.map((asset) => (
            <button
              key={asset.id}
              className={asset.id === selected?.id ? "selected" : ""}
              onClick={() => dispatch({ type: "editor/selectAsset", assetId: asset.id })}
            >
              <Box size={17} />
              <span>
                <strong>{asset.name}</strong>
                <small>{asset.kind}</small>
              </span>
            </button>
          ))}
          {assets.length === 0 && (
            <div className="list-empty">
              <p>가져온 리소스가 없습니다.</p>
              <button className="primary compact" onClick={importAsset}>
                <FilePlus2 size={15} /> 첫 리소스 가져오기
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="asset-preview">
        {selected &&
        /\.(glb|gltf|fbx)(\?|$)/i.test(selected.path) ? (
          <Suspense fallback={<div className="preview-loading">모델을 읽는 중…</div>}>
            <ModelPreview asset={selected} />
          </Suspense>
        ) : (
          <div className="import-callout">
            <strong>인간형 캐릭터와 모션을 가져오세요.</strong>
            <p>
              GLB·GLTF·FBX를 로컬에서 선택합니다. 프로젝트 문서에는 경로와 라이선스
              정보만 기록하며 에셋 파일을 외부로 전송하지 않습니다.
            </p>
            <button className="primary" onClick={importAsset}>
              <FilePlus2 size={16} /> 리소스 가져오기
            </button>
          </div>
        )}
      </main>

      <aside className="property-panel">
        {selected ? (
          <div className="property-form">
            <div className="panel-heading">
              <div>
                <small>리소스 속성</small>
                <strong>{selected.name}</strong>
              </div>
            </div>
            <label>
              표시 이름
              <input
                value={selected.name}
                onChange={(event) =>
                  dispatch({
                    type: "asset/update",
                    assetId: selected.id,
                    patch: { name: event.target.value },
                  })
                }
              />
            </label>
            <label>
              라이선스 메모
              <input
                placeholder="예: 개인 프로젝트 사용 가능"
                value={selected.license ?? ""}
                onChange={(event) =>
                  dispatch({
                    type: "asset/update",
                    assetId: selected.id,
                    patch: { license: event.target.value },
                  })
                }
              />
            </label>
            <label>
              태그
              <input
                placeholder="검사, 인간형, 대기"
                value={selected.tags.join(", ")}
                onChange={(event) =>
                  dispatch({
                    type: "asset/update",
                    assetId: selected.id,
                    patch: {
                      tags: event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </label>
            <div className="path-card">{selected.path}</div>
            <button
              className="danger"
              onClick={() => dispatch({ type: "asset/delete", assetId: selected.id })}
            >
              <Trash2 size={15} /> 리소스 연결 제거
            </button>
          </div>
        ) : (
          <div className="empty-properties">
            <strong>리소스 속성</strong>
            <p>리소스를 선택하면 이름·태그·라이선스를 편집할 수 있습니다.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function ModelPreview({ asset }: { asset: AssetRecord }) {
  const source = useMemo(
    () => (isTauri() && !asset.path.startsWith("blob:") ? convertFileSrc(asset.path) : asset.path),
    [asset.path],
  );
  return (
    <Canvas camera={{ position: [3.5, 2.2, 4.5], fov: 42 }} shadows>
      <color attach="background" args={["#071019"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 6, 4]} intensity={2.4} castShadow />
      {asset.path.toLowerCase().includes(".fbx") ? (
        <FbxModel url={source} />
      ) : (
        <GltfModel url={source} />
      )}
      <Grid
        args={[20, 20]}
        cellColor="#173442"
        sectionColor="#276476"
        fadeDistance={18}
        infiniteGrid
      />
      <OrbitControls makeDefault target={[0, 1, 0]} />
      <Environment preset="warehouse" />
    </Canvas>
  );
}

function GltfModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url);
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useModelAnimation(model, gltf.animations);
  return <primitive object={model} />;
}

function FbxModel({ url }: { url: string }) {
  const fbx = useLoader(FBXLoader, url);
  const model = useMemo(() => fbx.clone(true), [fbx]);
  useModelAnimation(model, fbx.animations);
  return <primitive object={model} />;
}

function useModelAnimation(model: THREE.Object3D, clips: THREE.AnimationClip[]) {
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  useEffect(() => {
    mixer.current = new THREE.AnimationMixer(model);
    const action = clips[0] ? mixer.current.clipAction(clips[0]) : undefined;
    action?.play();
    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
    };
  }, [clips, model]);
  useFrame((_, delta) => mixer.current?.update(delta));
}
