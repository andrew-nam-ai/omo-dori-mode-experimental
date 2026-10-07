[English](README.md) · [简体中文](README.zh-CN.md) · **日本語** · [한국어](README.ko.md)

# omo-dori-mode-experimental

Dori モードは、コーディングエージェントのセッションひとつを常駐型のメッセンジャーエージェントに変えます。あなたが話す相手は Telegram か Discord のボットひとつだけ。Dori は仕事ごとに herdr のタブでエージェントセッションを立ち上げて任せ、自分が立ち上げたセッションをすべて覚えておき、仕事が本当に終わったときだけ閉じます。PR がマージされ、issue が閉じ、バージョンが公開されたあとです。

中身はスキル(`skills/dori-mode/SKILL.md` と references)と、bun + TypeScript の小さな CLI `dori` です。実験段階なので、粗いところがあります。

## インストール

```sh
curl -fsSL https://raw.githubusercontent.com/sisyphuslabs/omo-dori-mode-experimental/main/install.sh | bash
```

リポジトリを `~/.dori/src` に取得し、スキルを `~/.agents/skills/dori-mode` にリンクし、`bun link` で `dori` を PATH に通し、設定の例を `~/.dori/config.json` にコピーします。エージェントが別の場所からスキルを読む場合は `SKILLS_DIR` を指定してください。

あとは herdr の中でエージェントを開いて「Dori mode」と言うだけです。

## 必要なもの

- [bun](https://bun.sh) 1.3 以上と git
- [herdr](https://herdr.dev):レーンが動くターミナルマルチプレクサ
- スキルを読み込むコーディングエージェント([OmO](https://github.com/code-yeongyu/oh-my-openagent) 向けに作っていますが、起動コマンドは設定で変えられます)
- PR のマージと issue のクローズを確認する `gh`(GitHub CLI)、公開バージョンを確認する `npm`
- ボット本体のための [agent-messenger](https://github.com/agent-messenger/agent-messenger)

ホスト監視は macOS ですべて動きます。Linux では負荷とディスクだけを見て、メモリとスワップは不明として扱います。

## Dori の名前

Dori は最初に、自分を何と呼べばいいかを聞いてきます。「Dori」のままでもいいし、ShipDori や WorkDori のように Dori で終わる名前でも構いません。複数動かすときに見分けやすくなります。決めた名前はボット名、メッセージの署名、モード名にそのまま使われ、次からは「ShipDori mode」の一言で戻せます。

## 設定

設定はすべて `~/.dori/config.json` にあり、どの項目も省略できます。たいてい決めておくのは次の項目です。

| 項目 | 意味 |
|---|---|
| `leadPane` | Dori 自身の herdr pane(`herdr pane current`)。レーンの報告はここに届きます。 |
| `laneWorkspace` | 新しいレーンのタブを開く herdr workspace |
| `defaultCwd` | レーンが始まるディレクトリで、レーンが worktree を作るリポジトリ |
| `agentCommand` | エージェントの起動コマンド。`{model}` と `{prompt}` を含む argv のリスト |
| `hooks.threadReply`, `hooks.threadDone` | メッセンジャー CLI を `{thread}` と `{text}` を含む argv のリストで。レーンの進捗投稿と完了表示に使います。 |

残り(時間、しきい値、heavy スロット数)は既定値で十分です。全項目の表は [`references/scripts.md`](skills/dori-mode/references/scripts.md) にあります。環境変数 `DORI_CONFIG`、`DORI_STATE_DIR`、`DORI_LEAD_PANE` はファイルより優先されます。

## セッションレジストリ

レーンごとに `~/.dori/state/lanes/` の下に JSON ファイルがひとつできます。メッセンジャーのスレッドと herdr の pane、pane とエージェントのセッション id を結びつけ、状態(`working`、`done-claimed`、`verified-done`、`not-done`、`closed`)とその変化の履歴を残します。

`dori sync` はこの記録を実際に動いている pane と突き合わせて、ずれを教えてくれます。消えた pane、変わったセッション id、完了を証明する手段がないレーンなどです。何も削除しません。`--write` を付けると、見つけたセッション id を保存します。

## 5 分の完了フロー

レーンが完了を申告します。

```sh
dori claim-done fix-login --evidence "merged acme/app#412 (a1b2c3d)"
```

Dori には `LANE_DONE_CLAIMED` が届き、レーンには 5 分後に閉じると伝わります。その間に異議を出せます。

```sh
dori object-done fix-login --reason "changelog の項目が抜けている"
```

理由はそのままレーンに届き、レーンは直してからもう一度申告します。誰も異議を出さなければ、時間が来たところで `dori watch` がレーンを閉じます。閉じる前に `Done =` のシグナルをすべて実際に読み直し、worktree にリモートへ届いていないコミットや未コミットの変更があれば閉じません。その場合、申告は理由付きで not-done に戻ります。watcher を再起動しても、5 分の時計は最初からにはなりません。

## コマンド

| コマンド | やること |
|---|---|
| `dori launch <key> ...` | brief にレーンの footer を書き、タブを開き、エージェントを起動し、起動エラーを確認 |
| `dori adopt <key> --pane ID ...` | すでに動いているレーンを登録 |
| `dori sync [--write]` | レジストリと実際の pane を比べ、ずれを表示 |
| `dori claim-done` / `object-done` / `close` | 完了フロー |
| `dori watch` | 自動クローズの watcher。常駐モニターとして動かします |
| `dori freshness [--loop MIN]` | 静かになったレーンに声をかけ、最後の報告をスレッドに投稿 |
| `dori dead-panes [--loop MIN]` | 止まったエージェントの pane を報告 |
| `dori guard [--loop MIN]` | 負荷、メモリ、ディスク、pane 数の警告 |
| `dori heavy <label> -- <cmd>` | スロットが空いて負荷が低いときだけビルドやテストを実行 |

pane に送る文字列は必ず引数ひとつとして渡し、シェル文字列を通しません。Enter が本当に入ったかも確認します。

## テスト

CI はありません。テストはローカルで回します。

```sh
cd skills/dori-mode/scripts
bun install
bun test           # 偽の herdr、git、gh で振る舞いを確かめるテスト
bunx tsc --noEmit  # 型チェック
```

テストが本物の pane、リポジトリ、GitHub に触れることはありません。

## ライセンス

MIT
