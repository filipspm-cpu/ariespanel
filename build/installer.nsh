!macro customWelcomePage
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
  !define MUI_FINISHPAGE_TITLE "ARIES jest gotowy"
  !define MUI_FINISHPAGE_TEXT "Instalacja zakończyła się pomyślnie. Możesz teraz uruchomić aplikację."
  !insertmacro MUI_PAGE_FINISH
!macroend
