import { useEffect } from 'react'
import { useEditorStore } from '../stores/editorStore'

export function useUITheme(): void {
  const uiTheme = useEditorStore((s) => s.uiTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = uiTheme
  }, [uiTheme])
}
