[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · **한국어**

# omo-dori-mode-experimental

Dori 모드는 코딩 에이전트 세션 하나를 늘 켜져 있는 메신저 에이전트로 바꿉니다. 사용자는 텔레그램이나 디스코드에서 봇 하나와 이야기합니다. Dori는 일마다 herdr 탭에 에이전트 세션을 따로 띄워 맡기고, 자기가 띄운 세션을 모두 기억하며, 일이 정말 끝났을 때만 닫습니다. PR이 머지되고, 이슈가 닫히고, 버전이 배포된 다음에요.

스킬(`skills/dori-mode/SKILL.md`와 references)과 bun + TypeScript로 만든 작은 CLI `dori`로 구성됩니다. 아직 실험 단계라 거친 부분이 남아 있어요.

## 설치

```sh
curl -fsSL https://raw.githubusercontent.com/sisyphuslabs/omo-dori-mode-experimental/main/install.sh | bash
```

저장소를 `~/.dori/src`에 받고, 스킬을 `~/.agents/skills/dori-mode`에 링크하고, `bun link`로 `dori`를 PATH에 올리고, 예시 설정을 `~/.dori/config.json`에 복사합니다. 에이전트가 다른 곳에서 스킬을 읽는다면 `SKILLS_DIR`를 지정하세요.

그다음 herdr 안에서 에이전트를 열고 "Dori mode"라고 말하면 됩니다.

## 필요한 것

- [bun](https://bun.sh) 1.3 이상, git
- [herdr](https://herdr.dev): 레인이 돌아가는 터미널 멀티플렉서
- 스킬을 읽는 코딩 에이전트 ([OmO](https://github.com/code-yeongyu/oh-my-openagent) 기준으로 만들었고, 에이전트 실행 명령은 설정으로 바꿀 수 있습니다)
- PR 머지와 이슈 종료 확인용 `gh`(GitHub CLI), 배포 버전 확인용 `npm`
- 봇 자체를 위한 [agent-messenger](https://github.com/agent-messenger/agent-messenger)

호스트 감시는 macOS에서 전부 동작합니다. 리눅스에서는 부하와 디스크만 보고, 메모리와 스왑은 알 수 없음으로 나옵니다.

## Dori 이름 짓기

Dori는 맨 처음에 자기를 뭐라고 부를지 묻습니다. 그냥 "Dori"도 되고, ShipDori나 WorkDori처럼 끝이 Dori로 끝나는 이름도 됩니다. 여러 개를 함께 돌릴 때 구분하기 좋습니다. 정한 이름은 봇 이름과 메시지 끝 서명, 모드 이름에 그대로 쓰입니다. 다음부터는 "ShipDori mode"라고만 하면 다시 켜집니다.

## 설정

설정 파일은 `~/.dori/config.json` 하나이고, 어느 항목이든 빼도 됩니다. 보통 정해 두는 항목은 아래와 같아요.

| 항목 | 뜻 |
|---|---|
| `leadPane` | Dori 자신의 herdr pane (`herdr pane current`). 레인 보고가 여기로 옵니다. |
| `laneWorkspace` | 새 레인 탭이 열릴 herdr workspace |
| `defaultCwd` | 레인이 시작하는 디렉터리이자, 레인이 worktree를 만드는 저장소 |
| `agentCommand` | 에이전트 실행 명령. `{model}`, `{prompt}`가 들어간 argv 목록 |
| `hooks.threadReply`, `hooks.threadDone` | 메신저 CLI를 `{thread}`, `{text}`가 들어간 argv 목록으로. 레인 진행 상황을 올리고 완료 표시를 할 때 씁니다. |

나머지(시간, 임계값, heavy 슬롯 수)는 기본값으로 충분합니다. 전체 표는 [`references/scripts.md`](skills/dori-mode/references/scripts.md)에 있습니다. `DORI_CONFIG`, `DORI_STATE_DIR`, `DORI_LEAD_PANE` 환경변수를 주면 파일 값 대신 그 값을 씁니다.

## 세션 레지스트리

레인마다 `~/.dori/state/lanes/` 아래에 JSON 파일이 하나씩 생깁니다. 메신저 스레드와 herdr pane, pane과 에이전트 세션 id를 연결하고, 상태(`working`, `done-claimed`, `verified-done`, `not-done`, `closed`)와 그 변화 이력을 남깁니다.

`dori sync`는 이 기록을 실제로 떠 있는 pane과 비교해서 어긋난 곳을 알려 줍니다. 사라진 pane, 바뀐 세션 id, 끝났다는 걸 증명할 방법이 없는 레인 같은 것들입니다. 아무것도 지우지 않습니다. `--write`를 붙이면 찾은 세션 id를 저장합니다.

## 5분 완료 흐름

레인이 끝났다고 알립니다.

```sh
dori claim-done fix-login --evidence "merged acme/app#412 (a1b2c3d)"
```

Dori는 `LANE_DONE_CLAIMED`를 받고, 레인에는 5분 뒤 닫힌다는 메시지가 갑니다. 그 사이에 반대하려면 이렇게 합니다.

```sh
dori object-done fix-login --reason "changelog 항목이 빠졌음"
```

적은 이유가 레인에 그대로 전달되고, 레인은 고친 뒤 다시 완료를 알립니다. 아무도 반대하지 않으면 시간이 지난 뒤 `dori watch`가 레인을 닫습니다. 닫기 전에 `Done =` 신호를 모두 실제로 다시 확인하고, worktree에 원격에 올라가지 않은 커밋이나 커밋하지 않은 변경이 있으면 닫지 않습니다. 이때 완료 요청은 이유와 함께 not-done으로 돌아갑니다. watcher를 다시 켜도 5분 시계는 처음부터 다시 세지 않습니다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `dori launch <key> ...` | brief에 레인 footer를 쓰고, 탭을 열고, 에이전트를 시작하고, 시작 오류를 확인 |
| `dori adopt <key> --pane ID ...` | 이미 돌고 있는 레인을 등록 |
| `dori sync [--write]` | 레지스트리와 실제 pane 비교, 어긋난 곳 표시 |
| `dori claim-done` / `object-done` / `close` | 완료 흐름 |
| `dori watch` | 자동 닫기 watcher. 지속 모니터로 돌립니다 |
| `dori freshness [--loop MIN]` | 조용해진 레인을 깨우고, 마지막 보고를 스레드에 올림 |
| `dori dead-panes [--loop MIN]` | 멈춘 에이전트 pane 보고 |
| `dori guard [--loop MIN]` | 부하, 메모리, 디스크, pane 수 경고 |
| `dori heavy <label> -- <cmd>` | 슬롯이 비고 부하가 낮을 때만 빌드나 테스트 실행 |

pane에 보내는 글은 항상 인자 하나로 넘기고 셸 문자열을 거치지 않습니다. Enter가 실제로 들어갔는지도 확인합니다.

## 테스트

CI는 없습니다. 테스트는 로컬에서 돌립니다.

```sh
cd skills/dori-mode/scripts
bun install
bun test           # 가짜 herdr, git, gh로 동작을 확인하는 테스트
bunx tsc --noEmit  # 타입 검사
```

실제 pane이나 저장소, GitHub는 건드리지 않아요.

## 라이선스

MIT
