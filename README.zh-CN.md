[English](README.md) · **简体中文** · [日本語](README.ja.md) · [한국어](README.ko.md)

# omo-dori-mode-experimental

Dori 模式把一个编程智能体会话变成常驻的消息智能体。你只需要在 Telegram 或 Discord 上和一个机器人对话。Dori 把每件事交给 herdr 标签页里单独启动的智能体会话，记住自己启动过的每个会话，只有在工作真正完成后才关闭它:PR 已合并、issue 已关闭、版本已发布。

它由一个技能(`skills/dori-mode/SKILL.md` 和 references)以及一个用 bun + TypeScript 写的小 CLI `dori` 组成。目前还是实验版本，会有不完善的地方。

## 安装

```sh
curl -fsSL https://raw.githubusercontent.com/sisyphuslabs/omo-dori-mode-experimental/main/install.sh | bash
```

它会把仓库克隆到 `~/.dori/src`,把技能链接到 `~/.agents/skills/dori-mode`,用 `bun link` 把 `dori` 放进 PATH,并把示例配置复制到 `~/.dori/config.json`。如果你的智能体从别的目录加载技能，请设置 `SKILLS_DIR`。

然后在 herdr 里打开智能体，说一句 "Dori mode" 就行。

## 依赖

- [bun](https://bun.sh) 1.3 或更新版本，以及 git
- [herdr](https://herdr.dev):运行各条 lane 的终端复用器
- 能加载技能的编程智能体(按 [OmO](https://github.com/code-yeongyu/oh-my-openagent) 设计，启动命令可以在配置里改)
- 用来确认 PR 合并和 issue 关闭的 `gh`(GitHub CLI),以及确认已发布版本的 `npm`
- 机器人本身用的 [agent-messenger](https://github.com/agent-messenger/agent-messenger)

主机监控在 macOS 上功能完整。在 Linux 上只看负载和磁盘，内存和 swap 显示为未知。

## 给你的 Dori 起名

Dori 第一件事就是问你该怎么称呼它。直接叫 "Dori" 可以，用 Dori 结尾的名字也可以，比如 ShipDori 或 WorkDori,同时运行好几个时更好区分。定下的名字会用在机器人名、消息落款和模式名上，下次只要说一句 "ShipDori mode" 就能重新开启。

## 配置

所有配置都在 `~/.dori/config.json` 里，每一项都可以省略。通常需要设置的是这些:

| 字段 | 含义 |
|---|---|
| `leadPane` | Dori 自己的 herdr pane(`herdr pane current`)。各条 lane 的汇报会发到这里。 |
| `laneWorkspace` | 新 lane 标签页打开的 herdr workspace |
| `defaultCwd` | lane 的起始目录，也是 lane 创建 worktree 的仓库 |
| `agentCommand` | 启动智能体的命令，写成含 `{model}` 和 `{prompt}` 的 argv 列表 |
| `hooks.threadReply`, `hooks.threadDone` | 你的消息 CLI,写成含 `{thread}` 和 `{text}` 的 argv 列表，用来发布 lane 进度和标记完成 |

其余项(时间、阈值、heavy 槽位数)用默认值就够了。完整表格见 [`references/scripts.md`](skills/dori-mode/references/scripts.md)。环境变量 `DORI_CONFIG`、`DORI_STATE_DIR`、`DORI_LEAD_PANE` 优先于配置文件。

## 会话登记表

每条 lane 在 `~/.dori/state/lanes/` 下有一个 JSON 文件。它把消息线程对应到 herdr pane,把 pane 对应到智能体自己的会话 id,并记录状态(`working`、`done-claimed`、`verified-done`、`not-done`、`closed`)以及每次变化的历史。

`dori sync` 会把登记表和实际在运行的 pane 对照，告诉你哪里对不上：消失的 pane、变了的会话 id、没有办法证明已完成的 lane。它不会删除任何东西。加上 `--write` 会把找到的会话 id 存下来。

## 5 分钟完成流程

lane 声明自己已完成:

```sh
dori claim-done fix-login --evidence "merged acme/app#412 (a1b2c3d)"
```

Dori 收到 `LANE_DONE_CLAIMED`,lane 会被告知 5 分钟后关闭。这期间你可以提出异议:

```sh
dori object-done fix-login --reason "缺少 changelog 条目"
```

理由会原样发给 lane,lane 修好后再次声明完成。如果没人反对，时间一到 `dori watch` 就会关闭这条 lane。关闭前它会重新实时读取每个 `Done =` 信号；如果 worktree 里还有没推到远端的提交或未提交的改动，它就不关闭，声明会带着原因退回 not-done。重启 watcher 不会让 5 分钟重新计时。

## 命令

| 命令 | 作用 |
|---|---|
| `dori launch <key> ...` | 在 brief 里写入 lane footer,打开标签页，启动智能体，检查启动错误 |
| `dori adopt <key> --pane ID ...` | 登记一条已经在运行的 lane |
| `dori sync [--write]` | 对照登记表和实际 pane,列出不一致 |
| `dori claim-done` / `object-done` / `close` | 完成流程 |
| `dori watch` | 自动关闭的 watcher,作为常驻监控运行 |
| `dori freshness [--loop MIN]` | 提醒变安静的 lane,再把它最后一条汇报发到线程里 |
| `dori dead-panes [--loop MIN]` | 报告已停止的智能体 pane |
| `dori guard [--loop MIN]` | 负载、内存、磁盘和 pane 数量告警 |
| `dori heavy <label> -- <cmd>` | 只在有空闲槽位且负载低时运行构建或测试 |

发给 pane 的文字总是作为一个参数传入，从不经过 shell 字符串，并且会确认 Enter 真的生效了。

## 测试

没有 CI,测试在本地运行:

```sh
cd skills/dori-mode/scripts
bun install
bun test           # 用假的 herdr、git、gh 验证行为
bunx tsc --noEmit  # 类型检查
```

测试不会碰真实的 pane、仓库或 GitHub。

## 许可证

MIT
