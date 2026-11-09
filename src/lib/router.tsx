import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'

export type RoutePath = '/' | '/markets' | '/deposit' | '/borrow' | '/swap' | '/bridge' | '/history' | '/docs'

const KNOWN: RoutePath[] = ['/', '/markets', '/deposit', '/borrow', '/swap', '/bridge', '/history', '/docs']

function current(): RoutePath {
  const p = window.location.pathname.replace(/\/+$/, '') || '/'
  return (KNOWN as string[]).includes(p) ? (p as RoutePath) : '/'
}

export function useRoute(): RoutePath {
  const [route, setRoute] = useState<RoutePath>(current)
  useEffect(() => {
    const onPop = () => setRoute(current())
    window.addEventListener('popstate', onPop)
    window.addEventListener('app:navigate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('app:navigate', onPop)
    }
  }, [])
  return route
}

export function navigate(to: RoutePath) {
  if (window.location.pathname !== to) {
    window.history.pushState({}, '', to)
    window.dispatchEvent(new Event('app:navigate'))
    window.scrollTo({ top: 0 })
  }
}

export function Link({ to, onClick, ...rest }: { to: RoutePath } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handle} {...rest} />
}
