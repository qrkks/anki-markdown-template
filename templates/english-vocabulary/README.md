# 英语词汇模板

这是一套使用通用 Markdown 渲染核心的英语词汇卡片模板。

## 所需字段

请在 Anki 的笔记类型中创建以下字段，字段名需要完全一致：

1. 单词
2. 音标
3. 发音
4. 词性 1
5. 释义 1
6. 词性 2
7. 释义 2
8. 例句
9. 例句翻译
10. 词组短语
11. 拓展

`FrontSide` 是 Anki 的内置变量，不需要创建。

## 字体

模板不需要安装或复制额外字体。中文内容依次使用微软雅黑、苹方、Noto Sans CJK SC、思源黑体和系统无衬线字体；英文内容优先使用 Times New Roman。不同系统上的字形可能略有差异，但不影响内容和布局。

## 样式结构与维护

`styling.css` 是按卡片结构组织的语义化组件 CSS，不是原子化 CSS。样式表大致按以下顺序排列：

1. `:root` 中的字体、尺寸、宽度和颜色变量。
2. `.card`、`.front-content`、`.back-content` 等整体布局。
3. `.Word`、`.PhoneticSymbol`、`.Paraphrase`、`.audio-row` 等内容组件。
4. `.md`、`.En`、`.Zh` 内的 Markdown 排版。
5. `.sense-one`、`.spelling-content`、`.dictation-content` 等局部变体。
6. 夜间模式和窄屏适配。

常用类名的职责如下：

| 类名 | 职责 |
| --- | --- |
| `.R`、`.S`、`.D` | RECITE、SPELLING、DICTATION 顶部标签颜色 |
| `.POSR`、`.POSS`、`.POSD` | 三类卡片的词性标签和音频线颜色 |
| `.sense-one`、`.sense-two` | 第一、第二释义的布局差异 |
| `.En`、`.Zh` | 英文例句和中文翻译区域 |
| `.md` | 需要通用 Markdown 排版的区域 |
| `.spelling-content`、`.dictation-content` | 只作用于某类卡片的样式覆盖 |

维护时遵循以下规则：

- 公共外观优先修改组件类；只有某一种卡片不同，才使用卡片变体类覆盖。
- 修改共享类后同时检查 RECITE、SPELLING 和 DICTATION，避免只修复一张卡片。
- CSS 注释说明规则存在的原因、Anki 兼容限制或需要同步的范围，不重复解释显而易见的属性。
- 保持选择器依赖语义类名，避免使用容易随 HTML 调整而失效的多层标签选择器。
- 只修改本目录中的源模板和 `styling.css`，不要直接编辑 `dist/`。
- 完成修改后运行 `pnpm run check`，再把生成文件安装到 Anki，并检查日间和夜间模式。

## 安装

### APKG（推荐）

从项目的 [GitHub Releases](https://github.com/qrkks/anki-markdown-template/releases)
下载 `anki-english-vocabulary.apkg`，在 Anki 中选择 **文件 → 导入**。安装包会创建
`单词` 笔记类型、三套卡片模板、离线资源和一条可删除的示例笔记。
已使用本仓库开发安装器管理同一模型 ID 的用户不需要重复导入，可直接使用下文的开发更新命令。

### 手动安装

先在项目根目录运行：

```powershell
pnpm run build
```

然后打开 Anki 的 **工具 → 管理笔记类型 → 卡片...**，复制以下生成文件：

生成目录中的 `recite/`、`spelling/` 和 `dictation/` 分别对应三套卡片模板。每个目录中的 `front.html` 和 `back.html` 分别复制到对应的正面、背面模板；将 `dist/english-vocabulary/styling.css` 复制到共享样式。

不要直接修改 `dist/` 中的文件。需要调整卡片时，请修改本目录中的源文件并重新构建。

模板包含 Anki 夜间模式样式。首次安装或修改样式后，建议分别检查日间模式和夜间模式。

## 开发更新到 Anki

安装并启用 AnkiConnect 后，保持 Anki 桌面版运行，然后在项目根目录执行：

```powershell
pnpm run install:anki
```

该命令绑定到模型 ID 匹配的 `单词` 笔记类型及其三套卡片模板：
`RECITE`、`SPELLING` 和 `DICTATION`。首次安装请导入 APKG；更新器不会创建一个无法与公开版本对齐的随机模型 ID。

- 笔记类型存在时，更新三套模板的正反面和共享 CSS。
- 笔记类型缺失或同名模型 ID 不匹配时，停止并给出安全提示。
- 不修改笔记字段内容、卡片、牌组或学习进度。
- 更新前把原模板和 CSS 备份到 `.anki-backups/`。

可以先执行 `pnpm run install:anki:dry-run` 检查，不写入 Anki。旧字段名 `词性1`、`释义1`、`词性2`、`释义2` 需要先在 Anki 的“字段…”窗口中重命名为带空格的名称；安装器检测到旧名称时会停止，不会自动修改字段结构。
