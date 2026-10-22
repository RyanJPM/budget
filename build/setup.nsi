Unicode true
!include "MUI2.nsh"

Name "Budget"
OutFile "/workspace/Budget-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Budget"
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Budget.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Ouvrir Budget"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

Section "Installer"
  SetOutPath "$INSTDIR"
  File /r "/workspace/budget-app/dist/win-unpacked/*.*"
  WriteUninstaller "$INSTDIR\Desinstaller.exe"
  CreateShortCut "$DESKTOP\Budget.lnk" "$INSTDIR\Budget.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateDirectory "$SMPROGRAMS\Budget"
  CreateShortCut "$SMPROGRAMS\Budget\Budget.lnk" "$INSTDIR\Budget.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Budget\Désinstaller.lnk" "$INSTDIR\Desinstaller.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Budget.lnk"
  Delete "$SMPROGRAMS\Budget\Budget.lnk"
  Delete "$SMPROGRAMS\Budget\Désinstaller.lnk"
  RMDir "$SMPROGRAMS\Budget"
  RMDir /r "$INSTDIR"
SectionEnd
