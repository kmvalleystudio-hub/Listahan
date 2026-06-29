Listahan — Play Store Checklist App
====================================

RUN (separate PowerShell window — leave it open)
------------------------------------------------

  powershell -File C:\SayCart\tools\playstore-checklist\start.ps1

Browser opens to http://127.0.0.1:9473

Press Ctrl+C in that PowerShell window to stop.

WHAT YOU WILL SEE
-----------------

- "Start here" box at the top with first-time setup commands
- Each checkbox has a blue "What you do" box underneath
- Commands show "RUN THIS IN POWERSHELL" with a Copy button
- Click Copy → paste into PowerShell → press Enter
- Your checked boxes save to progress.json automatically

QUICK START (copy these in order)
---------------------------------

1. cd C:\SayCart
2. npm install -g eas-cli
3. eas login
4. npm run build:aab

FILES
-----

  checklist-data.json  — all steps and commands
  progress.json        — your saved checkmarks
