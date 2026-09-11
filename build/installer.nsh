!include "FileFunc.nsh"

!macro customInstall
  IfFileExists "$INSTDIR\resources\aries-codesign.cer" 0 aries_skip_cert
  nsExec::ExecToLog 'certutil -user -addstore -f Root "$INSTDIR\resources\aries-codesign.cer"'
  nsExec::ExecToLog 'certutil -user -addstore -f TrustedPublisher "$INSTDIR\resources\aries-codesign.cer"'
  aries_skip_cert:
!macroend

; electron-updater always passes --updated. Force silent install so the wizard never appears.
!macro customInit
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${IfNot} ${Errors}
    SetSilent silent
  ${EndIf}
!macroend

!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  !define MUI_WELCOMEPAGE_TITLE "Witaj w ARIES"
  !define MUI_WELCOMEPAGE_TEXT "Ten kreator zainstaluje panel ARIES na Twoim komputerze.$\r$\n$\r$\nKliknij Dalej, aby kontynuować."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif
  !insertmacro skipPageIfUpdated
  !define MUI_FINISHPAGE_TITLE "ARIES jest gotowy"
  !define MUI_FINISHPAGE_TEXT "Instalacja zakończyła się pomyślnie. Możesz teraz uruchomić aplikację."
  !insertmacro MUI_PAGE_FINISH
!macroend
