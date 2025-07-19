!macro customInstall
  ; Erstelle Data-Verzeichnis falls nicht vorhanden
  CreateDirectory "$INSTDIR\data"
  
  ; Setze Berechtigungen für Data-Verzeichnis
  AccessControl::GrantOnFile "$INSTDIR\data" "(BU)" "FullAccess"
  
  ; Überprüfe Windows-Version und setze Kompatibilitätsmodus
  ${If} ${IsWin10}
    WriteRegStr HKCU "Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" "$INSTDIR\KFZ Fac Pro.exe" "WIN8RTM"
  ${EndIf}
!macroend

!macro customUnInstall
  ; Lösche Registry-Einträge
  DeleteRegKey HKCU "Software\KFZFacPro"
!macroend