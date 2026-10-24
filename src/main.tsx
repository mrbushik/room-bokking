import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './app/App'
import { queryClient } from './app/queryClient'
import { bootstrap } from './app/bootstrap'
import './styles.css'

const root = document.getElementById('root')

if (!root) throw new Error('Не найден корневой элемент приложения.')

const appRoot = createRoot(root)

async function launch() {
  appRoot.render(<main className="mx-auto max-w-xl p-8"><p role="status">Подготавливаем расписание…</p></main>)
  try {
    await bootstrap()
    appRoot.render(<StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>)
  } catch (error) {
    appRoot.render(<main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Не удалось запустить приложение</h1><p role="alert" className="my-4">{error instanceof Error ? error.message : 'Не удалось подключить API.'}</p><button className="rounded-lg bg-stone-900 px-4 py-3 text-white" onClick={() => { void launch() }}>Повторить запуск</button></main>)
  }
}

void launch()
