# iOS 调试指南

## Safari Web Inspector 调试步骤

### 1. 启用 Safari 开发者菜单
- Safari → 设置 → 高级 → ✅ 在菜单栏中显示"开发"菜单

### 2. 启动应用
```bash
pnpm tauri ios dev
```

### 3. 连接 Web Inspector
1. 打开 Safari
2. 菜单栏：**开发** → **Simulator - iPhone XX**
3. 选择：**Lovmind** (或你的应用名称)

### 4. 可用功能
- **Elements**: 查看和修改 DOM 结构
- **Console**: 查看日志、执行 JavaScript
- **Network**: 监控网络请求
- **Sources**: 调试 JavaScript 代码
- **Storage**: 查看 LocalStorage、SessionStorage

## 常用调试技巧

### 查看当前平台检测
在 Console 中运行：
```javascript
// 检查是否识别为 iOS
console.log('isIOS:', /iPad|iPhone|iPod/.test(navigator.userAgent));
console.log('User Agent:', navigator.userAgent);
console.log('Max Touch Points:', navigator.maxTouchPoints);

// 检查 visualViewport
console.log('visualViewport:', {
  height: window.visualViewport?.height,
  width: window.visualViewport?.width,
  offsetTop: window.visualViewport?.offsetTop,
  offsetLeft: window.visualViewport?.offsetLeft,
});

// 检查 window 尺寸
console.log('window:', {
  innerHeight: window.innerHeight,
  innerWidth: window.innerWidth,
  outerHeight: window.outerHeight,
  outerWidth: window.outerWidth,
});
```

### 查看 EditorToolbar 的 padding
在 Console 中运行：
```javascript
const toolbar = document.querySelector('.border-t.border-border\\/40');
if (toolbar) {
  const styles = window.getComputedStyle(toolbar);
  console.log('Toolbar padding:', {
    paddingTop: styles.paddingTop,
    paddingBottom: styles.paddingBottom,
    paddingLeft: styles.paddingLeft,
    paddingRight: styles.paddingRight,
  });
}
```

### 实时监听 visualViewport 变化
```javascript
window.visualViewport?.addEventListener('resize', () => {
  console.log('[visualViewport resize]', {
    height: window.visualViewport.height,
    offsetTop: window.visualViewport.offsetTop,
    keyboardHeight: window.innerHeight - window.visualViewport.height,
  });
});
```

## 真机调试（iPhone/iPad）

### 1. 启用 iPhone Web Inspector
在设备上：
- **设置** → **Safari** → **高级** → ✅ **Web 检查器**

### 2. 连接到 Mac
1. 用 USB 数据线连接设备到 Mac
2. 在设备上信任此电脑
3. 部署应用到真机：
   ```bash
   pnpm tauri ios dev --device
   ```

### 3. 打开 Safari Web Inspector
- Safari → 开发 → **你的 iPhone 名称** → Lovmind

## Xcode Console 查看日志

### 打开 Xcode Console
```bash
# 1. 打开 Xcode
open /Applications/Xcode.app

# 2. 菜单栏：Window → Devices and Simulators
# 3. 选择你的模拟器
# 4. 点击 "Open Console" 按钮
```

### 筛选应用日志
在 Console 搜索框输入：
```
process:Lovmind
```

## 常见问题排查

### 问题：Safari 开发菜单中看不到模拟器
**解决方案**：
1. 确保模拟器正在运行
2. 重启 Safari
3. 检查 Safari 开发菜单是否已启用

### 问题：Web Inspector 显示空白
**解决方案**：
1. 确保应用已完全加载
2. 刷新应用（在模拟器中摇晃设备 → Reload）
3. 重新选择 Web Inspector 连接

### 问题：看不到 Console 日志
**解决方案**：
1. 检查 Console 的日志级别过滤器
2. 确保没有被 "Preserve log" 限制
3. 清空 Console 后重新操作

## 性能分析

### Timeline / Performance
1. 打开 Web Inspector
2. 切换到 **Timelines** 标签
3. 点击 **Record** 开始录制
4. 执行你要分析的操作（如打开编辑器）
5. 停止录制，查看性能瓶颈

### Memory Leaks
1. Timelines → **JavaScript Allocations**
2. 录制一段时间
3. 查看内存增长趋势

## 远程调试（Weinre - 备选方案）

如果 Safari Web Inspector 不可用，可以使用 Weinre：

```bash
# 安装
npm install -g weinre

# 启动服务器
weinre --boundHost -all- --httpPort 8080

# 在你的 HTML 中添加脚本
<script src="http://YOUR_IP:8080/target/target-script-min.js"></script>

# 访问调试界面
open http://localhost:8080/client/
```

## 快捷键

### Safari Web Inspector
- `⌘ + ⌥ + I` - 打开 Inspector
- `⌘ + K` - 清空 Console
- `⌘ + F` - 在 Elements 中搜索
- `⌘ + ⌥ + C` - 打开 Element Picker

### 模拟器
- `⌘ + K` - 切换软键盘
- `⌘ + ⇧ + H` - 回到主屏幕
- `⌘ + S` - 截图
