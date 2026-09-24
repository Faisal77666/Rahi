import { Check, Clock3, FileImage, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNotificationSound } from '../../notifications/NotificationSoundProvider'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function SecureImage({ path, token, alt }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    let objectUrl
    fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (!response.ok) throw new Error(); return response.blob() })
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) })
      .catch(() => setError(true))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path, token])
  if (error) return <div className="grid h-64 place-items-center rounded-xl bg-rose-50 text-sm text-rose-700">Image unavailable</div>
  return url ? <img src={url} alt={alt} className="h-64 w-full rounded-xl object-cover" /> : <div className="grid h-64 place-items-center rounded-xl bg-slate-100 text-sm text-slate-500">Loading image…</div>
}

function ReviewModal({ verification, token, onClose, onReview, saving }) {
  const driver = verification.driverId || {}
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4 sm:grid sm:place-items-center"><section className="mx-auto my-4 w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl sm:my-0 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Verification review</p><h2 className="mt-1 text-xl font-bold text-slate-900">{driver.name}</h2><p className="mt-1 text-sm text-slate-500">{driver.phone} · {driver.cnic}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500"><X size={20} /></button></div><div className="mt-6 grid gap-5 md:grid-cols-2"><div><h3 className="mb-3 font-semibold text-slate-800">License picture</h3><SecureImage path={`/admin/verifications/${verification._id}/license`} token={token} alt="Driver license" /></div><div><h3 className="mb-3 font-semibold text-slate-800">Live photo</h3><SecureImage path={`/admin/verifications/${verification._id}/live-photo`} token={token} alt="Driver live selfie" /></div></div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => onReview('rejected')} disabled={saving} className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700">Reject</button><button type="button" onClick={() => onReview('verified')} disabled={saving} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}>{saving ? 'Saving…' : 'Approve verification'}</button></div></section></div>
}

export default function AdminDashboard({ session, api }) {
  const { play } = useNotificationSound()
  const [verifications, setVerifications] = useState([])
  const [selected, setSelected] = useState(null)
  const [notice, setNoticeText] = useState('')
  const setNotice = (message) => {
    setNoticeText(message)
    if (!message) return
    play(/(reject|error|unable|fail)/i.test(message) ? 'request_rejected' : 'request_accepted')
  }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const load = async () => { setLoading(true); try { const result = await api('/admin/verifications?status=pending', { token: session.token }); setVerifications(result.verifications) } catch (error) { setNotice(error.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const review = async (status) => { setSaving(true); try { const result = await api(`/admin/verifications/${selected._id}`, { token: session.token, method: 'PATCH', body: JSON.stringify({ status }) }); setNotice(result.message); setSelected(null); load() } catch (error) { setNotice(error.message) } finally { setSaving(false) } }
  const logout = () => { localStorage.removeItem('drivoSession'); window.location.reload() }
  return <main className="min-h-[100dvh] bg-slate-50 p-4 sm:p-8"><header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600 font-black text-white">R</span><div><p className="text-sm font-semibold text-teal-700">Rahi administration</p><h1 className="text-2xl font-bold text-slate-900">Driver verification review</h1></div></div><button onClick={logout} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Log out</button></header><section className="mx-auto mt-8 max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Pending submissions</h2><p className="mt-1 text-sm text-slate-500">Review driver license and live photo before approval.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800"><Clock3 size={16} />{verifications.length} pending</span></div>{notice && <p className="mt-5 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">{notice}</p>}{loading ? <p className="py-12 text-center text-sm text-slate-500">Loading submissions…</p> : verifications.length === 0 ? <div className="grid min-h-56 place-items-center text-center"><div><ShieldCheck className="mx-auto text-emerald-600" size={32} /><p className="mt-3 font-semibold text-slate-700">No pending verifications</p></div></div> : <div className="mt-5 divide-y divide-slate-100">{verifications.map((verification) => <article key={verification._id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold text-slate-800">{verification.driverId?.name}</p><p className="mt-1 text-sm text-slate-500">{verification.driverId?.phone} · {verification.driverId?.vehicleType || 'Vehicle not set'}</p></div><button onClick={() => setSelected(verification)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: '#f0fdfa', color: '#0f766e' }}><FileImage size={17} />Review documents</button></article>)}</div>}</section>{selected && <ReviewModal verification={selected} token={session.token} onClose={() => setSelected(null)} onReview={review} saving={saving} />}</main>
}
