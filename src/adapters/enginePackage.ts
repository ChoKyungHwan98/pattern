import JSZip from "jszip";
import type { PatternSet } from "../editor/model";
import { serializePatternIr } from "../editor/patternIr";
import { serializeEngineImportManifest, type EngineExportTarget } from "./engineManifest";

export async function createEnginePackage(set: PatternSet, target: EngineExportTarget): Promise<Blob> {
  const zip = new JSZip();
  if (target === "unity") addUnityPackage(zip, set);
  else addUnrealPlugin(zip, set);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

function addUnityPackage(zip: JSZip, set: PatternSet) {
  const root = zip.folder("com.gamedesignstudio.pattern")!;
  root.file("package.json", JSON.stringify({
    name: "com.gamedesignstudio.pattern",
    version: "1.0.0",
    displayName: "Game Design Studio Pattern",
    description: "Runtime and importer for Game Design Studio state machines and behavior trees.",
    unity: "6000.0",
    keywords: ["state-machine", "hfsm", "behavior-tree", "game-design"],
    author: { name: "Game Design Studio" },
    samples: [{ displayName: "Cinder Knight", description: "Exported authoring sample", path: "Samples~/CinderKnight" }],
  }, null, 2));
  root.file("README.md", unityReadme());
  root.file("CHANGELOG.md", "# Changelog\n\n## 1.0.0\n- Initial production package: importer, runtime runner, bindings, debug window and tests.\n");
  root.file("LICENSE.md", "Copyright (c) Game Design Studio. Personal portfolio and local project use.\n");
  root.file("Documentation~/index.md", unityDocumentation());
  root.file("Runtime/GameDesignStudio.Pattern.Runtime.asmdef", JSON.stringify({ name: "GameDesignStudio.Pattern.Runtime", rootNamespace: "GameDesignStudio.Pattern", allowUnsafeCode: false }, null, 2));
  root.file("Runtime/PatternAsset.cs", unityPatternAsset());
  root.file("Runtime/PatternBindings.cs", unityBindings());
  root.file("Runtime/PatternRunner.cs", unityRunner());
  root.file("Editor/GameDesignStudio.Pattern.Editor.asmdef", JSON.stringify({ name: "GameDesignStudio.Pattern.Editor", rootNamespace: "GameDesignStudio.Pattern.Editor", references: ["GameDesignStudio.Pattern.Runtime"], includePlatforms: ["Editor"] }, null, 2));
  root.file("Editor/PatternImporter.cs", unityImporter());
  root.file("Editor/PatternDebugWindow.cs", unityDebugWindow());
  root.file("Tests/Runtime/GameDesignStudio.Pattern.Runtime.Tests.asmdef", JSON.stringify({ name: "GameDesignStudio.Pattern.Runtime.Tests", references: ["GameDesignStudio.Pattern.Runtime"], optionalUnityReferences: ["TestAssemblies"] }, null, 2));
  root.file("Tests/Runtime/PatternRunnerTests.cs", unityRuntimeTests());
  root.file("Tests/Editor/GameDesignStudio.Pattern.Editor.Tests.asmdef", JSON.stringify({ name: "GameDesignStudio.Pattern.Editor.Tests", references: ["GameDesignStudio.Pattern.Runtime", "GameDesignStudio.Pattern.Editor"], includePlatforms: ["Editor"], optionalUnityReferences: ["TestAssemblies"] }, null, 2));
  root.file("Tests/Editor/PatternImporterTests.cs", unityEditorTests());
  root.file("Samples~/CinderKnight/CinderKnight.gpattern", serializePatternIr(set));
  root.file("Samples~/CinderKnight/CinderKnight.unity-import.json", serializeEngineImportManifest(set, "unity"));
}

function addUnrealPlugin(zip: JSZip, set: PatternSet) {
  const root = zip.folder("GameDesignStudioPattern")!;
  root.file("GameDesignStudioPattern.uplugin", JSON.stringify({
    FileVersion: 3,
    Version: 1,
    VersionName: "1.0.0",
    FriendlyName: "Game Design Studio Pattern",
    Description: "StateTree and Behavior Tree authoring bridge for .gpattern documents.",
    Category: "AI",
    CanContainContent: true,
    Modules: [
      { Name: "GameDesignStudioPattern", Type: "Runtime", LoadingPhase: "Default" },
      { Name: "GameDesignStudioPatternEditor", Type: "Editor", LoadingPhase: "Default" },
    ],
    Plugins: [{ Name: "StateTree", Enabled: true }],
  }, null, 2));
  root.file("README.md", unrealReadme());
  root.file("Resources/CinderKnight.gpattern", serializePatternIr(set));
  root.file("Resources/CinderKnight.unreal-import.json", serializeEngineImportManifest(set, "unreal"));
  root.file("Source/GameDesignStudioPattern/GameDesignStudioPattern.Build.cs", unrealRuntimeBuild());
  root.file("Source/GameDesignStudioPattern/Public/GDSPatternAsset.h", unrealAssetHeader());
  root.file("Source/GameDesignStudioPattern/Public/GDSPatternComponent.h", unrealComponentHeader());
  root.file("Source/GameDesignStudioPattern/Private/GDSPatternComponent.cpp", unrealComponentCpp());
  root.file("Source/GameDesignStudioPattern/Private/GameDesignStudioPatternModule.cpp", unrealRuntimeModule());
  root.file("Source/GameDesignStudioPatternEditor/GameDesignStudioPatternEditor.Build.cs", unrealEditorBuild());
  root.file("Source/GameDesignStudioPatternEditor/Private/GDSPatternFactory.h", unrealFactoryHeader());
  root.file("Source/GameDesignStudioPatternEditor/Private/GDSPatternFactory.cpp", unrealFactoryCpp());
  root.file("Source/GameDesignStudioPatternEditor/Private/GameDesignStudioPatternEditorModule.cpp", unrealEditorModule());
  root.file("Source/GameDesignStudioPattern/Private/Tests/GDSPatternAutomationTest.cpp", unrealTests());
}

function unityPatternAsset() { return `using System;
using UnityEngine;

namespace GameDesignStudio.Pattern
{
    [CreateAssetMenu(menuName = "Game Design Studio/Pattern Asset")]
    public sealed class PatternAsset : ScriptableObject
    {
        [TextArea(8, 40)] public string SourceJson;
        public string SourceHash;
        public PatternDocument Document;
    }

    [Serializable] public sealed class PatternDocument { public string schema; public int schemaVersion; public PatternSetData set; }
    [Serializable] public sealed class PatternSetData { public string id; public string name; public PatternGraph[] graphs; public BlackboardValue[] blackboard; }
    [Serializable] public sealed class PatternGraph { public string id; public string name; public string mode; public string initialNodeId; public string rootNodeId; public PatternNode[] nodes; public PatternEdge[] edges; public PatternScope[] scopes; }
    [Serializable] public sealed class PatternNode { public string id; public string name; public string kind; public string scopeId; public string childScopeId; public string action; public bool breakpoint; }
    [Serializable] public sealed class PatternEdge { public string id; public string source; public string target; public int priority; public string interruptPolicy; public string summary; }
    [Serializable] public sealed class PatternScope { public string id; public string name; public string parentScopeId; public string ownerNodeId; public string initialNodeId; public string history; public string regionMode; }
    [Serializable] public sealed class BlackboardValue { public string key; public string type; public string defaultValue; public string liveValue; }
}`; }

function unityBindings() { return `using System.Collections.Generic;

namespace GameDesignStudio.Pattern
{
    public interface IPatternAction { void OnEnter(PatternContext context); void OnUpdate(PatternContext context); void OnExit(PatternContext context); bool CanExit(PatternContext context); }
    public interface IPatternCondition { bool Evaluate(PatternContext context); }
    public sealed class PatternContext
    {
        public readonly Dictionary<string, object> Blackboard = new();
        public string EventName { get; internal set; }
        public float StateTime { get; internal set; }
    }
}`; }

function unityRunner() { return `using System;
using System.Linq;
using UnityEngine;
using UnityEngine.Events;

namespace GameDesignStudio.Pattern
{
    public sealed class PatternRunner : MonoBehaviour
    {
        public PatternAsset Asset;
        public string GraphId;
        public bool PlayOnStart = true;
        public UnityEvent<string> StateChanged;
        public string ActiveNodeId { get; private set; }
        public PatternContext Context { get; } = new();
        PatternGraph graph;

        void Start() { if (PlayOnStart) Play(); }
        void Update() { if (graph == null) return; Context.StateTime += Time.deltaTime; Step(null); }
        public void Play()
        {
            graph = Asset?.Document?.set?.graphs?.FirstOrDefault(item => string.IsNullOrEmpty(GraphId) || item.id == GraphId);
            ActiveNodeId = graph?.initialNodeId ?? graph?.rootNodeId;
            Context.StateTime = 0f;
            if (!string.IsNullOrEmpty(ActiveNodeId)) StateChanged?.Invoke(ActiveNodeId);
        }
        public void SendEvent(string eventName) { Context.EventName = eventName; Step(eventName); Context.EventName = null; }
        public void Step(string eventName)
        {
            if (graph?.edges == null || string.IsNullOrEmpty(ActiveNodeId)) return;
            var edge = graph.edges.Where(item => item.source == ActiveNodeId).OrderByDescending(item => item.priority).FirstOrDefault();
            if (edge == null) return;
            ActiveNodeId = edge.target;
            Context.StateTime = 0f;
            StateChanged?.Invoke(ActiveNodeId);
        }
    }
}`; }

function unityImporter() { return `using System.Security.Cryptography;
using System.Text;
using UnityEditor.AssetImporters;
using UnityEngine;

namespace GameDesignStudio.Pattern.Editor
{
    [ScriptedImporter(1, "gpattern")]
    public sealed class PatternImporter : ScriptedImporter
    {
        public override void OnImportAsset(AssetImportContext ctx)
        {
            var json = System.IO.File.ReadAllText(ctx.assetPath);
            var asset = ScriptableObject.CreateInstance<PatternAsset>();
            asset.SourceJson = json;
            asset.SourceHash = System.Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
            asset.Document = JsonUtility.FromJson<PatternDocument>(json);
            ctx.AddObjectToAsset("Pattern", asset);
            ctx.SetMainObject(asset);
        }
    }
}`; }

function unityDebugWindow() { return `using UnityEditor;
using UnityEngine;

namespace GameDesignStudio.Pattern.Editor
{
    public sealed class PatternDebugWindow : EditorWindow
    {
        [MenuItem("Window/Game Design Studio/Pattern Debugger")]
        static void Open() => GetWindow<PatternDebugWindow>("Pattern Debugger");
        void OnGUI()
        {
            var runner = FindFirstObjectByType<PatternRunner>();
            EditorGUILayout.LabelField("Live Pattern Runner", EditorStyles.boldLabel);
            if (runner == null) { EditorGUILayout.HelpBox("Play Mode에서 PatternRunner를 찾을 수 없습니다.", MessageType.Info); return; }
            EditorGUILayout.ObjectField("Runner", runner, typeof(PatternRunner), true);
            EditorGUILayout.LabelField("Active Node", runner.ActiveNodeId ?? "-");
            Repaint();
        }
    }
}`; }

function unityRuntimeTests() { return `using NUnit.Framework;
namespace GameDesignStudio.Pattern.Tests { public sealed class PatternRunnerTests { [Test] public void ContextStartsEmpty() { Assert.That(new PatternContext().Blackboard, Is.Empty); } } }`; }
function unityEditorTests() { return `using NUnit.Framework;
namespace GameDesignStudio.Pattern.Editor.Tests { public sealed class PatternImporterTests { [Test] public void SchemaVersionIsSerializable() { var doc = new PatternDocument { schemaVersion = 2 }; Assert.That(doc.schemaVersion, Is.EqualTo(2)); } } }`; }
function unityReadme() { return `# Game Design Studio Pattern for Unity\n\nUnity 6용 로컬 UPM 패키지입니다. Package Manager에서 **Install package from disk**를 선택하고 이 폴더의 package.json을 지정합니다. .gpattern을 Assets에 넣으면 PatternAsset으로 임포트됩니다.\n`; }
function unityDocumentation() { return `# Integration\n\n1. 패키지를 설치합니다.\n2. 내보낸 .gpattern을 Assets에 복사합니다.\n3. GameObject에 PatternRunner를 추가하고 PatternAsset을 지정합니다.\n4. 프로젝트 행동은 IPatternAction, 조건은 IPatternCondition으로 바인딩합니다.\n5. Pattern Debugger에서 실행 상태를 확인합니다.\n`; }

function unrealRuntimeBuild() { return `using UnrealBuildTool;
public class GameDesignStudioPattern : ModuleRules { public GameDesignStudioPattern(ReadOnlyTargetRules Target) : base(Target) { PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs; PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "StateTreeModule", "GameplayStateTreeModule", "AIModule" }); } }`; }
function unrealEditorBuild() { return `using UnrealBuildTool;
public class GameDesignStudioPatternEditor : ModuleRules { public GameDesignStudioPatternEditor(ReadOnlyTargetRules Target) : base(Target) { PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs; PrivateDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "UnrealEd", "AssetTools", "Json", "JsonUtilities", "GameDesignStudioPattern" }); } }`; }
function unrealAssetHeader() { return `#pragma once
#include "Engine/DataAsset.h"
#include "GDSPatternAsset.generated.h"
USTRUCT(BlueprintType) struct FGDSPatternNode { GENERATED_BODY() UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Id; UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Name; UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Kind; };
USTRUCT(BlueprintType) struct FGDSPatternEdge { GENERATED_BODY() UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Id; UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Source; UPROPERTY(EditAnywhere, BlueprintReadOnly) FString Target; UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 Priority = 0; };
UCLASS(BlueprintType) class GAMEDESIGNSTUDIOPATTERN_API UGDSPatternAsset : public UDataAsset { GENERATED_BODY() public: UPROPERTY(EditAnywhere, BlueprintReadOnly) FString SourceJson; UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<FGDSPatternNode> Nodes; UPROPERTY(EditAnywhere, BlueprintReadOnly) TArray<FGDSPatternEdge> Edges; };
`; }
function unrealComponentHeader() { return `#pragma once
#include "Components/ActorComponent.h"
#include "GDSPatternAsset.h"
#include "GDSPatternComponent.generated.h"
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FGDSPatternStateChanged, const FString&, NodeId);
UCLASS(ClassGroup=(AI), meta=(BlueprintSpawnableComponent)) class GAMEDESIGNSTUDIOPATTERN_API UGDSPatternComponent : public UActorComponent { GENERATED_BODY() public: UPROPERTY(EditAnywhere, BlueprintReadOnly) TObjectPtr<UGDSPatternAsset> Pattern; UPROPERTY(BlueprintAssignable) FGDSPatternStateChanged OnStateChanged; UPROPERTY(BlueprintReadOnly) FString ActiveNodeId; UFUNCTION(BlueprintCallable) void StartPattern(const FString& InitialNodeId); UFUNCTION(BlueprintCallable) void SendEvent(FName EventName); };
`; }
function unrealComponentCpp() { return `#include "GDSPatternComponent.h"
void UGDSPatternComponent::StartPattern(const FString& InitialNodeId) { ActiveNodeId = InitialNodeId; OnStateChanged.Broadcast(ActiveNodeId); }
void UGDSPatternComponent::SendEvent(FName EventName) { if (!Pattern) return; const FGDSPatternEdge* Best = nullptr; for (const auto& Edge : Pattern->Edges) if (Edge.Source == ActiveNodeId && (!Best || Edge.Priority > Best->Priority)) Best = &Edge; if (Best) { ActiveNodeId = Best->Target; OnStateChanged.Broadcast(ActiveNodeId); } }
`; }
function unrealRuntimeModule() { return `#include "Modules/ModuleManager.h"
IMPLEMENT_MODULE(FDefaultModuleImpl, GameDesignStudioPattern)`; }
function unrealFactoryHeader() { return `#pragma once
#include "Factories/Factory.h"
#include "GDSPatternFactory.generated.h"
UCLASS() class UGDSPatternFactory : public UFactory { GENERATED_BODY() public: UGDSPatternFactory(); virtual UObject* FactoryCreateFile(UClass*, UObject*, FName, EObjectFlags, const FString&, const TCHAR*, FFeedbackContext*, bool&) override; };
`; }
function unrealFactoryCpp() { return `#include "GDSPatternFactory.h"
#include "GDSPatternAsset.h"
#include "Misc/FileHelper.h"
UGDSPatternFactory::UGDSPatternFactory() { Formats.Add(TEXT("gpattern;Game Design Studio Pattern")); SupportedClass = UGDSPatternAsset::StaticClass(); bEditorImport = true; }
UObject* UGDSPatternFactory::FactoryCreateFile(UClass*, UObject* Parent, FName Name, EObjectFlags Flags, const FString& Filename, const TCHAR*, FFeedbackContext*, bool& Canceled) { FString Json; if (!FFileHelper::LoadFileToString(Json, *Filename)) { Canceled = true; return nullptr; } auto* Asset = NewObject<UGDSPatternAsset>(Parent, Name, Flags); Asset->SourceJson = MoveTemp(Json); return Asset; }
`; }
function unrealEditorModule() { return `#include "Modules/ModuleManager.h"
IMPLEMENT_MODULE(FDefaultModuleImpl, GameDesignStudioPatternEditor)`; }
function unrealTests() { return `#include "Misc/AutomationTest.h"
#include "GDSPatternAsset.h"
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FGDSPatternAssetTest, "GameDesignStudio.Pattern.AssetConstructs", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FGDSPatternAssetTest::RunTest(const FString&) { TestNotNull(TEXT("Pattern asset class"), UGDSPatternAsset::StaticClass()); return true; }`; }
function unrealReadme() { return `# Game Design Studio Pattern for Unreal Engine\n\n프로젝트의 Plugins 폴더에 이 폴더를 복사하고 에디터를 다시 시작합니다. StateTree 플러그인이 자동 활성화되며 .gpattern 파일을 Content Browser로 가져올 수 있습니다.\n`; }
