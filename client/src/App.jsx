import { useEffect, useState } from 'react'
import './App.css'
import VehicleSelect from './components/VehicleSelect'
import ProtectedRoute from './components/ProtectedRoute'
import DriverDashboard from './components/driver/DriverDashboard'
import AdminDashboard from './components/admin/AdminDashboard'
import PassengerDashboard from './components/passenger/PassengerDashboard'
import SocketProvider from './realtime/SocketProvider'
import NotificationSoundProvider from './notifications/NotificationSoundProvider'
import PushNotificationProvider from './notifications/PushNotificationProvider'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const routes = ['Lahore-Pattoki', 'Pattoki-Lahore']

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const isJson = response.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await response.json() : {}
  if (response.status === 401) window.dispatchEvent(new Event('rahi:unauthorized'))
  if (!response.ok) throw new Error(body.message || `API request failed (${response.status}). Restart the backend if this endpoint was just added.`)
  return body
}

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('passenger')
  const [form, setForm] = useState({ name: '', phone: '', cnic: '', password: '', make: '', model: '', registrationNumber: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = mode === 'login'
        ? { phone: form.phone, password: form.password }
        : {
            name: form.name,
            phone: form.phone,
            cnic: form.cnic,
            password: form.password,
            role,
            ...(role === 'driver' ? { vehicleInfo: { make: form.make, model: form.model, registrationNumber: form.registrationNumber } } : {}),
          }
      const result = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(payload) })
      onLogin(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const Required = () => <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>

  return <main className="auth-page">
    <section className="auth-card">
      <p className="eyebrow">Lahore ↔ Pattoki</p>
      <h1>Drivo</h1>
      <p className="muted">Find a seat or offer one for your intercity journey.</p>
      <div className="tabs">
        <button className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>Login</button>
        <button className={mode === 'register' ? 'selected' : ''} onClick={() => setMode('register')}>Register</button>
      </div>
      <form onSubmit={submit}>
        {mode === 'register' && <>
          <label><span>Name <Required /></span><input name="name" value={form.name} onChange={update} required /></label>
          <label><span>I am a <Required /></span>
            <select value={role} onChange={(event) => setRole(event.target.value)}><option value="passenger">Passenger</option><option value="driver">Driver</option></select>
          </label>
        </>}
        <label><span>Phone <Required /></span><input name="phone" type="tel" inputMode="numeric" value={form.phone} onChange={update} placeholder="03001234567" pattern="03[0-9]{9}" title="Enter an 11-digit Pakistani mobile number, e.g. 03001234567" required /></label>
        {mode === 'register' && <label><span>CNIC <Required /></span><input name="cnic" value={form.cnic} onChange={update} placeholder="35202-1234567-1" pattern="[0-9]{5}-[0-9]{7}-[0-9]" title="Use the format 12345-1234567-1" required /></label>}
        <label><span>Password <Required /></span><input name="password" type="password" value={form.password} onChange={update} minLength="6" required /></label>
        {mode === 'register' && role === 'driver' && <fieldset><legend>Vehicle information</legend>
          <label><span>Make <Required /></span><input name="make" value={form.make} onChange={update} required /></label>
          <label><span>Model <Required /></span><input name="model" value={form.model} onChange={update} required /></label>
          <label><span>Registration number <Required /></span><input name="registrationNumber" value={form.registrationNumber} onChange={update} required /></label>
        </fieldset>}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}</button>
      </form>
    </section>
  </main>
}

function LegacyDriverDashboard({ session }) {
  const [rides, setRides] = useState([])
  const [requests, setRequests] = useState([])
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ route: routes[0], date: '', time: '', seatsTotal: 1, pricePerSeat: '' })
  const load = async () => {
    try {
      const [ridesResult, requestsResult] = await Promise.all([api('/rides'), api('/requests/mine', { token: session.token })])
      setRides(ridesResult.rides.filter((ride) => ride.driverId?._id === session.user.id))
      setRequests(requestsResult.requests)
    } catch (error) { setNotice(error.message) }
  }
  useEffect(() => { load() }, [])
  const postRide = async (event) => {
    event.preventDefault(); setNotice('')
    try { await api('/rides', { token: session.token, method: 'POST', body: JSON.stringify({ ...form, seatsTotal: Number(form.seatsTotal), pricePerSeat: Number(form.pricePerSeat) }) }); setForm({ ...form, date: '', time: '', pricePerSeat: '' }); setNotice('Ride posted.'); load() } catch (error) { setNotice(error.message) }
  }
  const decide = async (id, status) => {
    setNotice('')
    try { const result = await api(`/requests/${id}`, { token: session.token, method: 'PATCH', body: JSON.stringify({ status }) }); setNotice(status === 'accepted' ? `Accepted. Passenger phone: ${result.contactDetails.passenger.phone}` : 'Request rejected.'); load() } catch (error) { setNotice(error.message) }
  }
  return <DashboardShell session={session} notice={notice}>
    <div className="grid two-columns"><section className="panel"><h2>Post a ride</h2><form onSubmit={postRide} className="compact-form">
      <label>Route<select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}>{routes.map((route) => <option key={route}>{route}</option>)}</select></label>
      <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
      <label>Time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></label>
      <label>Total seats<input type="number" min="1" value={form.seatsTotal} onChange={(e) => setForm({ ...form, seatsTotal: e.target.value })} required /></label>
      <label>Price per seat (PKR)<input type="number" min="0" value={form.pricePerSeat} onChange={(e) => setForm({ ...form, pricePerSeat: e.target.value })} required /></label>
      <button className="primary">Post ride</button></form></section>
      <section className="panel"><h2>My active rides</h2><RideList rides={rides} empty="You have not posted an active ride yet." /></section></div>
    <section className="panel"><h2>Incoming requests</h2>{requests.length === 0 ? <p className="muted">No requests yet.</p> : requests.map((request) => <article className="request" key={request._id}><div><strong>{request.passengerId?.name}</strong><span>{request.rideId?.route} · {request.rideId?.date?.slice(0, 10)} at {request.rideId?.time}</span>{request.status === 'accepted' && <span>Passenger phone: {request.passengerId?.phone}</span>}</div><div><span className={`badge ${request.status}`}>{request.status}</span>{request.status === 'pending' && <><button onClick={() => decide(request._id, 'accepted')}>Accept</button><button className="danger" onClick={() => decide(request._id, 'rejected')}>Reject</button></>}</div></article>)}</section>
  </DashboardShell>
}

function LegacyPassengerDashboard({ session }) {
  const [route, setRoute] = useState(routes[0]); const [rides, setRides] = useState([]); const [requests, setRequests] = useState([]); const [notice, setNotice] = useState('')
  const load = async () => { try { const [rideData, requestData] = await Promise.all([api(`/rides?route=${encodeURIComponent(route)}`), api('/requests/mine', { token: session.token })]); setRides(rideData.rides); setRequests(requestData.requests) } catch (error) { setNotice(error.message) } }
  useEffect(() => { load() }, [route])
  useEffect(() => {
    const pollingId = window.setInterval(load, 10000)
    return () => window.clearInterval(pollingId)
  }, [route])
  const requestSeat = async (rideId) => { setNotice(''); try { await api('/requests', { token: session.token, method: 'POST', body: JSON.stringify({ rideId }) }); setNotice('Seat request sent.'); load() } catch (error) { setNotice(error.message) } }
  return <DashboardShell session={session} notice={notice}><section className="panel"><div className="section-title"><h2>Available rides</h2><select value={route} onChange={(e) => setRoute(e.target.value)}>{routes.map((item) => <option key={item}>{item}</option>)}</select></div>{rides.length === 0 ? <p className="muted">No active rides for this route yet.</p> : rides.map((ride) => <article className="ride" key={ride._id}><div><strong>{ride.route}</strong><span>{ride.date.slice(0, 10)} · {ride.time} · {ride.driverId?.name}</span><span>{ride.seatsAvailable}/{ride.seatsTotal} seats · PKR {ride.pricePerSeat}</span></div><button className="primary" disabled={ride.seatsAvailable === 0} onClick={() => requestSeat(ride._id)}>Request seat</button></article>)}</section><section className="panel"><h2>My requests</h2>{requests.length === 0 ? <p className="muted">You have not requested a seat yet.</p> : requests.map((request) => <article className="request" key={request._id}><div><strong>{request.rideId?.route}</strong><span>{request.rideId?.date?.slice(0, 10)} at {request.rideId?.time}</span>{request.status === 'accepted' && <span>Driver phone: {request.rideId?.driverId?.phone}</span>}</div><span className={`badge ${request.status}`}>{request.status}</span></article>)}</section></DashboardShell>
}

function RideList({ rides, empty }) { return rides.length === 0 ? <p className="muted">{empty}</p> : rides.map((ride) => <article className="ride" key={ride._id}><div><strong>{ride.route}</strong><span>{ride.date.slice(0, 10)} at {ride.time}</span></div><span>{ride.seatsAvailable}/{ride.seatsTotal} seats · PKR {ride.pricePerSeat}</span></article>) }
function DashboardShell({ session, notice, children }) { const logout = () => { localStorage.removeItem('drivoSession'); window.location.reload() }; return <main className="dashboard"><header><div><p className="eyebrow">DRIVO</p><h1>Welcome, {session.user.name}</h1></div><button onClick={logout}>Logout</button></header>{notice && <p className="notice">{notice}</p>}{children}</main> }
function App() {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem('drivoSession')) } catch { return null } })
  const saveSession = (nextSession) => { localStorage.setItem('drivoSession', JSON.stringify(nextSession)); setSession(nextSession) }
  const onLogin = (data) => saveSession(data)
  const onVehicleSelected = (user) => saveSession({ ...session, user })
  const logout = () => { localStorage.removeItem('drivoSession'); setSession(null) }

  useEffect(() => {
    window.addEventListener('rahi:unauthorized', logout)
    return () => window.removeEventListener('rahi:unauthorized', logout)
  }, [])

  if (!session?.token || !session?.user) return <AuthPage onLogin={onLogin} />
  const app = session.user.role === 'driver' && !session.user.vehicleType
    ? <VehicleSelect token={session.token} onComplete={onVehicleSelected} api={api} />
    : session.user.role === 'admin' ? <AdminDashboard session={session} api={api} /> : session.user.role === 'driver' ? <DriverDashboard session={session} api={api} /> : <PassengerDashboard session={session} api={api} />

  return <ProtectedRoute session={session} api={api} onSessionVerified={onVehicleSelected}><SocketProvider token={session.token}><NotificationSoundProvider><PushNotificationProvider token={session.token} api={api}>{app}</PushNotificationProvider></NotificationSoundProvider></SocketProvider></ProtectedRoute>
}

export default App
