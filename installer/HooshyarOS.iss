#define AppName "HooshyarOS"
#define AppVersion "1.0.0"
#define AppPublisher "HooshyarAI"
#define AppURL "https://hooshyar.ai"

[Setup]
AppId={{F8F6C9B7-4A0D-4B9A-9D83-3F4A7A7A01D2}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={localappdata}\Programs\HooshyarOS
DefaultGroupName=HooshyarOS
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=lowest
OutputDir=..\dist\productization\windows\installer
OutputBaseFilename=HooshyarOS-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\hooshyaros.ico
SetupIconFile=..\dist\productization\windows\payload\hooshyaros.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "startmenuicon"; Description: "Create a &Start Menu shortcut"; GroupDescription: "Additional shortcuts:"
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "..\dist\productization\windows\payload\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\HooshyarOS\HooshyarOS"; Filename: "wscript.exe"; Parameters: """{app}\launch-hooshyar.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\hooshyaros.ico"; IconIndex: 0; Tasks: startmenuicon
Name: "{autodesktop}\HooshyarOS"; Filename: "wscript.exe"; Parameters: """{app}\launch-hooshyar.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\hooshyaros.ico"; IconIndex: 0; Tasks: desktopicon

[Run]
Filename: "wscript.exe"; Parameters: """{app}\launch-hooshyar.vbs"""; WorkingDir: "{app}"; Description: "Launch HooshyarOS"; Flags: runhidden nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
