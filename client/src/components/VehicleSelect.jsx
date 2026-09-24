import { Bike, Car, Check } from 'lucide-react'
import { useState } from 'react'

const choices = [
  { value: 'car', title: 'Car', description: 'Offer comfortable shared rides for up to four passengers.', Icon: Car },
  { value: 'motorcycle', title: 'Motorcycle', description: 'A quick, efficient way to travel with one passenger.', Icon: Bike },
]

export default function VehicleSelect({ token, onComplete, api }) {
  const [selection, setSelection] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const continueToDashboard = async () => {
    if (!selection) return
    setSaving(true)
    setError('')
    try {
      const result = await api('/users/me', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ vehicleType: selection }),
      })
      onComplete(result.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-6 text-slate-900 sm:grid sm:place-items-center sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 pb-24 shadow-xl shadow-slate-900/5 sm:rounded-3xl sm:p-8 sm:pb-8 lg:p-10">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-teal-600 text-lg font-bold text-white">R</div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Rahi for drivers</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">Choose your vehicle type</h1>
          <p className="mt-3 text-slate-500">This helps riders know what to expect before they request a seat.</p>
        </div>

        <div className="mt-7 grid gap-3 sm:mt-9 sm:grid-cols-2 sm:gap-4">
          {choices.map(({ value, title, description, Icon }) => {
            const selected = selection === value
            return <button key={value} type="button" onClick={() => setSelection(value)} className={`relative min-h-44 rounded-2xl border-2 p-5 text-left transition sm:min-h-56 sm:p-6 ${selected ? 'border-teal-600 bg-teal-50 shadow-lg shadow-teal-600/10' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'}`} style={{ backgroundColor: selected ? '#f0fdfa' : '#ffffff', borderColor: selected ? '#0d9488' : '#e2e8f0' }}>
              {selected && <span className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-teal-600 text-white"><Check size={17} strokeWidth={3} /></span>}
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${selected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={29} /></span>
              <h2 className="mt-5 text-xl font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </button>
          })}
        </div>

        {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mt-7 sm:border-0 sm:bg-transparent sm:p-0">
          <button type="button" onClick={continueToDashboard} disabled={!selection || saving} className="w-full rounded-xl px-5 py-3.5 font-semibold shadow-lg shadow-teal-600/20 transition disabled:cursor-not-allowed disabled:shadow-none" style={{ color: '#ffffff', backgroundColor: !selection || saving ? '#cbd5e1' : '#0d9488' }}>
            <span style={{ color: '#ffffff' }}>{saving ? 'Saving your choice…' : 'Continue to dashboard'}</span>
          </button>
        </div>
      </section>
    </main>
  )
}
