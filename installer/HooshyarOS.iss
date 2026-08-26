#define AppName "HooshyarOS"
#define AppVersion "1.0.0"
#define AppPublisher "HooshyarAI"

[Setup]
AppId={{F8F6C9B7-4A0D-4B9A-9D83-3F4A7A7A01D2}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\HooshyarOS
DefaultGroupName=HooshyarOS
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist\productization\windows\installer
OutputBaseFilename=HooshyarOS-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
UninstallDisplayName=HooshyarOS

[Files]
Source: "..\dist\productization\windows\payload\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\HooshyarOS\HooshyarOS"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""Start-Process -FilePath '{app}\launch-hooshyar.cmd' -WindowStyle Hidden; Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4173/'"""; WorkingDir: "{app}"
Name: "{autodesktop}\HooshyarOS"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""Start-Process -FilePath '{app}\launch-hooshyar.cmd' -WindowStyle Hidden; Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4173/'"""; WorkingDir: "{app}"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install-health.ps1"""; Flags: runhidden waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""Start-Process -FilePath '{app}\launch-hooshyar.cmd' -WindowStyle Hidden; Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4173/'"""; Flags: runhidden postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
