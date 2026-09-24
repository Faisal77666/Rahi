import { useEffect, useState } from 'react'

export default function ProtectedRoute({ session, api, onSessionVerified, children }) {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    api('/users/me', { token: session.token })
      .then(({ user }) => {
        if (active) onSessionVerified(user)
      })
      .catch(() => {
        // API 401 responses dispatch the global unauthorized event in api().
      })
      .finally(() => {
        if (active) setChecking(false)
      })

    return () => { active = false }
  }, [session.token])

  if (checking) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-medium text-slate-500">Checking your session…</main>
  }

  return children
}
