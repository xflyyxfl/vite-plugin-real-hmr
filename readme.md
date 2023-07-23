## vite-plugin-jsApp
1. detect really change and emit HMR.such as comment in js and css won't update/检测真正的文件修改来进行热更新，排除了在js文件里面调整格式 添加注释这种跟代码无关的改变
2. support for `export default {name,template ,setup}` vue Object /支持以js对象导出形式的vue组件 的编译热更新，runtime要带dom compile功能


## vite.config.js 的示例

```
import jsApp from 'vite-plugin-real-hmr';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    jsApp()
  ],
})
```
