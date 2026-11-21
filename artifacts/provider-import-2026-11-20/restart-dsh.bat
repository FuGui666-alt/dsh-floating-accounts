@echo off
REM DSH 重启：延迟 20s（保证汇报先送达）→ 结束 DeepSeek Harness 全部进程 → 3s 后拉起宿主
ping -n 21 127.0.0.1 >nul
taskkill /F /IM "DeepSeek Harness.exe" >nul 2>&1
ping -n 7 127.0.0.1 >nul
start "" "D:\FUGUI\ai\guanfangdsh\dsh\DeepSeek Harness.exe"
exit /b 0
