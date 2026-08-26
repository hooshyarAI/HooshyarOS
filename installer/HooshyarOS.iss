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
Name: "{autoprograms}\HooshyarOS\HooshyarOS"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$p=Start-Process -FilePath '{app}\launch-hooshyar.cmd' -WorkingDirectory '{app}' -WindowStyle Hidden -PassThru; $d=(Get-Date).AddSeconds(20); do {{ try {{$r=Invoke-RestMethod 'http://127.0.0.1:4173/health' -TimeoutSec 2; break}} catch {{Start-Sleep -Milliseconds 500}} }} while ((Get-Date) -lt $d); Start-Process 'http://127.0.0.1:4173/'"""; WorkingDir: "{app}"
Name: "{autodesktop}\HooshyarOS"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$p=Start-Process -FilePath '{app}\launch-hooshyar.cmd' -WorkingDirectory '{app}' -WindowStyle Hidden -PassThru; $d=(Get-Date).AddSeconds(20); do {{ try {{$r=Invoke-RestMethod 'http://127.0.0.1:4173/health' -TimeoutSec 2; break}} catch {{Start-Sleep -Milliseconds 500}} }} while ((Get-Date) -lt $d); Start-Process 'http://127.0.0.1:4173/'"""; WorkingDir: "{app}"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install-health.ps1"""; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
