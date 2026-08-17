# T-Astro Web Studio: Windows EXE

## ビルド

```powershell
npm install
npm run electron:build
```

`release/T-Astro-Web-Studio-1.0.0-Setup.exe` が portable EXE として生成されます。インストーラー形式の NSIS を生成する場合は Windows 環境で `npx electron-builder --win nsis` を実行してください。Linux 上で NSIS を生成する場合は Wine が必要です。

## 実行時の構成

Electron は内部で `server.cjs` を 127.0.0.1:6002 で起動してから画面を開きます。これにより、Vite の開発サーバーへ依存せず、`dist/` 内の全 HTML エントリと Express API 中継を同一オリジンで使用できます。起動失敗時は白紙画面ではなく診断メッセージを表示します。

`solver_server.py` は配布物の resources/solver に含め、Python がインストールされている環境では既定で自動起動します。自動起動を無効にする場合は `T_ASTRO_AUTOSTART_SOLVER=0`、Python の場所を指定する場合は `T_ASTRO_SOLVER_PYTHON`、SolverAPI のポートを変更する場合は `T_ASTRO_SOLVER_PORT` を設定します。SolverAPI は既定で 6001、Web アプリは 6002 です。

## 天体機器の前提

Alpaca は Windows 上の Alpaca サーバーを起動し、機器の HTTP ポートをアプリから到達可能にしてください。INDI の Linux ドライバは Windows EXE に自動的に内包されません。Windows では INDI サーバーを WSL2、別の Linux PC、またはネットワーク上の INDI ホストで稼働させ、設定画面からそのホストの接続先を指定する必要があります。DSS と外部 plate-solver は既存の API プロキシ経由で動作し、外部サービスへのネットワーク接続が必要です。
