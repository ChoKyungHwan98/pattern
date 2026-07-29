import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef } from "react";
import { useProjectStore } from "../../application/ProjectStore";
import {
  createId,
  type ActionDefinition,
  type CollisionTimelineItem,
  type TimelineItem,
  type TimelineTrackKind,
} from "../../domain/project";

const palette: Record<TimelineTrackKind, string> = {
  animation: "#6f8edb",
  movement: "#4cb9a8",
  collision: "#e6635d",
  projectile: "#e4a847",
  cancel: "#a879db",
  effect: "#5db7df",
  sound: "#85c96e",
  camera: "#d680b2",
  hitStop: "#d46c86",
  event: "#8f9eaa",
};

function createEmptyAction(name: string): ActionDefinition {
  const kinds: TimelineTrackKind[] = [
    "animation",
    "movement",
    "collision",
    "projectile",
    "cancel",
    "effect",
    "sound",
    "camera",
    "hitStop",
    "event",
  ];
  const labels: Record<TimelineTrackKind, string> = {
    animation: "애니메이션",
    movement: "이동 · 루트 모션",
    collision: "판정",
    projectile: "투사체 · 소환",
    cancel: "취소 가능 구간",
    effect: "효과",
    sound: "소리",
    camera: "카메라",
    hitStop: "히트 스톱",
    event: "사용자 이벤트",
  };
  return {
    id: createId("action"),
    name,
    durationTicks: 90,
    tickRate: 60,
    tracks: kinds.map((kind) => ({
      id: createId("track"),
      kind,
      name: labels[kind],
      locked: false,
      muted: false,
    })),
    items: [],
  };
}

export function ActionEditor() {
  const { document, dispatch } = useProjectStore();
  const action =
    document.actions.find((candidate) => candidate.id === document.editor.selectedActionId) ??
    document.actions[0];
  const selectedItem = action?.items.find((item) =>
    document.editor.selectedTimelineItemIds.includes(item.id),
  );
  const dragState = useRef<{
    itemId: string;
    startX: number;
    startTick: number;
    width: number;
  } | null>(null);

  const pixelsPerTick = 8;
  const rulerTicks = useMemo(
    () => Array.from({ length: Math.floor((action?.durationTicks ?? 0) / 10) + 1 }, (_, i) => i * 10),
    [action?.durationTicks],
  );

  if (!action) return <div className="empty-state">행동이 없습니다.</div>;

  const addCollision = () => {
    const track = action.tracks.find((candidate) => candidate.kind === "collision");
    if (!track) return;
    const item: CollisionTimelineItem = {
      id: createId("item"),
      trackId: track.id,
      type: "collision",
      name: "새 공격 판정",
      startTick: 20,
      endTick: 30,
      role: "attack",
      socket: "weapon_r",
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      shape3d: { kind: "capsule", radius: 0.18, length: 1 },
      continuous: true,
      damage: 10,
    };
    dispatch({ type: "timeline/addItem", actionId: action.id, item });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta = Math.round((event.clientX - dragState.current.startX) / dragState.current.width);
    const item = action.items.find((candidate) => candidate.id === dragState.current?.itemId);
    if (!item) return;
    const duration = item.endTick - item.startTick;
    const startTick = Math.max(
      0,
      Math.min(action.durationTicks - duration, dragState.current.startTick + delta),
    );
    dispatch({
      type: "timeline/updateItem",
      actionId: action.id,
      itemId: item.id,
      patch: { startTick, endTick: startTick + duration },
    });
  };

  return (
    <div className="action-layout">
      <aside className="library-panel">
        <div className="panel-heading">
          <div>
            <small>행동 라이브러리</small>
            <strong>{document.actions.length}개 행동</strong>
          </div>
          <button
            className="icon-button"
            title="새 행동"
            onClick={() =>
              dispatch({
                type: "action/add",
                action: createEmptyAction(`새 행동 ${document.actions.length + 1}`),
              })
            }
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="state-list">
          {document.actions.map((candidate) => (
            <button
              key={candidate.id}
              className={candidate.id === action.id ? "selected" : ""}
              onClick={() =>
                dispatch({ type: "editor/selectAction", actionId: candidate.id })
              }
            >
              <span className="action-icon" />
              <span>{candidate.name}</span>
              <small>{candidate.durationTicks}f</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="action-stage">
        <div className="preview-empty">
          <div className="preview-grid" />
          <div className="import-callout">
            <strong>실제 캐릭터 미리보기</strong>
            <p>
              원시 도형은 사용하지 않습니다. 리소스에서 인간형 GLB·GLTF·FBX와 모션을
              가져오면 이곳에서 프레임에 맞춰 재생됩니다.
            </p>
            <button
              className="secondary"
              onClick={() => dispatch({ type: "editor/workspace", workspace: "resources" })}
            >
              리소스 가져오기
            </button>
          </div>
        </div>

        <section
          className="timeline"
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            dragState.current = null;
          }}
          onPointerLeave={() => {
            dragState.current = null;
          }}
        >
          <div className="timeline-toolbar">
            <div>
              <strong>{action.name}</strong>
              <span>60fps · {action.durationTicks}프레임</span>
            </div>
            <button className="primary compact" onClick={addCollision}>
              <Plus size={15} /> 판정 블록
            </button>
          </div>
          <div className="timeline-scroll">
            <div className="timeline-table" style={{ width: 180 + action.durationTicks * pixelsPerTick }}>
              <div className="track-label ruler-label">트랙 / 프레임</div>
              <div className="ruler" style={{ width: action.durationTicks * pixelsPerTick }}>
                {rulerTicks.map((tick) => (
                  <span key={tick} style={{ left: tick * pixelsPerTick }}>
                    {tick}
                  </span>
                ))}
              </div>
              {action.tracks.map((track) => (
                <div className="timeline-row" key={track.id}>
                  <div className="track-label">{track.name}</div>
                  <div
                    className="track-lane"
                    style={{
                      width: action.durationTicks * pixelsPerTick,
                      backgroundSize: `${pixelsPerTick * 5}px 100%`,
                    }}
                  >
                    {action.items
                      .filter((item) => item.trackId === track.id)
                      .map((item) => (
                        <button
                          key={item.id}
                          className={
                            document.editor.selectedTimelineItemIds.includes(item.id)
                              ? "timeline-item selected"
                              : "timeline-item"
                          }
                          style={{
                            left: item.startTick * pixelsPerTick,
                            width: Math.max(12, (item.endTick - item.startTick) * pixelsPerTick),
                            background: palette[track.kind],
                          }}
                          onClick={() =>
                            dispatch({ type: "editor/selectTimelineItems", itemIds: [item.id] })
                          }
                          onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            dragState.current = {
                              itemId: item.id,
                              startX: event.clientX,
                              startTick: item.startTick,
                              width: pixelsPerTick,
                            };
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <aside className="property-panel">
        <ActionProperties action={action} item={selectedItem} />
      </aside>
    </div>
  );
}

function ActionProperties({
  action,
  item,
}: {
  action: ActionDefinition;
  item?: TimelineItem;
}) {
  const { dispatch } = useProjectStore();
  if (!item) {
    return (
      <div className="property-form">
        <div className="panel-heading">
          <div>
            <small>행동 속성</small>
            <strong>{action.name}</strong>
          </div>
        </div>
        <label>
          행동 이름
          <input
            value={action.name}
            onChange={(event) =>
              dispatch({ type: "action/rename", actionId: action.id, name: event.target.value })
            }
          />
        </label>
        <div className="info-card">
          <strong>타임라인 블록을 선택하세요.</strong>
          <p>시작·종료 프레임과 판정 수치를 직접 편집할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const update = (patch: Partial<TimelineItem>) =>
    dispatch({
      type: "timeline/updateItem",
      actionId: action.id,
      itemId: item.id,
      patch,
    });

  return (
    <div className="property-form">
      <div className="panel-heading">
        <div>
          <small>타임라인 블록</small>
          <strong>{item.name}</strong>
        </div>
      </div>
      <label>
        이름
        <input value={item.name} onChange={(event) => update({ name: event.target.value })} />
      </label>
      <div className="property-row">
        <label>
          시작 프레임
          <input
            type="number"
            min={0}
            max={item.endTick - 1}
            value={item.startTick}
            onChange={(event) => update({ startTick: Number(event.target.value) })}
          />
        </label>
        <label>
          종료 프레임
          <input
            type="number"
            min={item.startTick + 1}
            max={action.durationTicks}
            value={item.endTick}
            onChange={(event) => update({ endTick: Number(event.target.value) })}
          />
        </label>
      </div>
      {item.type === "collision" && (
        <>
          <label>
            붙일 소켓
            <input value={item.socket} onChange={(event) => update({ socket: event.target.value })} />
          </label>
          <div className="property-row">
            <label>
              피해
              <input
                type="number"
                value={item.damage}
                onChange={(event) => update({ damage: Number(event.target.value) })}
              />
            </label>
            <label>
              연속 궤적
              <select
                value={item.continuous ? "true" : "false"}
                onChange={(event) => update({ continuous: event.target.value === "true" })}
              >
                <option value="true">사용</option>
                <option value="false">미사용</option>
              </select>
            </label>
          </div>
        </>
      )}
      <button
        className="danger"
        onClick={() =>
          dispatch({ type: "timeline/deleteItems", actionId: action.id, itemIds: [item.id] })
        }
      >
        <Trash2 size={15} /> 블록 삭제
      </button>
    </div>
  );
}
