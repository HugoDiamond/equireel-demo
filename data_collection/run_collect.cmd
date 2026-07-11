@echo off
cd /d "C:\Users\Equireel 1\Documents\equireel-platform-dc"
"C:\Users\Equireel 1\anaconda3\python.exe" -m data_collection.collect >> data_collection\snapshots\collect.log 2>&1
