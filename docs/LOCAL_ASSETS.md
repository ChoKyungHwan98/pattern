# Local licensed assets

## Human Character Dummy

- Source: [Unity Asset Store — Human Character Dummy](https://assetstore.unity.com/packages/3d/characters/humanoids/humans/human-character-dummy-178395)
- Publisher: Kevin Iglesias
- Package version: 2.0
- License shown by the store: Standard Unity Asset Store EULA
- Local role: neutral humanoid preview model for the Scene and Action authoring views

The original Unity package and extracted FBX files are licensed content. They
must remain on the licensed user's machine and are intentionally excluded from
Git by `public/local-assets/`.

Import the already-downloaded Asset Store package on Windows with:

```powershell
npm run assets:import-dummy
```

The importer copies only these runtime preview files:

- `HumanCharacterDummy_M.fbx`
- `HumanCharacterDummy_F.fbx`
- `HumanCharacterDummy_ColorPalette.png`

The app currently loads the male dummy as the boss preview. The female dummy is
reserved for a player or secondary-agent preview. Neither file is a distributable
part of this source repository.
