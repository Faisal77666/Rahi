import { Home, LogOut, MapPinned, Menu, MessageCircle, Settings, ShieldCheck, User, X } from 'lucide-react'

const items = [
  { id: 'overview', label: 'Overview', Icon: Home },
  { id: 'passenger-trips', label: 'Passenger trips', Icon: MapPinned },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
  { id: 'verification', label: 'Verification', Icon: ShieldCheck },
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

export default function Sidebar({ activeTab, onTabChange, mobileOpen, onMobileOpen, onLogout }) {
  return <>
    <button type="button" aria-label="Open menu" onClick={() => onMobileOpen(true)} className="fixed left-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"><Menu size={21} /></button>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/35 md:hidden" aria-label="Close menu" onClick={() => onMobileOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10 transition-transform duration-200 md:translate-x-0 md:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2 py-3">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600 text-lg font-black text-white">R</span><span className="text-xl font-bold tracking-tight text-slate-900">Rahi</span></div>
        {mobileOpen && <button type="button" aria-label="Close menu" onClick={() => onMobileOpen(false)} className="h-9 w-9 rounded-lg text-slate-500 md:hidden" style={{ display: 'grid', placeItems: 'center', margin: 0, padding: 0, border: 0, background: 'transparent' }}><X size={20} /></button>}
      </div>
      <p className="mb-5 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Driver workspace</p>
      <nav className="space-y-1">
        {items.map(({ id, label, Icon }) => {
          const selected = activeTab === id
          return <button key={id} type="button" onClick={() => { onTabChange(id); onMobileOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition" style={{ backgroundColor: selected ? '#ccfbf1' : 'transparent', color: selected ? '#0f766e' : '#475569' }}><Icon size={19} strokeWidth={selected ? 2.5 : 2} />{label}</button>
        })}
      </nav>
      <div className="mt-auto rounded-2xl bg-slate-50 p-3">
        <p className="text-xs leading-5 text-slate-500">Keep your profile and verification details current to build rider trust.</p>
        <button type="button" onClick={onLogout} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600"><LogOut size={17} />Log out</button>
      </div>
    </aside>
  </>
}
