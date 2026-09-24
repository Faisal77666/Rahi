import { Camera, CheckCircle2, Clock3, FileImage, RefreshCcw, ShieldCheck, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

function CameraCapture({ photo, onPhoto }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState('')
  const stopCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraOpen(false) }
  useEffect(() => () => stopCamera(), [])
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current
  }, [cameraOpen])
  const startCamera = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      setError('Camera access was blocked. Allow camera access and try again.')
    }
  }
  const capture = () => {
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    onPhoto(canvas.toDataURL('image/jpeg', 0.82))
    stopCamera()
  }
  if (photo) return <div><img src={photo} alt="Captured live selfie" className="h-52 w-full rounded-xl object-cover" /><button type="button" onClick={() => { onPhoto(''); startCamera() }} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><RefreshCcw size={16} />Retake photo</button></div>
  return <div>{cameraOpen ? <><video ref={videoRef} autoPlay playsInline className="h-52 w-full rounded-xl bg-slate-900 object-cover" /><div className="mt-3 flex gap-3"><button type="button" onClick={capture} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}>Capture</button><button type="button" onClick={stopCamera} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button></div></> : <button type="button" onClick={startCamera} className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-600"><Camera size={28} className="mb-2 text-teal-600" /><span className="text-sm font-semibold">Open live camera</span><span className="mt-1 text-xs text-slate-500">Use your device camera to take a selfie.</span></button>}{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}</div>
}

function SubmissionModal({ onClose, onSubmit, saving }) {
  const [licenseImage, setLicenseImage] = useState('')
  const [livePhoto, setLivePhoto] = useState('')
  const [error, setError] = useState('')
  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2_500_000) { setError('Use an image smaller than 2.5 MB.'); return }
    try { setLicenseImage(await readFile(file)); setError('') } catch { setError('Unable to read that image.') }
  }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4 sm:grid sm:place-items-center"><section className="mx-auto my-4 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:my-0 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Driver verification</p><h2 className="mt-1 text-xl font-bold text-slate-900">Complete your verification</h2><p className="mt-2 text-sm text-slate-500">Upload a clear license photo and capture a live selfie.</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500" aria-label="Close"><X size={20} /></button></div><div className="mt-6 grid gap-5 md:grid-cols-2"><section><h3 className="font-semibold text-slate-800">1. Upload license picture</h3><p className="mt-1 text-sm text-slate-500">JPG, PNG, or WebP · max 2.5 MB</p><label className="mt-3 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center">{licenseImage ? <img src={licenseImage} alt="License preview" className="h-44 w-full rounded-lg object-cover" /> : <><FileImage size={28} className="mb-2 text-teal-600" /><span className="text-sm font-semibold text-slate-700">Choose license image</span><span className="mt-1 text-xs text-slate-500">Tap to browse files</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="sr-only" /></label>{licenseImage && <button type="button" onClick={() => setLicenseImage('')} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><RefreshCcw size={16} />Choose another image</button>}</section><section><h3 className="font-semibold text-slate-800">2. Live photo</h3><p className="mt-1 text-sm text-slate-500">Take a clear selfie using your camera.</p><div className="mt-3"><CameraCapture photo={livePhoto} onPhoto={setLivePhoto} /></div></section></div>{error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}<div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="button" disabled={!licenseImage || !livePhoto || saving} onClick={() => onSubmit({ licenseImage, livePhoto })} className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed" style={{ backgroundColor: licenseImage && livePhoto && !saving ? '#0d9488' : '#cbd5e1', color: '#fff' }}>{saving ? 'Submitting…' : 'Submit for verification'}</button></div></section></div>
}

export default function VerificationTab({ token, api }) {
  const [status, setStatus] = useState('not_started')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const load = async () => { try { const result = await api('/verification/me', { token }); setStatus(result.status) } catch (error) { setMessage(error.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const submit = async (images) => { setSaving(true); setMessage(''); try { await api('/verification/submit', { token, method: 'POST', body: JSON.stringify(images) }); setStatus('pending'); setModalOpen(false); setMessage('Submitted — your verification is under review.') } catch (error) { setMessage(error.message) } finally { setSaving(false) } }
  if (loading) return <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">Loading verification status…</div>
  const verified = status === 'verified'
  const pending = status === 'pending'
  return <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Driver safety</p><h2 className="mt-1 text-xl font-bold text-slate-900">Verification status</h2><p className="mt-2 text-sm text-slate-500">Verified drivers can post rides and accept passengers.</p></div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: verified ? '#dcfce7' : pending ? '#fef3c7' : '#f1f5f9', color: verified ? '#15803d' : pending ? '#b45309' : '#475569' }}>{verified ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}{verified ? 'Verified' : pending ? 'Pending verification' : 'Not started'}</span></div>{message && <p className="mt-5 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">{message}</p>}{verified ? <div className="mt-6 rounded-xl bg-emerald-50 p-5"><ShieldCheck className="text-emerald-600" size={28} /><h3 className="mt-3 font-bold text-emerald-900">You’re ready to post rides</h3><p className="mt-1 text-sm text-emerald-800">Your driver verification has been approved.</p></div> : pending ? <div className="mt-6 rounded-xl bg-amber-50 p-5"><Clock3 className="text-amber-600" size={28} /><h3 className="mt-3 font-bold text-amber-900">Submitted — under review</h3><p className="mt-1 text-sm text-amber-800">Ride posting will unlock after an administrator approves your documents.</p></div> : <div className="mt-6 rounded-xl bg-slate-50 p-5"><Upload className="text-teal-600" size={28} /><h3 className="mt-3 font-bold text-slate-900">Complete your verification</h3><p className="mt-1 text-sm text-slate-600">You need a license image and a live camera photo before posting rides.</p><button type="button" onClick={() => setModalOpen(true)} className="mt-5 rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}>Verify now</button></div>}{modalOpen && <SubmissionModal onClose={() => setModalOpen(false)} onSubmit={submit} saving={saving} />}</section>
}
