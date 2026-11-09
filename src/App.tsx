import { useEffect, useState } from 'react';
import { Modal } from './components/Modal.tsx';
import { ACK_KEY, type Reading } from './domain/types.ts';
import { LogProvider, useLog } from './store/LogProvider.tsx';
import { AddView } from './views/AddView.tsx';
import { ChartsView } from './views/ChartsView.tsx';
import { HistoryView } from './views/HistoryView.tsx';
import { HomeView } from './views/HomeView.tsx';
import { MoreView } from './views/MoreView.tsx';
import { PrintView } from './views/PrintView.tsx';

type View = 'home' | 'add' | 'history' | 'charts' | 'more' | 'print';

function viewFromHash(): View {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('add')) return 'add';
  if (hash.startsWith('history')) return 'history';
  if (hash.startsWith('charts')) return 'charts';
  if (hash.startsWith('more')) return 'more';
  if (hash.startsWith('print')) return 'print';
  return 'home';
}

export default function App() {
  return (
    <LogProvider>
      <Shell />
    </LogProvider>
  );
}

function Shell() {
  const log = useLog();
  const [view, setView] = useState<View>(() => viewFromHash());
  const [preset, setPreset] = useState<'glucose' | 'bp' | null>(null);
  const [editing, setEditing] = useState<Reading | null>(null);
  const [ack, setAck] = useState(() => {
    try {
      return localStorage.getItem(ACK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [undo, setUndo] = useState<Reading | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = viewFromHash();
      setView(next);
      if (next !== 'add') setEditing(null);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  function go(next: View, extra?: { preset?: 'glucose' | 'bp' | null; editing?: Reading | null }) {
    if (next === 'add') {
      setPreset(extra?.preset ?? null);
      setEditing(extra?.editing ?? null);
    }
    const hash = next === 'home' ? '#/' : `#/${next}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setView(next);
  }

  return (
    <>
      <a className="skip" href="#main">အကြောင်းအရာသို့ သွားမည်</a>
      <nav className="nav no-print" aria-label="အဓိက">
        {([
          ['home', 'ပင်မ'],
          ['add', 'ထည့်မည်'],
          ['history', 'မှတ်တမ်း'],
          ['charts', 'ဂရပ်'],
          ['more', 'ပိုမို'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className="nav-btn" aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main id="main" className="shell">
        <header className="topbar no-print">
          <div>
            <h1 className="brand">သွေးမှတ်တမ်း</h1>
            <p className="muted">ဖုန်းထဲမှာပဲ သိမ်းသော သွေးဂလူးကို့စ်နှင့် သွေးပေါင်ချိန်</p>
          </div>
        </header>
        {log.demo ? <p className="demo-chip">နမူနာဒေတာ — တကယ်လူနာမှတ်တမ်း မဟုတ်ပါ</p> : null}
        {log.saveMessage ? <p className="banner warning" role="status">{log.saveMessage}</p> : null}
        {log.loadError === 'unavailable' ? (
          <p className="banner warning" role="alert">ဤဘရောက်ဇာတွင် ဒေတာသိမ်း၍မရပါ။ မှတ်တမ်းမကျန်နိုင်ပါ။</p>
        ) : null}
        {log.loadError === 'corrupt' ? (
          <section className="card stack">
            <h2>သိမ်းထားသောဒေတာ ပျက်နေသည်</h2>
            <p>ပျက်နေသောစာသားကို အလိုအလျောက် မဖျက်ပါ။ ပြန်မရေးမီ ဘက်အပ်ထုတ်နိုင်သည်။</p>
            <button type="button" className="btn btn-danger" onClick={log.resetCorrupt}>ပျက်နေသောဒေတာကို ဖယ်ပြီး အသစ်စမည်</button>
          </section>
        ) : null}
        {view === 'home' ? <HomeView onAdd={(type) => go('add', { preset: type, editing: null })} /> : null}
        {view === 'add' ? <AddView preset={preset} editing={editing} onDone={() => go('home')} /> : null}
        {view === 'history' ? (
          <HistoryView
            onEdit={(reading) => go('add', { editing: reading, preset: null })}
            onDeleted={(reading) => setUndo(reading)}
          />
        ) : null}
        {view === 'charts' ? <ChartsView /> : null}
        {view === 'more' ? <MoreView onPrint={() => go('print')} /> : null}
        {view === 'print' ? <PrintView /> : null}
      </main>
      {undo ? (
        <div className="toast no-print" role="status">
          <span>ဖျက်ပြီးပါပြီ။</span>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              if (log.restoreReading(undo)) setUndo(null);
            }}
          >
            ပြန်ယူမည်
          </button>
        </div>
      ) : null}
      {log.hydrated && !ack ? (
        <Modal title="ဤအက်ပ်က ဘာလုပ်သလဲ">
          <div className="stack">
            <p>ဖုန်းထဲမှာပဲ မှတ်တမ်းတင်သည်။</p>
            <p>ရောဂါမရှာပါ။ ဆေးပမာဏမပြောင်းပါ။ နံပါတ်တစ်ခုတည်းဖြင့် ပုံမှန်ဟု မဆုံးဖြတ်ပါ။</p>
            <p>ဘရောက်ဇာဒေတာဖျက်လျှင် မှတ်တမ်းပါ ပျောက်သည်။ အခြားစက်နှင့် မချိတ်ပါ။</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                try {
                  localStorage.setItem(ACK_KEY, '1');
                } catch {
                  /* still let them continue this visit */
                }
                setAck(true);
              }}
            >
              နားလည်ပါသည်
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
