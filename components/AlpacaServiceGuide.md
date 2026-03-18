
# Alpaca リレーサービス管理ガイド

リレーが `EADDRINUSE` で手動起動できない場合、既にバックグラウンドでサービスが動作しています。

## 1. サービスの生存確認とログ表示
ターミナルで以下のコマンドを実行してください。

### サービスの状態確認
```bash
# サービス名が不明な場合、まず検索
systemctl list-units --type=service | grep -i alpaca

# 状態を確認 (例: サービス名が alpaca の場合)
sudo systemctl status alpaca
```

### リアルタイムログの表示
リレーが何を受け取っているか、このコマンドを打ったまま N.I.N.A 等でスキャンしてください。
```bash
sudo journalctl -u alpaca -f
```

---

## 2. 【重要】ブラウザのWSに通信が出ない理由
アプリを **`https://`** で開いていませんか？

現代のブラウザ（Chrome/Edge等）は、**HTTPSのページから、暗号化されていない WebSocket (ws://) への接続を遮断します。**（Mixed Content Error）

### 対策1：診断ツールで確認
追加した `alpaca-inspector.html` を開いてください。
もしブラウザのコンソール（F12 > Console）に **"Mixed Content"** や **"Security Error"** と赤文字で出ていれば、これが原因です。

### 対策2：Nginxのリバースプロキシ設定
Nginxを使っている場合、11112ポートを HTTPS (wss://) として公開するように設定する必要があります。

**推奨される Nginx 設定例 (/etc/nginx/sites-available/default):**
```nginx
location /alpaca-ws/ {
    proxy_pass http://127.0.0.1:11112/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}
```
このように設定し、アプリ側の接続先を `wss://ドメイン名/alpaca-ws/` に向けるのが正攻法です。

---

## 3. クライアント(N.I.N.A等)から見えない場合
サービスが動いているのに N.I.N.A のスキャンに反応しない場合は以下を試してください：

1. **IP直打ち**: N.I.N.A の Alpaca 設定で `127.0.0.1` ではなく、サーバーの実際のIPアドレスとポート `11111` を手動入力する。
2. **ファイアウォール**: サーバー側で `sudo ufw allow 11111/tcp` および `sudo ufw allow 32227/udp` が許可されているか確認する。
