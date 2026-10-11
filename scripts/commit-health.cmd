@echo off
cd /d "%~dp0.."
git add apps/api/src/index.ts
echo chore: expose Railway git commit SHA on health endpoint> .git\MSG
git commit -F .git\MSG
git push origin HEAD
git log -1 --oneline
del .git\MSG
git status -sb
