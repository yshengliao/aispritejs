# aispritejs

[![npm version](https://img.shields.io/npm/v/aispritejs.svg)](https://www.npmjs.com/package/aispritejs)
[![CI](https://github.com/yshengliao/aispritejs/actions/workflows/ci.yml/badge.svg)](https://github.com/yshengliao/aispritejs/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)
[![AI Generated](https://img.shields.io/badge/AI_Generated-yes-blueviolet.svg)](https://www.anthropic.com/claude-code)
[![English](https://img.shields.io/badge/lang-English-blue.svg)](README.md)

> 以輸入驅動、與渲染器無關的 2D sprite 動畫 runtime —— 一個輕巧、類 Rive 的*視覺*狀態機，由 `Number` / `Boolean` / `Trigger` 輸入驅動。

`aispritejs` 依據一小組執行期**輸入**（例如 `speed`、`isGrounded`、`jump`），透過 JSON 定義的轉移圖，決定**畫面上要顯示哪一格動畫影格**。你的程式設定輸入，`aispritejs` 挑選視覺狀態並推進當前影格。核心是純 TypeScript，**零相依**且**不 import 任何渲染器** —— 透過薄薄一層轉接器即可接上 PixiJS v8（或任何東西）。

屬於 **ai\*js** 家族：零跨套件相依、核心與框架無關、AI 可讀的文件。

## 為什麼用 aispritejs

- **輸入驅動，而非名稱驅動。** 你設定參數（`speed=4`、`isGrounded=false`、`fireTrigger("jump")`），而不是動畫名稱。視覺轉移存在於資料中，與遊戲程式解耦。
- **核心與渲染器無關。** 狀態機從 delta-time 加上輸入算出當前影格；它從不 import PixiJS 也不碰 DOM。轉接器負責把結果對映成 texture。
- **視覺 ≠ 邏輯。** 這嚴格來說是一個*視覺*動畫器，**不是**遊戲邏輯 FSM，也**不**相依 `aifsmjs`。用任何邏輯層（純程式、FSM、ECS）來驅動它 —— 它們以慣例組合，從不以相依耦合。
- **輕巧又快。** O(1) 的輸入查找、對離開當前狀態的轉移做 O(N) 檢查、無每幀配置。

## 心智模型

```
inputs ─▶ [轉移圖] ─▶ 當前狀態 ─▶ (Δt) ─▶ 當前影格 ─▶ 轉接器 ─▶ texture
```

- **Inputs（輸入）** —— `Number`（連續，如 `speed`）、`Boolean`（開關，如 `isGrounded`）、`Trigger`（一次性；被某個轉移消耗後自動重置，如 `jump` / `attack`）。
- **States（狀態）** —— 一個動畫鍵（指向 atlas 的 `animations`）加上 loop / on-end 行為與選用的速度倍率。
- **Transitions（轉移）** —— 當輸入條件成立時（`Equals` / `NotEquals` / `GreaterThan` / `LessThan`），從某狀態（或 **Any State**）轉到另一狀態。優先度最高且成立者勝出。
- **`update(dt)`** —— 推進播放計時器；評估轉移（切換狀態、觸發 `onStateChange`、消耗 trigger）；由動畫的逐影格時長加 loop 算出當前影格；非循環片段播完時觸發 `onComplete`。

## 快速開始 —— 核心（零相依）

```ts
import { createSpriteAnimator } from "aispritejs";

const anim = createSpriteAnimator(graph); // graph = { inputs, states, transitions, animations }

anim.setInput("speed", 4);
anim.setInput("isGrounded", true);
anim.fireTrigger("jump");

anim.onStateChange((to, from) => {/* ... */});
anim.onComplete((state) => {/* ... */});

// 在你的 render loop 裡：
anim.update(deltaMs);
const frameKey = anim.activeFrameKey; // 交給你的渲染器
```

## 快速開始 —— PixiJS v8 轉接器

`aispritejs/pixi` 子路徑把核心綁到一個 `PIXI.Sprite`。`pixi.js` 是**選用的** `peerDependency`，且僅以 **type-only** 方式 import —— 編譯後的轉接器不含任何 `pixi.js` runtime require，核心也永不碰它。

```ts
import { createPixiSpriteAnimator } from "aispritejs/pixi"; // pixi.js 是選用 peer

// `textures` 是 PIXI.Spritesheet（或 frame-key → Texture 的 map），需涵蓋 graph
// 參照的每一格 —— 缺鍵會丟出 MissingTextureError。
const view = createPixiSpriteAnimator(sprite, graph, spritesheet);

// 每幀：
view.update(deltaMs); // 把綁定 sprite 的 texture 換成當前影格，
                      // 並套用該格的 atlas anchor（texture.defaultAnchor）

view.setInput("speed", 4);
view.fireTrigger("jump");
```

它只在當前影格改變時換 texture，並尊重逐影格 `duration`（透過核心）與非置中／腳底樞軸（透過 `texture.defaultAnchor`；傳 `{ applyAnchor: false }` 可自行管理 anchor）。`view.sprite` 是綁定的 sprite；`dispose()` 拆除核心但不銷毀 sprite。

## 資料格式（atlas）

`aispritejs` 讀取 **PixiJS v8 原生**的 spritesheet atlas（`meta` / `frames` / `animations`），並額外加上一個 `aispritejs` 的**輸入驅動**控制區塊：

```jsonc
{
  "meta":   { "image": "sheet.png", "size": { "w": 1024, "h": 1024 }, "scale": "1" },
  "frames": { /* PixiJS 原生：frame{x,y,w,h}、anchor、duration、trimmed... */ },
  "animations": { "idle": ["idle_0", "idle_1"], "walk": ["walk_0", "..."], "jump": ["jump_0", "..."] },

  "inputs": {
    "speed":      { "type": "number",  "default": 0 },
    "isGrounded": { "type": "boolean", "default": true },
    "jump":       { "type": "trigger" }
  },
  "states": {
    "idle": { "animation": "idle", "loop": true },
    "walk": { "animation": "walk", "loop": true },
    "jump": { "animation": "jump", "loop": false }
  },
  "transitions": [
    { "from": "*",    "to": "jump", "when": [{ "input": "jump",  "op": "Trigger" }], "priority": 10 },
    { "from": "idle", "to": "walk", "when": [{ "input": "speed", "op": "GreaterThan", "value": 0 }] },
    { "from": "walk", "to": "idle", "when": [{ "input": "speed", "op": "Equals",      "value": 0 }] }
  ]
}
```

這個**輸入驅動**模型刻意與事件驅動 FSM 區隔。`aispritejs` 只吃通用的 `frames` / `animations`；`inputs` / `states` / `transitions` 屬於它自己。若某個 atlas 帶有來自其他工具的事件驅動 `states` 區塊，`aispritejs` 會忽略它。

## 核心 API

公開介面是單一工廠函式，加上型別與具名錯誤。**不匯出任何 class 建構子** —— `createSpriteAnimator` 回傳一個 `SpriteAnimator`。

```ts
const anim = createSpriteAnimator(graph); // graph 不合法時丟出 InvalidGraphError

anim.setInput(name, value);   // Number | Boolean；丟出 Unknown/InputTypeError
anim.fireTrigger(name);       // 將某個 Trigger 標記為 pending
anim.update(deltaMs);         // 推進；評估轉移；推進影格
anim.reset();                 // 回到初始狀態與預設輸入（保留 buffer）
anim.dispose();               // 冪等；之後呼叫 mutator 會丟錯

const off = anim.onStateChange((to, from) => {}, { signal?, once? }); // → 取消訂閱
const off2 = anim.onComplete((state) => {}, { signal?, once? });

anim.activeState;       // 當前狀態名稱
anim.activeFrameKey;    // 指向 atlas `frames` 的影格鍵 —— 交給渲染器
anim.activeFrameIndex;  // 在當前動畫中的索引
anim.disposed;          // boolean
```

每個訂閱都回傳一個取消訂閱函式，並接受 `{ signal }`（用 `AbortSignal` 移除監聽）與 `{ once }`。

## 語意（精確規則）

這些規則是決定性的，並在 1.0 推出後對 1.x 凍結：

- **`update(dt)` 順序** —— 以 `dt × speed` 推進計時器（負的 `dt` 夾到 `0`）；評估轉移；重算當前影格；為播完的非循環片段觸發 `onComplete`，接著執行任何 `onEnd` 自動轉移。因此同一幀內，明確的輸入轉移優先於片段結束行為。
- **轉移解析** —— 在離開當前狀態的轉移（加上 **Any-State** `from: "*"`）中，候選依 `priority`（遞減）再依宣告順序（遞增）排序；取**第一個有效**者。所有 `when` 條件須全部成立（邏輯 AND）。
- **自我轉移規則** —— `to` 等於當前狀態的轉移，*只有在它消耗一個 Trigger 時才有效*。純 Number/Boolean 的自我迴圈會被跳過，因此不會每幀把片段重置回第 0 格。帶 trigger 的自我轉移會**重啟**片段（例如連續攻擊），但**不**觸發 `onStateChange`（狀態名稱沒變）。
- **Triggers** —— `fireTrigger(name)` 把某 trigger 標記為 pending；它跨幀保持 pending，直到某個檢查它的轉移被採用而**消耗**它。一次 fire → 至多一次轉移。
- **影格時序** —— 當前影格是累積時長首次超過已經過時間的那一格。循環片段在總時長處回繞；非循環片段停在最後一格並只觸發一次 `onComplete`。逐影格 `duration` 取自 atlas `frames`；沒有的影格採用 `defaultFrameDuration`（預設 `100` ms）。`speed` 是時間倍率（`2` = 兩倍速）。
- **決定性** —— 相同的輸入加 `dt` 序列必產生相同的影格序列。無轉移的路徑不做任何配置。

## 錯誤

具名錯誤，從不裸 throw：

- `InvalidGraphError` —— `createSpriteAnimator` 在 graph 驗證失敗時丟出（缺少動畫、未知的轉移目標、運算子/型別不符、非正的時長/速度、`onEnd` 配 `loop:true`…）。Fail-fast：不合法的 graph 絕不產出半成品動畫器。
- `UnknownInputError` —— 對 `inputs` 未宣告的輸入呼叫 `setInput` / `fireTrigger`（帶有 `.input`）。
- `InputTypeError` —— 值型別錯誤、對 Trigger 呼叫 `setInput`、或對非 Trigger 呼叫 `fireTrigger`（帶有 `.input`）。
- `SpriteAnimatorDisposedError` —— `dispose()` 之後呼叫任何 mutator（`setInput` / `fireTrigger` / `update` / `reset`）。

## 解耦（P0）

- **零跨套件 import** —— `aispritejs` 不 import `aifsmjs`、`aieventjs` 或任何手足套件。它有自己最小的具名 emitter。
- **核心與渲染器無關** —— 根進入點永不 import `pixi.js`。只有 `aispritejs/pixi` 會，而 `pixi.js` 是**選用的** `peerDependency`。
- **僅是視覺動畫器** —— 用設定輸入的方式搭配遊戲邏輯層；它不假設你的邏輯如何組織。

## 比較

| | aispritejs | Rive | aifsmjs | 原生 `AnimatedSprite` |
|---|---|---|---|---|
| 控制模型 | 輸入驅動（Number/Boolean/Trigger） | 輸入驅動 | 事件驅動（邏輯） | 手動 |
| 範圍 | 視覺動畫 | 視覺動畫 | 遊戲邏輯 | 僅播放 |
| Runtime | 輕巧 TS，無 wasm | wasm runtime | 輕巧 TS | — |
| 渲染器 | 無關 + 轉接器 | 自帶 | n/a | PixiJS |

`aispritejs` 與 `aifsmjs` 互補 —— 邏輯 FSM 設定輸入、視覺動畫器挑影格 —— 且永不耦合。

## 給 AI agent 的閱讀指南

- **一次抓完整 context** —— [`llms-full.txt`](llms-full.txt) 串接了本 README、changelog、contributing 指南與範例索引。
- **原始碼版面** —— 核心位於 [`src/sprite/`](src/sprite/)：`types.ts`（所有公開型別集中一檔）、`machine.ts`（`createSpriteAnimator` 引擎）、`compile.ts`（graph 驗證與正規化）、`inputs.ts`（輸入儲存）、`emitter.ts`（自有具名 signal）、`errors.ts`。根 [`src/index.ts`](src/index.ts) 再匯出公開介面，且**不** import 任何渲染器。
- **穩定度分級** —— 見 [STABILITY.md](STABILITY.md)。

## 測試

`vitest` 行為測試涵蓋輸入、轉移、trigger 消耗、影格時序、`onComplete` / `onEnd`、訂閱（`signal` / `once`）、`dispose` / `reset` 與 graph 驗證。`fast-check` 屬性測試驗證**轉移決定性**（相同輸入加 `dt` 序列 ⇒ 相同影格軌跡）與 **trigger 消耗**（一次 fire ⇒ 一次進入）。覆蓋率以家族下限執行（≥95% statements / ≥90% branches / 100% functions 與 lines）。

```bash
pnpm test        # 跑一次
pnpm coverage    # 帶門檻
pnpm example:platformer
```

## 狀態

- **v0.1.0 —— 與渲染器無關的核心**（已發佈）：輸入、轉移圖與 `createSpriteAnimator` 引擎。零執行期相依；根 import 圖不含 `pixi.js`。
- **未發佈 —— `aispritejs/pixi` 轉接器**（模組 4）：`createPixiSpriteAnimator` 把核心綁到 PixiJS v8 `Sprite`，尊重逐影格 `duration` 與 atlas `anchor`。`pixi.js` 是選用、type-only 的 peer。

atlas parser + JSON Schema（模組 3）是下一階段。版本號與發佈 tag 由維護者切。

## Roadmap

見 [ROADMAP.md](ROADMAP.md)。

## License

MIT © yshengliao —— 見 [LICENSE](LICENSE)。
