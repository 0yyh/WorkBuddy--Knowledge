@echo off
REM PKS Android APK 构建脚本（自包含）
REM 用途：在本机（Windows）重新构建 debug APK，绕过 bash 沙箱缺 uname/xargs 导致 gradlew 失败的问题。
REM 用法：在仓库根目录直接双击或 `cmd /c build-apk.bat`
cd /d D:\WorkBuddy--Knowledge\apps\web\android
set JAVA_HOME=D:\JDK\jdk-19.0.1
set ANDROID_HOME=D:\Android SDK
set PATH=%JAVA_HOME%\bin;%PATH%
call gradlew.bat assembleDebug --no-daemon --console=plain
if errorlevel 1 (
  echo [ERROR] APK 构建失败，请检查上面的输出。
  exit /b 1
)
echo [OK] APK 已生成: app\build\outputs\apk\debug\app-debug.apk
