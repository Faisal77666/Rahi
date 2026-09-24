import { useEffect, useMemo, useState } from 'react'
import { Bell, Car, CheckCircle2, ChevronRight, CircleUserRound, Clock3, MapPinned, Pencil, Users, X } from 'lucide-react'
import Sidebar from './Sidebar'
import VerificationTab from './VerificationTab'
import { SoundToggle, useNotificationSound } from '../../notifications/NotificationSoundProvider'
import ChatPanel from '../chat/ChatPanel'
import { useRahiSocket } from '../../realtime/SocketProvider'

const titles = { overview: 'Overview', rides: 'My Rides', requests: 'Requests', 'passenger-trips': 'Passenger trips', verification: 'Verification', profile: 'Profile', settings: 'Settings' }

const formatDate = (value) => new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })

function StatCard({ label, value, Icon, tint }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p></div><span className="grid h-11 w-11 place-items-center rounded-xl" style={{ backgroundColor: tint, color: '#0f766e' }}><Icon size={21} /></span></div></article>
}

function RideRows({ rides, compact = false, onEdit, onCancel }) {
  if (!rides.length) return <p className="py-8 text-center text-sm text-slate-500">No rides posted yet.</p>
  return <div className="divide-y divide-slate-100">{rides.slice(0, compact ? 5 : undefined).map((ride) => <article key={ride._id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-slate-800">{ride.route}</p><p className="mt-1 text-sm text-slate-500">{formatDate(ride.date)} · {ride.time}</p></div><div className="flex items-center gap-3 text-right"><div><span className="mr-2 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">{ride.rideType === 'private' ? 'Private' : 'Shared'}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{ride.status}</span><p className="mt-2 text-sm text-slate-500">{ride.seatsAvailable}/{ride.seatsTotal} seat{ride.seatsTotal === 1 ? '' : 's'} · PKR {ride.pricePerSeat}</p></div>{onEdit && <button type="button" onClick={() => onEdit(ride)} className="h-10 w-10 rounded-xl" style={{ display: 'grid', placeItems: 'center', margin: 0, padding: 0, border: '1px solid #99f6e4', background: '#f0fdfa', color: '#0f766e' }} aria-label="Edit ride"><Pencil size={17} strokeWidth={2.25} /></button>}{onCancel && <button type="button" onClick={() => onCancel(ride)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: '1px solid #fecaca', color: '#b91c1c', background: '#fff' }}>Cancel ride</button>}</div></article>)}</div>
}

function PassengerTripCard({ trip, token, api, onSent, onOpenChat }) {
  const [counterOpen, setCounterOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const sendOffer = async (offerAmount) => {
    setSending(true)
    try { const result = await api(`/trip-requests/${trip._id}/offer`, { token, method: 'POST', body: JSON.stringify({ amount: Number(offerAmount) }) }); onSent(result.message, result.offer?.type === 'accepted' ? trip._id : null) } catch (error) { onSent(error.message, null) } finally { setSending(false) }
  }
  return <article className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><MapPinned size={20} /></span><div><p className="font-semibold text-slate-800">{trip.route}</p><p className="mt-1 text-sm text-slate-500">{formatDate(trip.date)} · {trip.time}</p><p className="mt-1 text-sm text-slate-500">Passenger: {trip.passengerId?.name}</p></div></div><div className="min-w-48 text-right"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Passenger offered full-ride fare</p><p className="mt-1 text-lg font-bold text-teal-700">PKR {trip.offeredPrice}</p>{trip.status === 'accepted' && trip.myOffer?.status === 'accepted' ? <><p className="mt-2 text-sm font-semibold text-emerald-700">Agreed full-ride fare: PKR {trip.myOffer.amount}</p><button type="button" onClick={() => onOpenChat(trip._id)} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}>Open chat</button></> : trip.myOffer ? <p className="mt-2 text-sm font-semibold text-amber-700">Your counter: PKR {trip.myOffer.amount}</p> : counterOpen ? <div className="mt-3 flex justify-end gap-2"><input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Counter PKR" className="w-28 rounded-lg border border-slate-200 p-2 text-sm" /><button disabled={sending || amount === ''} onClick={() => sendOffer(amount)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}>{sending ? '…' : 'Send'}</button></div> : <div className="mt-3 flex justify-end gap-2"><button disabled={sending} onClick={() => sendOffer(trip.offeredPrice)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}>{sending ? '…' : 'Accept fare'}</button><button onClick={() => setCounterOpen(true)} className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700">Counter</button></div>}</div></article>
}

function EditRideModal({ ride, onClose, onSave, saving }) {
  const [form, setForm] = useState({ route: ride.route, rideType: ride.rideType || 'shared', date: ride.date.slice(0, 10), time: ride.time, seatsTotal: ride.seatsTotal, pricePerSeat: ride.pricePerSeat })
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value, ...(event.target.name === 'rideType' && event.target.value === 'private' ? { seatsTotal: 1 } : {}) })
  const futureDeparture = new Date(`${form.date}T${form.time}:00+05:00`) > new Date()
  const submit = (event) => { event.preventDefault(); if (futureDeparture) onSave({ ...form, seatsTotal: Number(form.seatsTotal), pricePerSeat: Number(form.pricePerSeat) }) }
  const today = new Date().toISOString().slice(0, 10)
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Edit ride</h2><p className="mt-1 text-sm text-slate-500">Update your active ride details.</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500" aria-label="Close"><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Route<select name="route" value={form.route} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"><option>Lahore-Pattoki</option><option>Pattoki-Lahore</option></select></label><label className="text-sm font-semibold text-slate-700">Ride type<select name="rideType" value={form.rideType} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"><option value="shared">Shared ride</option><option value="private">Private ride (1 passenger)</option></select></label><label className="text-sm font-semibold text-slate-700">Date<input name="date" type="date" min={today} value={form.date} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5" required /></label><label className="text-sm font-semibold text-slate-700">Time<input name="time" type="time" value={form.time} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5" required /></label><label className="text-sm font-semibold text-slate-700">Total seats<input name="seatsTotal" type="number" min="1" disabled={form.rideType === 'private'} value={form.rideType === 'private' ? 1 : form.seatsTotal} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-100" required /></label><label className="text-sm font-semibold text-slate-700">{form.rideType === 'private' ? 'Full ride price (PKR)' : 'Price per seat (PKR)'}<input name="pricePerSeat" type="number" min="0" value={form.pricePerSeat} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5" required /></label></div>{!futureDeparture && <p className="mt-4 text-sm font-medium text-rose-600">Choose a departure time in the future.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button disabled={saving || !futureDeparture} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: saving || !futureDeparture ? '#cbd5e1' : '#0d9488', color: '#ffffff' }}>{saving ? 'Saving…' : 'Save changes'}</button></div></form></div>
}

function CreateRideModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ route: 'Lahore-Pattoki', rideType: 'shared', date: new Date().toISOString().slice(0, 10), time: '', seatsTotal: 1, pricePerSeat: '' })
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value, ...(event.target.name === 'rideType' && event.target.value === 'private' ? { seatsTotal: 1 } : {}) })
  const futureDeparture = form.time && new Date(`${form.date}T${form.time}:00+05:00`) > new Date()
  const submit = (event) => { event.preventDefault(); if (futureDeparture) onSave({ ...form, seatsTotal: Number(form.seatsTotal), pricePerSeat: Number(form.pricePerSeat) }) }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-teal-700">New ride</p><h2 className="mt-1 text-lg font-bold text-slate-900">Post a ride</h2></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500" aria-label="Close"><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Route<select name="route" value={form.route} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"><option>Lahore-Pattoki</option><option>Pattoki-Lahore</option></select></label><label className="text-sm font-semibold text-slate-700">Ride type<select name="rideType" value={form.rideType} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"><option value="shared">Shared ride</option><option value="private">Private ride (1 passenger)</option></select></label><label className="text-sm font-semibold text-slate-700">Date<input name="date" type="date" min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5" required /></label><label className="text-sm font-semibold text-slate-700">Time<input name="time" type="time" value={form.time} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5" required /></label><label className="text-sm font-semibold text-slate-700">Total seats<input name="seatsTotal" type="number" min="1" disabled={form.rideType === 'private'} value={form.rideType === 'private' ? 1 : form.seatsTotal} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-100" required /></label><label className="text-sm font-semibold text-slate-700">{form.rideType === 'private' ? 'Full ride price (PKR)' : 'Price per seat (PKR)'}<input name="pricePerSeat" type="number" min="0" value={form.pricePerSeat} onChange={update} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5" required /></label></div>{form.time && !futureDeparture && <p className="mt-4 text-sm font-medium text-rose-600">Choose a departure time in the future.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button disabled={saving || !futureDeparture} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: saving || !futureDeparture ? '#cbd5e1' : '#0d9488', color: '#fff' }}>{saving ? 'Posting…' : 'Post ride'}</button></div></form></div>
}

export default function DriverDashboard({ session, api }) {
  const { play } = useNotificationSound()
  const socket = useRahiSocket()
  const [activeTab, setActiveTab] = useState('overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [rides, setRides] = useState([])
  const [requests, setRequests] = useState([])
  const [tripRequests, setTripRequests] = useState([])
  const [notice, setNoticeText] = useState('')
  const setNotice = (message) => {
    setNoticeText(message)
    if (!message) return
    const sound = /(reject|cancel|error|unable|fail)/i.test(message)
      ? 'request_rejected'
      : /(accept|confirm|success)/i.test(message)
        ? 'request_accepted'
        : 'new_request'
    play(sound)
  }
  const [loading, setLoading] = useState(true)
  const [editingRide, setEditingRide] = useState(null)
  const [creatingRide, setCreatingRide] = useState(false)
  const [savingRide, setSavingRide] = useState(false)
  const [chatTripId, setChatTripId] = useState('')

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const tripRequestData = await api('/trip-requests', { token: session.token })
      setRides([])
      setRequests([])
      setTripRequests(tripRequestData.tripRequests)
    } catch (error) { setNotice(error.message) } finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    load()
    const refreshId = window.setInterval(() => load(true), 10000)
    return () => window.clearInterval(refreshId)
  }, [])
  useEffect(() => {
    if (!socket) return undefined
    const openConfirmedTripChat = ({ tripRequestId }) => {
      if (!tripRequestId) return
      setChatTripId(String(tripRequestId))
      setActiveTab('chat')
      load(true)
    }
    socket.on('request_accepted', openConfirmedTripChat)
    return () => socket.off('request_accepted', openConfirmedTripChat)
  }, [socket])
  useEffect(() => {
    const closeDesktopDrawer = () => { if (window.innerWidth >= 768) setMobileOpen(false) }
    closeDesktopDrawer()
    window.addEventListener('resize', closeDesktopDrawer)
    return () => window.removeEventListener('resize', closeDesktopDrawer)
  }, [])
  useEffect(() => {
    const openRequestedTab = () => {
      if (window.location.hash === '#requests') setActiveTab('requests')
      if (window.location.hash === '#passenger-trips') setActiveTab('passenger-trips')
    }
    openRequestedTab()
    window.addEventListener('hashchange', openRequestedTab)
    return () => window.removeEventListener('hashchange', openRequestedTab)
  }, [])

  const approve = async (id, status) => {
    try {
      const result = await api(`/requests/${id}`, { token: session.token, method: 'PATCH', body: JSON.stringify({ status }) })
      setNotice(status === 'accepted' ? `Request accepted. Passenger: ${result.contactDetails.passenger.phone}` : 'Request rejected.')
      load(true)
    } catch (error) { setNotice(error.message) }
  }
  const saveRide = async (updates) => {
    setSavingRide(true)
    try {
      await api(`/rides/${editingRide._id}`, { token: session.token, method: 'PATCH', body: JSON.stringify(updates) })
      setEditingRide(null); setNotice('Ride updated successfully.'); load(true)
    } catch (error) { setNotice(error.message) } finally { setSavingRide(false) }
  }
  const createRide = async (details) => {
    setSavingRide(true)
    try { await api('/rides', { token: session.token, method: 'POST', body: JSON.stringify(details) }); setCreatingRide(false); setNotice('Ride posted successfully.'); load(true) } catch (error) { setNotice(error.message) } finally { setSavingRide(false) }
  }
  const cancelRide = async (ride) => {
    const confirmed = window.confirm('Cancel this ride? Your first cancellation is allowed, but a second cancellation blocks ride actions for 48 hours.')
    if (!confirmed) return
    try { const result = await api(`/rides/${ride._id}`, { token: session.token, method: 'DELETE' }); setNotice(result.message); load(true) } catch (error) { setNotice(error.message) }
  }
  const pending = requests.filter((item) => item.status === 'pending')
  const seatsFilled = useMemo(() => rides.reduce((total, ride) => total + (ride.seatsTotal - ride.seatsAvailable), 0), [rides])
  const logout = () => { localStorage.removeItem('drivoSession'); window.location.reload() }
  const vehicleLabel = session.user.vehicleType === 'motorcycle' ? 'Motorcycle' : 'Car'
  const isVerified = session.user.verificationStatus === 'verified'

  const overview = <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Total rides posted" value={rides.length} Icon={Car} tint="#ccfbf1" /><StatCard label="Active requests" value={pending.length} Icon={Users} tint="#dbeafe" /><StatCard label="Seats filled" value={seatsFilled} Icon={CheckCircle2} tint="#dcfce7" /></div><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-2 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Recent rides</h2><p className="mt-1 text-sm text-slate-500">Your five most recent active ride posts.</p></div><button onClick={() => setActiveTab('rides')} className="flex items-center gap-1 text-sm font-semibold text-teal-700">View all <ChevronRight size={16} /></button></div><RideRows rides={rides} compact /></section></>
  const requestList = <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-bold text-slate-900">Passenger offers</h2><p className="mt-1 text-sm text-slate-500">Accept or reject each passenger’s per-seat offer.</p></div>{requests.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No offers yet.</p> : <div className="divide-y divide-slate-100">{requests.map((request) => <article key={request._id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold text-slate-800">{request.passengerId?.name}</p><p className="mt-1 text-sm text-slate-500">{request.rideId?.route} · {request.rideId?.time}</p><p className="mt-1 text-sm text-teal-700">Passenger offer: PKR {request.proposedPrice ?? request.rideId?.pricePerSeat} / seat · Your asking fare: PKR {request.rideId?.pricePerSeat}</p>{request.status === 'accepted' && <p className="mt-1 text-sm text-teal-700">Passenger phone: {request.passengerId?.phone}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${request.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : request.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{request.status}</span>{request.status === 'pending' && <><button onClick={() => approve(request._id, 'accepted')} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#ffffff' }}>Accept offer</button><button onClick={() => approve(request._id, 'rejected')} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600">Reject</button></>}</div></article>)}</div>}</section>
  const passengerTrips = <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Passenger trip requests</h2><p className="mt-1 text-sm text-slate-500">Open requests plus trips you have already accepted.</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700">{tripRequests.filter((trip) => trip.status === 'open').length} open</span></div>{tripRequests.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No passenger trip requests right now.</p> : <div className="divide-y divide-slate-100">{tripRequests.map((trip) => <PassengerTripCard key={trip._id} trip={trip} token={session.token} api={api} onOpenChat={(tripId) => { setChatTripId(tripId); setActiveTab('chat') }} onSent={(message, acceptedTripId) => { setNotice(message); load(true); if (acceptedTripId) { setChatTripId(acceptedTripId); setActiveTab('chat') } }} />)}</div>}</section>
  const privateOverview = <><div className="grid gap-4 sm:grid-cols-2"><StatCard label="Open passenger trips" value={tripRequests.length} Icon={MapPinned} tint="#ccfbf1" /><StatCard label="Verification" value={isVerified ? 'Verified' : 'Required'} Icon={CheckCircle2} tint={isVerified ? '#dcfce7' : '#fef3c7'} /></div><div className="mt-6">{passengerTrips}</div></>
  const placeholder = <section className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><Clock3 className="mx-auto text-teal-600" size={34} /><h2 className="mt-4 text-lg font-bold text-slate-900">{titles[activeTab]} workspace</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">This section is ready for its dedicated workflow in the next dashboard phase.</p></div></section>

  const ridesTab = <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">My rides</h2><p className="mt-1 text-sm text-slate-500">Manage your active ride posts.</p></div>{isVerified ? <button type="button" onClick={() => setCreatingRide(true)} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}>Post a ride</button> : <button type="button" onClick={() => setActiveTab('verification')} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">Verification required</button>}</div>{!isVerified && <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">Complete verification to unlock ride posting.</div>}<div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">First cancellation is allowed. A second ride cancellation temporarily blocks ride actions for 48 hours.</div><RideRows rides={rides} onEdit={setEditingRide} onCancel={cancelRide} /></section>
  return <main className="min-h-[100dvh] bg-slate-50"><Sidebar activeTab={activeTab} onTabChange={setActiveTab} mobileOpen={mobileOpen} onMobileOpen={setMobileOpen} onLogout={logout} /><div className="min-h-screen p-4 pt-20 sm:p-6 sm:pt-20 md:ml-72 md:p-8"><header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Driver dashboard</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{titles[activeTab]}</h1></div><div className="flex items-center gap-3"><SoundToggle /><button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"><Bell size={19} /></button></div></header>{notice && <p className="mb-5 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">{notice}</p>}{loading ? <div className="grid min-h-64 place-items-center text-sm font-medium text-slate-500">Loading dashboard…</div> : activeTab === 'overview' ? privateOverview : activeTab === 'passenger-trips' ? passengerTrips : activeTab === 'chat' ? <ChatPanel tripRequestId={chatTripId} session={session} api={api} /> : activeTab === 'verification' ? <VerificationTab token={session.token} api={api} /> : placeholder}</div></main>
}
