import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createSamplePatternSet } from "../editor/patternLibrary";
import { createEnginePackage } from "./enginePackage";

describe("engine packages", () => {
  it("Unity 6 UPM 설치 구조와 런타임·에디터 테스트를 함께 내보낸다", async () => {
    const zip = await JSZip.loadAsync(await createEnginePackage(createSamplePatternSet(), "unity"));
    expect(zip.file("com.gamedesignstudio.pattern/package.json")).toBeTruthy();
    expect(zip.file("com.gamedesignstudio.pattern/Runtime/PatternRunner.cs")).toBeTruthy();
    expect(zip.file("com.gamedesignstudio.pattern/Editor/PatternImporter.cs")).toBeTruthy();
    expect(zip.file("com.gamedesignstudio.pattern/Tests/Runtime/PatternRunnerTests.cs")).toBeTruthy();
    expect(zip.file("com.gamedesignstudio.pattern/Samples~/CinderKnight/CinderKnight.gpattern")).toBeTruthy();
  });

  it("Unreal Runtime·Editor 모듈과 자동화 테스트를 포함한 플러그인을 내보낸다", async () => {
    const zip = await JSZip.loadAsync(await createEnginePackage(createSamplePatternSet(), "unreal"));
    expect(zip.file("GameDesignStudioPattern/GameDesignStudioPattern.uplugin")).toBeTruthy();
    expect(zip.file("GameDesignStudioPattern/Source/GameDesignStudioPattern/Public/GDSPatternComponent.h")).toBeTruthy();
    expect(zip.file("GameDesignStudioPattern/Source/GameDesignStudioPatternEditor/Private/GDSPatternFactory.cpp")).toBeTruthy();
    expect(zip.file("GameDesignStudioPattern/Source/GameDesignStudioPattern/Private/Tests/GDSPatternAutomationTest.cpp")).toBeTruthy();
  });
});
