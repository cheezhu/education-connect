import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App.jsx'
import 'antd/dist/reset.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/noto-sans-sc/chinese-simplified-400.css'
import '@fontsource/noto-sans-sc/chinese-simplified-500.css'
import '@fontsource/noto-sans-sc/chinese-simplified-700.css'

const APP_FONT_FAMILY = "'Inter', 'Noto Sans SC', 'SF Pro Text', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif"

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          fontFamily: APP_FONT_FAMILY,
          fontSize: 14,
          lineHeight: 1.6
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
