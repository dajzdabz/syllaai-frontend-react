@echo off
echo Starting Chrome with debugging on port 9222...
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug-profile" --disable-extensions --no-first-run
echo Chrome started. Check if port 9222 is listening.