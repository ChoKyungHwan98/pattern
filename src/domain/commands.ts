import type { Draft } from "immer";
import {
  type ActionDefinition,
  type AssetRecord,
  type ConditionExpr,
  createId,
  type FsmGraph,
  type InterruptPolicy,
  type ProjectDocument,
  type StateNode,
  type TimelineItem,
  type Transition,
} from "./project";

export type ProjectCommand =
  | { type: "project/rename"; name: string }
  | { type: "editor/workspace"; workspace: ProjectDocument["editor"]["workspace"] }
  | { type: "editor/selectGraph"; graphId?: string }
  | { type: "editor/selectState"; stateId?: string }
  | { type: "editor/selectTransition"; transitionId?: string }
  | { type: "editor/selectAction"; actionId?: string }
  | { type: "editor/selectAsset"; assetId?: string }
  | { type: "editor/selectTimelineItems"; itemIds: string[] }
  | { type: "asset/add"; asset: AssetRecord }
  | { type: "asset/update"; assetId: string; patch: Partial<AssetRecord> }
  | { type: "asset/delete"; assetId: string }
  | { type: "action/add"; action: ActionDefinition }
  | { type: "action/rename"; actionId: string; name: string }
  | { type: "action/delete"; actionId: string }
  | { type: "timeline/addItem"; actionId: string; item: TimelineItem }
  | {
      type: "timeline/updateItem";
      actionId: string;
      itemId: string;
      patch: Partial<TimelineItem>;
    }
  | { type: "timeline/deleteItems"; actionId: string; itemIds: string[] }
  | { type: "fsm/addState"; graphId: string; state: StateNode }
  | { type: "fsm/renameState"; graphId: string; stateId: string; name: string }
  | {
      type: "fsm/moveState";
      graphId: string;
      stateId: string;
      position: { x: number; y: number };
    }
  | { type: "fsm/deleteState"; graphId: string; stateId: string }
  | { type: "fsm/setInitialState"; graphId: string; stateId: string }
  | {
      type: "fsm/setStateActions";
      graphId: string;
      stateId: string;
      entryActionIds: string[];
      updateActionIds: string[];
      exitActionIds: string[];
    }
  | { type: "fsm/addTransition"; graphId: string; transition: Transition }
  | {
      type: "fsm/updateTransition";
      graphId: string;
      transitionId: string;
      patch: {
        conditions?: ConditionExpr;
        priority?: number;
        interruptPolicy?: InterruptPolicy;
      };
    }
  | { type: "fsm/deleteTransition"; graphId: string; transitionId: string };

function findFsm(
  document: Draft<ProjectDocument>,
  graphId: string,
): Draft<FsmGraph> | undefined {
  const graph = document.behaviorGraphs.find((candidate) => candidate.id === graphId);
  return graph?.kind === "fsm" || graph?.kind === "hfsm" ? graph : undefined;
}

function touch(document: Draft<ProjectDocument>) {
  document.project.updatedAt = new Date().toISOString();
}

export function applyProjectCommand(
  document: Draft<ProjectDocument>,
  command: ProjectCommand,
): void {
  switch (command.type) {
    case "project/rename":
      document.project.name = command.name;
      break;
    case "editor/workspace":
      document.editor.workspace = command.workspace;
      return;
    case "editor/selectGraph":
      document.editor.selectedGraphId = command.graphId;
      return;
    case "editor/selectState":
      document.editor.selectedStateId = command.stateId;
      document.editor.selectedTransitionId = undefined;
      return;
    case "editor/selectTransition":
      document.editor.selectedTransitionId = command.transitionId;
      document.editor.selectedStateId = undefined;
      return;
    case "editor/selectAction":
      document.editor.selectedActionId = command.actionId;
      return;
    case "editor/selectAsset":
      document.editor.selectedAssetId = command.assetId;
      return;
    case "editor/selectTimelineItems":
      document.editor.selectedTimelineItemIds = command.itemIds;
      return;
    case "asset/add":
      document.assets.push(command.asset);
      document.editor.selectedAssetId = command.asset.id;
      break;
    case "asset/update": {
      const asset = document.assets.find((candidate) => candidate.id === command.assetId);
      if (asset) Object.assign(asset, command.patch);
      break;
    }
    case "asset/delete":
      document.assets = document.assets.filter((asset) => asset.id !== command.assetId);
      document.actors.forEach((actor) => {
        if (actor.characterAssetId === command.assetId) actor.characterAssetId = undefined;
      });
      if (document.editor.selectedAssetId === command.assetId) {
        document.editor.selectedAssetId = undefined;
      }
      break;
    case "action/add":
      document.actions.push(command.action);
      document.editor.selectedActionId = command.action.id;
      break;
    case "action/rename": {
      const action = document.actions.find((candidate) => candidate.id === command.actionId);
      if (action) action.name = command.name;
      break;
    }
    case "action/delete":
      document.actions = document.actions.filter((action) => action.id !== command.actionId);
      document.actors.forEach((actor) => {
        if (actor.defaultActionId === command.actionId) actor.defaultActionId = undefined;
      });
      document.behaviorGraphs.forEach((graph) => {
        if (graph.kind === "bt") {
          graph.nodes.forEach((node) => {
            if (node.actionId === command.actionId) node.actionId = undefined;
          });
          return;
        }
        graph.states.forEach((state) => {
          state.entryActionIds = state.entryActionIds.filter((id) => id !== command.actionId);
          state.updateActionIds = state.updateActionIds.filter((id) => id !== command.actionId);
          state.exitActionIds = state.exitActionIds.filter((id) => id !== command.actionId);
        });
      });
      break;
    case "timeline/addItem": {
      const action = document.actions.find((candidate) => candidate.id === command.actionId);
      action?.items.push(command.item);
      document.editor.selectedTimelineItemIds = [command.item.id];
      break;
    }
    case "timeline/updateItem": {
      const action = document.actions.find((candidate) => candidate.id === command.actionId);
      const item = action?.items.find((candidate) => candidate.id === command.itemId);
      if (item) Object.assign(item, command.patch);
      break;
    }
    case "timeline/deleteItems": {
      const action = document.actions.find((candidate) => candidate.id === command.actionId);
      if (action) action.items = action.items.filter((item) => !command.itemIds.includes(item.id));
      document.editor.selectedTimelineItemIds = [];
      break;
    }
    case "fsm/addState": {
      const graph = findFsm(document, command.graphId);
      graph?.states.push(command.state);
      document.editor.selectedStateId = command.state.id;
      break;
    }
    case "fsm/renameState": {
      const state = findFsm(document, command.graphId)?.states.find(
        (candidate) => candidate.id === command.stateId,
      );
      if (state) state.name = command.name;
      break;
    }
    case "fsm/moveState": {
      const state = findFsm(document, command.graphId)?.states.find(
        (candidate) => candidate.id === command.stateId,
      );
      if (state) state.position = command.position;
      break;
    }
    case "fsm/deleteState": {
      const graph = findFsm(document, command.graphId);
      if (!graph) break;
      graph.states = graph.states.filter((state) => state.id !== command.stateId);
      graph.transitions = graph.transitions.filter(
        (transition) =>
          transition.sourceStateId !== command.stateId &&
          transition.targetStateId !== command.stateId,
      );
      if (graph.initialStateId === command.stateId) graph.initialStateId = undefined;
      if (document.editor.selectedStateId === command.stateId) {
        document.editor.selectedStateId = undefined;
      }
      break;
    }
    case "fsm/setInitialState": {
      const graph = findFsm(document, command.graphId);
      if (graph?.states.some((state) => state.id === command.stateId)) {
        graph.initialStateId = command.stateId;
      }
      break;
    }
    case "fsm/setStateActions": {
      const state = findFsm(document, command.graphId)?.states.find(
        (candidate) => candidate.id === command.stateId,
      );
      if (state) {
        state.entryActionIds = command.entryActionIds;
        state.updateActionIds = command.updateActionIds;
        state.exitActionIds = command.exitActionIds;
      }
      break;
    }
    case "fsm/addTransition":
      findFsm(document, command.graphId)?.transitions.push(command.transition);
      document.editor.selectedTransitionId = command.transition.id;
      break;
    case "fsm/updateTransition": {
      const transition = findFsm(document, command.graphId)?.transitions.find(
        (candidate) => candidate.id === command.transitionId,
      );
      if (transition) Object.assign(transition, command.patch);
      break;
    }
    case "fsm/deleteTransition": {
      const graph = findFsm(document, command.graphId);
      if (graph) {
        graph.transitions = graph.transitions.filter(
          (transition) => transition.id !== command.transitionId,
        );
      }
      if (document.editor.selectedTransitionId === command.transitionId) {
        document.editor.selectedTransitionId = undefined;
      }
      break;
    }
  }
  touch(document);
}

export function createState(name: string, position: { x: number; y: number }): StateNode {
  return {
    id: createId("state"),
    name,
    position,
    entryActionIds: [],
    updateActionIds: [],
    exitActionIds: [],
  };
}
