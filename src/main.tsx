import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// React.StrictMode を削除し、PixiJS のコンテキストが
// 1回だけ生成されるように制御します。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
