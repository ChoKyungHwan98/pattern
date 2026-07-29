import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { z } from "zod";
import type { ProjectDocument } from "../domain/project";

const AUTOSAVE_KEY = "combat-workbench:autosave:v1";

const projectDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    project: z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
    spaceMode: z.enum(["2d", "3d"]),
    assets: z.array(z.unknown()),
    variables: z.array(z.unknown()),
    actors: z.array(z.unknown()),
    actions: z.array(z.unknown()),
    behaviorGraphs: z.array(z.unknown()),
    testScenes: z.array(z.unknown()),
    editor: z.object({ workspace: z.string() }).passthrough(),
  })
  .passthrough();

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as object);

function parseProject(json: string): ProjectDocument {
  const parsed = JSON.parse(json) as unknown;
  const result = projectDocumentSchema.safeParse(parsed);
  if (!result.success) throw new Error("지원하지 않거나 손상된 전투 AI 프로젝트 파일입니다.");
  return parsed as ProjectDocument;
}

async function chooseSavePath(projectName: string): Promise<string | null> {
  return save({
    title: "전투 AI 프로젝트 저장",
    defaultPath: `${projectName}.combat.json`,
    filters: [{ name: "전투 AI 프로젝트", extensions: ["combat.json", "json"] }],
  });
}

export const projectRepository = {
  async open(): Promise<{ document: ProjectDocument; filePath?: string } | null> {
    if (!isTauri()) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,.combat.json";
      return new Promise((resolve, reject) => {
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return resolve(null);
          try {
            resolve({ document: parseProject(await file.text()) });
          } catch (error) {
            reject(error);
          }
        };
        input.click();
      });
    }
    const selected = await open({
      title: "전투 AI 프로젝트 열기",
      multiple: false,
      filters: [{ name: "전투 AI 프로젝트", extensions: ["combat.json", "json"] }],
    });
    if (!selected || Array.isArray(selected)) return null;
    return { document: parseProject(await readTextFile(selected)), filePath: selected };
  },

  async save(documentValue: ProjectDocument, filePath?: string): Promise<string | undefined> {
    if (!isTauri()) {
      await this.saveAs(documentValue);
      return filePath;
    }
    const target = filePath ?? (await chooseSavePath(documentValue.project.name));
    if (!target) return undefined;
    await writeTextFile(target, JSON.stringify(documentValue, null, 2));
    return target;
  },

  async saveAs(documentValue: ProjectDocument): Promise<string | undefined> {
    if (!isTauri()) {
      const blob = new Blob([JSON.stringify(documentValue, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${documentValue.project.name}.combat.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      return undefined;
    }
    const target = await chooseSavePath(documentValue.project.name);
    if (!target) return undefined;
    await writeTextFile(target, JSON.stringify(documentValue, null, 2));
    return target;
  },

  async saveAutosave(documentValue: ProjectDocument): Promise<void> {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(documentValue));
  },

  loadAutosave(): ProjectDocument | null {
    const value = localStorage.getItem(AUTOSAVE_KEY);
    if (!value) return null;
    try {
      return parseProject(value);
    } catch {
      return null;
    }
  },
};
