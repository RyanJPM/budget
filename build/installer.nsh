!macro customInstall
  CreateShortCut "$DESKTOP\Budget.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Budget.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\icon.ico" 0
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Budget.lnk"
  Delete "$SMPROGRAMS\Budget.lnk"
!macroend
