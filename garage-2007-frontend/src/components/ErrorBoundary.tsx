import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  /** Текст для fallback UI (опционально, дефолт — общее сообщение) */
  fallback?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary — перехватывает React-ошибки в дочерних компонентах.
 * Показывает fallback UI вместо белого экрана.
 *
 * Использование:
 * <ErrorBoundary fallback="Игровой движок недоступен">
 *   <PhaserGame ... />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Перехвачена ошибка:', error, info.componentStack)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6 bg-gray-900">
          <p className="text-red-400 text-xs font-mono text-center">
            {this.props.fallback ?? 'Что-то пошло не так'}
          </p>
          {import.meta.env.DEV && this.state.error && (
            <p className="text-gray-500 text-game-xs font-mono text-center break-all max-w-xs">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReload}
            className="bg-garage-rust hover:bg-garage-rust/80 text-white text-xs font-mono py-2 px-4 rounded transition-colors"
          >
            Перезагрузить
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
