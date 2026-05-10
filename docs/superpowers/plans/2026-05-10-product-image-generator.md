# 产品图片生成器实施计划

> **给 agentic workers：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 构建一个基于 Vite、React、TypeScript 和 Ant Design 的三列产品图片生成工作台。

**架构：** 页面状态和工作台 UI 放在 `src/App.tsx`，Doubao Seedream 4.0 请求封装放在 `src/lib/doubao.ts`，确定性模拟生成逻辑放在 `src/lib/generator.ts` 作为兜底，Vite 开发服务器在 `vite.config.ts` 中提供本地代理。

**技术栈：** Vite、React、TypeScript、Ant Design、Vitest、React Testing Library、CSS 变量。

---

## 文件结构

- `package.json`：脚本与依赖声明。
- `index.html`：Vite 页面入口。
- `src/main.tsx`：React 挂载入口。
- `src/App.tsx`：三列工作台、Ant Design 组件组合和页面状态管理。
- `src/App.css`：整体布局、工业风视觉系统和 Ant Design 组件主题覆盖。
- `src/lib/generator.ts`：点数成本计算和确定性模拟图片生成。
- `src/lib/doubao.ts`：Doubao Seedream 4.0 请求体、提示词和批量生成封装。
- `src/lib/generator.test.ts`：生成逻辑单元测试。
- `src/lib/doubao.test.ts`：Doubao 请求构造和响应解析测试。
- `src/App.test.tsx`：工作台关键行为测试。
- `src/test/setup.ts`：测试环境配置。
- `vite.config.ts`：Vite 与 Vitest 配置。
- `tsconfig.json`、`tsconfig.node.json`：TypeScript 配置。

## 任务

### 任务 1：项目脚手架和测试

- [x] 创建 Vite React TypeScript 项目配置。
- [x] 编写生成逻辑和工作台行为测试。
- [x] 运行测试，确认缺失实现会导致测试失败。

### 任务 2：生成逻辑

- [x] 实现 `calculateGenerationCost(count)`，规则为每组生成 2 张图，所以返回 `count * 2`。
- [x] 实现 `createGenerationBatch`，返回成对的风格图和产品贴膜图结果。
- [x] 运行单元测试并确认通过。

### 任务 3：工作台 UI

- [x] 实现三列工作台。
- [x] 添加上传预览、提示词、图片规格、生成数量、点数余额、预计消耗、禁用状态、加载状态、结果卡片和点数扣减。
- [x] 使用 Ant Design 组件替换基础表单、按钮、卡片、统计、标签、空状态和加载组件。
- [x] 接入 Doubao Seedream 4.0，本地代理读取 `ARK_API_KEY` 后请求火山 Ark。
- [x] 无密钥或接口失败时回退到本地模拟生成，并在界面提示。
- [x] 运行组件测试并确认通过。

### 任务 4：样式和验证

- [x] 实现桌面三列布局和移动端堆叠布局。
- [x] 使用 CSS 变量统一工业产品影像工作室视觉方向。
- [x] 覆盖 Ant Design 组件样式，使其融入深色工作台视觉。
- [x] 运行 `npm test -- --run`。
- [x] 运行 `npm run build`。
- [x] 启动开发服务器并进行浏览器验证。
