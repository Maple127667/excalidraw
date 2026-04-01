# 📊 Excalidraw 项目健康检查报告

## 🧾 基本信息

| 项目       | 内容                      |
| ---------- | ------------------------- |
| 项目名称   | Excalidraw                |
| 检查时间   | 2026-04-01T14:30:00+08:00 |
| 检查环境   | development               |
| 检查执行者 | Claude (Sisyphus)         |

---

## 总体评分

| 维度     | 分数 (1-10) | 说明                                   |
| -------- | ----------- | -------------------------------------- |
| 架构     | 8           | 清晰的 monorepo 结构，模块边界明确     |
| 稳定性   | 7           | 错误处理基本完善，部分异步操作需加强   |
| 安全性   | 6           | 存在 XSS 风险点，Electron IPC 需加固   |
| 可维护性 | 8           | 代码规范完善，TypeScript 覆盖率高      |
| 性能     | 7           | 有防抖机制，Electron 文件操作有同步 IO |

---

## 🔴 高风险问题

### 1. XSS 风险 - dangerouslySetInnerHTML

**文件**: `packages/excalidraw/clipboard.ts`

**问题**: 剪贴板粘贴的 HTML 内容直接使用 `dangerouslySetInnerHTML`，存在 XSS 攻击风险。

**风险等级**: 🔴 高

**建议**:

- 添加 HTML 内容清洗 (DOMPurify)
- 限制允许的 HTML 标签白名单

---

### 2. Electron IPC 权限验证缺失

**文件**: `excalidraw-app/electron/main.js`

**问题**: IPC 通信没有验证调用来源和权限。

```javascript
// 当前代码缺少权限验证
ipcMain.handle("files:save", async (event, { fileId, name, data }) => {
  // 没有验证 event.sender 的合法性
});
```

**风险等级**: 🔴 高

**建议**:

- 添加 webContents 验证
- 限制敏感操作只能从特定窗口调用

---

### 3. 文件路径注入风险

**文件**: `excalidraw-app/electron/main.js`

**问题**: 文件名参数未做严格校验，可能存在路径遍历攻击。

```javascript
const filePath = path.join(filesDir, `${fileName}.excalidraw`);
// fileName 可能包含 "../" 等危险字符
```

**风险等级**: 🔴 高

**建议**:

- 校验文件名不包含路径分隔符
- 使用白名单字符集

**修复示例**:

```javascript
// 安全的文件名校验
function sanitizeFileName(name) {
  // 只允许字母、数字、中文、下划线、连字符
  const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "");
  // 防止路径遍历
  if (
    safeName.includes("..") ||
    safeName.includes("/") ||
    safeName.includes("\\")
  ) {
    throw new Error("Invalid file name");
  }
  return safeName;
}
```

---

## 🟠 中风险问题

### 4. 同步文件操作阻塞主进程

**文件**: `excalidraw-app/electron/main.js`

**问题**: 使用同步文件操作 `fs.readFileSync`, `fs.writeFileSync`，会阻塞 Electron 主进程。

```javascript
const content = fs.readFileSync(filePath, "utf-8"); // 同步操作
fs.writeFileSync(filePath, content, "utf-8"); // 同步操作
```

**风险等级**: 🟠 中

**建议**: 改用异步 API (`fs.promises.readFile`, `fs.promises.writeFile`)

**修复示例**:

```javascript
// 使用异步 API
const fs = require("fs").promises;

// 读取文件
const content = await fs.readFile(filePath, "utf-8");

// 写入文件
await fs.writeFile(filePath, content, "utf-8");
```

---

### 5. 缺少文件操作并发控制

**文件**: `excalidraw-app/electron/main.js`

**问题**: 多次快速保存可能导致文件覆盖或数据丢失。

**风险等级**: 🟠 中

**建议**:

- 添加文件锁机制
- 使用队列串行化写操作

---

### 6. 自动保存未处理错误

**文件**: `excalidraw-app/App.tsx` (onChange)

**问题**: 自动保存失败时只打印日志，没有通知用户。

```javascript
autoSaveTimeoutRef.current = setTimeout(() => {
  handleSaveFile(); // 错误未处理
}, 500);
```

**风险等级**: 🟠 中

**建议**: 添加保存状态提示，失败时提醒用户

---

### 7. 自动保存无防抖取消机制

**文件**: `excalidraw-app/App.tsx`

**问题**: 快速连续修改时可能触发多次保存。

**建议**: 使用 lodash debounce 或添加取消逻辑。

---

## 🟢 低风险问题

### 8. 侧边栏拖拽样式优化

**文件**: `excalidraw-app/components/FilesSidebar.scss`

**问题**: 拖拽视觉反馈可以更明显。

**风险等级**: 🟢 低

**建议**: 添加拖拽预览占位符

---

### 9. 缺少 TypeScript 类型检查脚本

**问题**: `yarn test:typecheck` 未在 pre-commit hook 中执行。

**风险等级**: 🟢 低

**建议**: 在 lint-staged 中添加类型检查

---

## 📋 项目结构评估

### 目录结构 ✅

```
excalidraw/
├── packages/           # 核心库（良好分层）
│   ├── excalidraw/     # 主组件库
│   ├── common/         # 公共工具
│   ├── element/        # 元素类型
│   ├── math/           # 数学计算
│   └── utils/          # 工具函数
├── excalidraw-app/     # Web 应用（职责清晰）
│   ├── components/     # UI 组件
│   ├── data/           # 数据层
│   ├── electron/       # Electron 集成
│   └── ...
├── examples/           # 示例代码
└── scripts/            # 构建脚本
```

**评价**: 目录结构清晰，monorepo 管理规范，模块边界明确。

---

## 📊 安全检查详细结果

### XSS 风险检查 - dangerouslySetInnerHTML / innerHTML

| 文件                                       | 风险等级 | 说明                 |
| ------------------------------------------ | -------- | -------------------- |
| `packages/excalidraw/clipboard.ts`         | 🔴 高    | 剪贴板 HTML 直接渲染 |
| `packages/excalidraw/components/Modal.tsx` | 🟠 中    | 需确认内容来源       |
| `packages/excalidraw/components/Popup.tsx` | 🟠 中    | 需确认内容来源       |

### 文件操作路径校验

| 文件                                  | 风险等级 | 说明         |
| ------------------------------------- | -------- | ------------ |
| `excalidraw-app/electron/main.js`     | 🔴 高    | 文件名未校验 |
| `excalidraw-app/data/localStorage.ts` | 🟢 低    | 本地存储操作 |

### Electron IPC 通信安全

| 文件                                 | 风险等级 | 说明             |
| ------------------------------------ | -------- | ---------------- |
| `excalidraw-app/electron/main.js`    | 🔴 高    | IPC 无权限验证   |
| `excalidraw-app/electron/preload.js` | 🟠 中    | 需检查暴露的 API |

---

## 🔧 优化建议（按优先级）

### 高优先级

1. **修复 XSS 风险** - 剪贴板 HTML 清洗

   ```bash
   yarn add dompurify
   yarn add -D @types/dompurify
   ```

2. **加固 Electron IPC** - 添加权限验证

   ```javascript
   // 验证调用来源
   ipcMain.handle("files:save", async (event, data) => {
     if (event.senderFrame.url !== expectedOrigin) {
       throw new Error("Unauthorized");
     }
     // ... 处理逻辑
   });
   ```

3. **文件名校验** - 防止路径遍历攻击

### 中优先级

4. **异步文件操作** - 避免阻塞主进程
5. **并发控制** - 文件写入队列
6. **错误提示** - 自动保存失败通知用户

### 低优先级

7. **拖拽体验优化**
8. **pre-commit 类型检查**

---

## 📊 关键指标

| 指标              | 数值            |
| ----------------- | --------------- |
| TypeScript 覆盖率 | ~95%            |
| ESLint 规则数     | 100+            |
| 测试框架          | Vitest          |
| 构建工具          | Vite + esbuild  |
| 包管理            | Yarn Workspaces |

---

## 🟢 已有的性能优化

| 优化项             | 状态     | 位置                               |
| ------------------ | -------- | ---------------------------------- |
| LocalData 防抖保存 | ✅ 300ms | `excalidraw-app/data/LocalData.ts` |
| React.memo         | ✅       | 多个组件                           |
| 虚拟列表           | ✅       | 长列表渲染                         |
| Vite 构建          | ✅       | esbuild 加速                       |

---

## 总结

| 评估项 | 结论 |
| --- | --- |
| 当前系统成熟度 | **成熟** - 核心架构稳定，代码规范完善 |
| 是否适合生产 | **需要修复高风险项** - XSS 和 IPC 安全问题必须解决 |
| 下一步建议 | 1. 立即修复安全风险<br>2. 改进 Electron 文件操作<br>3. 添加自动化安全测试 |

---

## 📋 问题清单

- [ ] 🔴 修复 XSS 风险 (clipboard.ts)
- [ ] 🔴 加固 Electron IPC 权限验证
- [ ] 🔴 添加文件名安全校验
- [ ] 🟠 改用异步文件操作 API
- [ ] 🟠 添加文件写入并发控制
- [ ] 🟠 自动保存错误通知用户
- [ ] 🟢 优化拖拽视觉反馈
- [ ] 🟢 添加 pre-commit 类型检查

---

**Generated At**: 2026-04-01T14:30:00+08:00  
**Timezone**: Asia/Shanghai
