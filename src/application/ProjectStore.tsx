import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch,
} from "immer";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { applyProjectCommand, type ProjectCommand } from "../domain/commands";
import { createDefaultProject } from "../domain/defaultProject";
import type { ProjectDocument } from "../domain/project";
import { projectRepository } from "../infrastructure/projectRepository";

enablePatches();

interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
}

interface StoreState {
  document: ProjectDocument;
  past: HistoryEntry[];
  future: HistoryEntry[];
  filePath?: string;
  dirty: boolean;
  lastSavedAt?: string;
}

type StoreAction =
  | { type: "dispatch"; command: ProjectCommand }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; document: ProjectDocument; filePath?: string }
  | { type: "saved"; filePath?: string; savedAt: string };

const initialState: StoreState = {
  document: createDefaultProject(),
  past: [],
  future: [],
  dirty: false,
};

function reducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case "dispatch": {
      const [next, patches, inversePatches] = produceWithPatches(
        state.document,
        (draft) => applyProjectCommand(draft, action.command),
      );
      if (patches.length === 0) return state;
      const entry = { patches, inversePatches };
      return {
        ...state,
        document: next,
        past: [...state.past.slice(-199), entry],
        future: [],
        dirty: true,
      };
    }
    case "undo": {
      const entry = state.past.at(-1);
      if (!entry) return state;
      return {
        ...state,
        document: applyPatches(state.document, entry.inversePatches),
        past: state.past.slice(0, -1),
        future: [entry, ...state.future],
        dirty: true,
      };
    }
    case "redo": {
      const entry = state.future[0];
      if (!entry) return state;
      return {
        ...state,
        document: applyPatches(state.document, entry.patches),
        past: [...state.past, entry],
        future: state.future.slice(1),
        dirty: true,
      };
    }
    case "replace":
      return {
        document: action.document,
        past: [],
        future: [],
        filePath: action.filePath,
        dirty: false,
      };
    case "saved":
      return {
        ...state,
        filePath: action.filePath ?? state.filePath,
        dirty: false,
        lastSavedAt: action.savedAt,
      };
  }
}

export interface ProjectStoreValue extends StoreState {
  dispatch: (command: ProjectCommand) => void;
  undo: () => void;
  redo: () => void;
  newProject: () => void;
  open: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectStoreProvider({ children }: PropsWithChildren) {
  const [state, send] = useReducer(reducer, initialState);
  const dispatch = useCallback((command: ProjectCommand) => send({ type: "dispatch", command }), []);
  const undo = useCallback(() => send({ type: "undo" }), []);
  const redo = useCallback(() => send({ type: "redo" }), []);
  const newProject = useCallback(
    () => send({ type: "replace", document: createDefaultProject() }),
    [],
  );

  const open = useCallback(async () => {
    const result = await projectRepository.open();
    if (result) send({ type: "replace", document: result.document, filePath: result.filePath });
  }, []);

  const save = useCallback(async () => {
    const filePath = await projectRepository.save(state.document, state.filePath);
    if (filePath) send({ type: "saved", filePath, savedAt: new Date().toISOString() });
  }, [state.document, state.filePath]);

  const saveAs = useCallback(async () => {
    const filePath = await projectRepository.saveAs(state.document);
    if (filePath) send({ type: "saved", filePath, savedAt: new Date().toISOString() });
  }, [state.document]);

  useEffect(() => {
    if (!state.dirty) return;
    const timer = window.setTimeout(() => {
      void projectRepository.saveAutosave(state.document);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [state.dirty, state.document]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      } else if (key === "s") {
        event.preventDefault();
        void (event.shiftKey ? saveAs() : save());
      } else if (key === "o") {
        event.preventDefault();
        void open();
      } else if (key === "n") {
        event.preventDefault();
        newProject();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [newProject, open, redo, save, saveAs, undo]);

  const value = useMemo<ProjectStoreValue>(
    () => ({
      ...state,
      dispatch,
      undo,
      redo,
      newProject,
      open,
      save,
      saveAs,
    }),
    [dispatch, newProject, open, redo, save, saveAs, state, undo],
  );

  return <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjectStore(): ProjectStoreValue {
  const store = useContext(ProjectStoreContext);
  if (!store) throw new Error("ProjectStoreProvider 안에서 사용해야 합니다.");
  return store;
}
