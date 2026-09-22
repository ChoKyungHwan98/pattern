param(
    [string]$PackagePath = "$env:APPDATA\Unity\Asset Store-5.x\Kevin Iglesias\3D ModelsCharactersHumanoidsHumans\Human Character Dummy.unitypackage"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PackagePath)) {
    throw "Human Character Dummy package was not found: $PackagePath"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = Join-Path $projectRoot "public\local-assets\human-character-dummy"
$systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$extractRoot = Join-Path $systemTemp ("combat-pattern-editor-dummy-" + [guid]::NewGuid().ToString("N"))
$resolvedExtractRoot = [System.IO.Path]::GetFullPath($extractRoot)

if (-not $resolvedExtractRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use a temporary directory outside the system temp path."
}

$assets = @(
    @{ Guid = "d9cd8eb4a074cd84ab2686c58bcf21d9"; Name = "HumanCharacterDummy_M.fbx" },
    @{ Guid = "f1e8e1bfafe7fa241ba6b4181f3eba85"; Name = "HumanCharacterDummy_F.fbx" },
    @{ Guid = "7bb2015627426e34f80ef3235d97c0b4"; Name = "HumanCharacterDummy_ColorPalette.png" }
)

try {
    New-Item -ItemType Directory -Path $resolvedExtractRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
    tar -xf $PackagePath -C $resolvedExtractRoot

    foreach ($asset in $assets) {
        $source = Join-Path $resolvedExtractRoot "$($asset.Guid)\asset"
        if (-not (Test-Path -LiteralPath $source)) {
            throw "Expected package item is missing: $($asset.Guid)"
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $targetRoot $asset.Name) -Force
    }

    Get-ChildItem -LiteralPath $targetRoot | Select-Object Name, Length
}
finally {
    if (Test-Path -LiteralPath $resolvedExtractRoot) {
        Remove-Item -LiteralPath $resolvedExtractRoot -Recurse -Force
    }
}
