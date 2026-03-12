
function FrachtyTab({ frachtyList, vehicles, onAdd, onDelete, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterVehicle, setFilterVehicle] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const MONTHS_PL = ["Styczen","Luty","Marzec","Kwiecien","Maj","Czerwiec","Lipiec","Sierpien","Wrzesien","Pazdziernik","Listopad","Grudzien"];
  const filtered = frachtyList.filter(r => {
    if (filterVehicle && r.vehicleId !== filterVehicle) return false;
    if (filterYear && r.dataZlecenia && !r.dataZlecenia.startsWith(filterYear)) return false;
    if (filterMonth !== "" && r.dataZlecenia) { const m = parseInt(r.dataZlecenia.split("-")[1]) - 1; if (m !== parseInt(filterMonth)) return false; }
    return true;
  }).sort((a,b) => (b.dataZlecenia||"").localeCompare(a.dataZlecenia||""));
  const totalCena = filtered.reduce((s,r) => s + (parseFloat(r.cenaEur)||0), 0);
  const totalKmLad = filtered.reduce((s,r) => s + (parseInt(r.kmLadowne)||0), 0);
  const avgEurKm = totalKmLad > 0 ? (totalCena/totalKmLad).toFixed(2) : "-";
  const fmt = (n) => n ? parseFloat(n).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2}) : "-";
  const editRecord = editId ? frachtyList.find(r => r.id === editId) : null;
  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Frachty</h2>
          <p className="text-sm text-gray-400 mt-0.5">{frachtyList.length} wpisow lacznie</p>
        </div>
        <button onClick={() => { setEditId(null); setShowForm(true); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:"#111827"}}>+ Dodaj fracht</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterVehicle} onChange={e => setFilterVehicle(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700">
          <option value="">Wszystkie pojazdy</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700">
          <option value="">Wszystkie lata</option>
          {["2024","2025","2026"].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700">
          <option value="">Wszystkie miesiace</option>
          {MONTHS_PL.map((m,i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[["Frachtow",filtered.length,"#6366f1"],["Przychod EUR",fmt(totalCena),"#16a34a"],["KM ladowne",totalKmLad.toLocaleString("pl-PL"),"#0ea5e9"],["Sr. EUR/km",avgEurKm,"#f59e0b"]].map(([label,value,color]) => (
          <div key={label} className="rounded-xl p-3 border border-gray-100 bg-white">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="text-lg font-bold" style={{color}}>{value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
              {["Data","Pojazd","Klient","Skad","Dokad","Cena EUR","KM lad.","KM wsz.","EUR/km","Nr FV","Dyspozytor",""].map(h => <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={12} className="text-center py-10 text-gray-400">Brak frachtow - kliknij + Dodaj fracht</td></tr>}
            {filtered.map(r => {
              const v = vehicles.find(v => v.id === r.vehicleId);
              const eurKm = r.kmLadowne && r.cenaEur ? (parseFloat(r.cenaEur)/parseInt(r.kmLadowne)).toFixed(2) : "-";
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{r.dataZlecenia||"-"}</td>
                  <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-md text-xs font-bold bg-gray-100 text-gray-700">{v?.plate||r.vehicleId}</span></td>
                  <td className="px-3 py-2.5 max-w-xs truncate text-gray-700">{r.klient||"-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 text-xs">{r.skad||"-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 text-xs">{r.dokod||"-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-green-700">{r.cenaEur ? fmt(r.cenaEur)+" EUR" : "-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{r.kmLadowne ? parseInt(r.kmLadowne).toLocaleString("pl-PL") : "-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{r.kmWszystkie ? parseInt(r.kmWszystkie).toLocaleString("pl-PL") : "-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-amber-600 font-medium">{eurKm !== "-" ? eurKm+" EUR" : "-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 text-xs">{r.nrFV||"-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 text-xs">{r.dyspozytor||"-"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditId(r.id); setShowForm(true); }} className="px-2 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200">edit</button>
                      <button onClick={() => { if(window.confirm("Usunac fracht?")) onDelete(r.id); }} className="px-2 py-1 rounded text-xs bg-red-50 hover:bg-red-100 text-red-500">x</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showForm && <FrachtyModal record={editRecord} vehicles={vehicles} onSave={(data) => { if(editId) onUpdate(editId,data); else onAdd(data); setShowForm(false); setEditId(null); }} onClose={() => { setShowForm(false); setEditId(null); }} />}
    </div>
  );
}

function FrachtyModal({ record, vehicles, onSave, onClose }) {
  const empty = {dataZlecenia:"",dataZaladunku:"",dataRozladunku:"",godzZaladunku:"",godzRozladunku:"",skad:"",zaladunekKod:"",dokod:"",klient:"",cenaEur:"",kmPodjazd:"",kmLadowne:"",kmWszystkie:"",wagaLadunku:"",dyspozytor:"",nrFV:"",dataWyslania:"",terminPlatnosci:"",uwagi:"",vehicleId:""};
  const [f, setF] = useState(record ? {...empty,...record} : empty);
  const set = (k,v) => setF(prev => { const next={...prev,[k]:v}; const pod=parseInt(next.kmPodjazd)||0; const lad=parseInt(next.kmLadowne)||0; next.kmWszystkie=pod+lad>0?String(pod+lad):""; return next; });
  const eurKmLad = f.kmLadowne && f.cenaEur ? (parseFloat(f.cenaEur)/parseInt(f.kmLadowne)).toFixed(2) : null;
  const eurKmWsz = f.kmWszystkie && f.cenaEur ? (parseFloat(f.cenaEur)/parseInt(f.kmWszystkie)).toFixed(2) : null;
  const inp = "w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-gray-400";
  const lbl = "text-xs font-semibold text-gray-500 mb-1 block";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.4)"}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{maxHeight:"92vh"}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-900">{record ? "Edytuj fracht" : "Nowy fracht"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div><label className={lbl}>Pojazd</label><select value={f.vehicleId} onChange={e => set("vehicleId",e.target.value)} className={inp}><option value="">wybierz pojazd</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} {v.brand}</option>)}</select></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={lbl}>Data zlecenia</label><input type="date" value={f.dataZlecenia} onChange={e => set("dataZlecenia",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Data zaladunku</label><input type="date" value={f.dataZaladunku} onChange={e => set("dataZaladunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Data rozladunku</label><input type="date" value={f.dataRozladunku} onChange={e => set("dataRozladunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Godz. zaladunku</label><input type="time" value={f.godzZaladunku} onChange={e => set("godzZaladunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Godz. rozladunku</label><input type="time" value={f.godzRozladunku} onChange={e => set("godzRozladunku",e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={lbl}>Skad</label><input placeholder="PL 25-650" value={f.skad} onChange={e => set("skad",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Zaladunek</label><input placeholder="DE 67304" value={f.zaladunekKod} onChange={e => set("zaladunekKod",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Rozladunek</label><input placeholder="FR 93000" value={f.dokod} onChange={e => set("dokod",e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={lbl}>Klient</label><input placeholder="nazwa klienta" value={f.klient} onChange={e => set("klient",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Dyspozytor</label><input placeholder="imie dyspozytora" value={f.dyspozytor} onChange={e => set("dyspozytor",e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={lbl}>Cena EUR</label><input type="number" placeholder="0.00" value={f.cenaEur} onChange={e => set("cenaEur",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>KM podjazd</label><input type="number" placeholder="0" value={f.kmPodjazd} onChange={e => set("kmPodjazd",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>KM ladowne</label><input type="number" placeholder="0" value={f.kmLadowne} onChange={e => set("kmLadowne",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>KM wszystkie (auto)</label><input readOnly value={f.kmWszystkie} className={inp+" bg-gray-50 text-gray-400"} /></div>
          </div>
          {(eurKmLad||eurKmWsz) && <div className="flex gap-4 text-sm">{eurKmLad && <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold">EUR/km lad: {eurKmLad}</span>}{eurKmWsz && <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold">EUR/km wsz: {eurKmWsz}</span>}</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={lbl}>Waga (kg)</label><input type="number" placeholder="0" value={f.wagaLadunku} onChange={e => set("wagaLadunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Nr FV</label><input placeholder="F/01/2026" value={f.nrFV} onChange={e => set("nrFV",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Data wyslania FV</label><input type="date" value={f.dataWyslania} onChange={e => set("dataWyslania",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Termin platnosci</label><input type="date" value={f.terminPlatnosci} onChange={e => set("terminPlatnosci",e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>Uwagi</label><textarea rows={2} placeholder="dodatkowe informacje..." value={f.uwagi} onChange={e => set("uwagi",e.target.value)} className={inp+" resize-none"} /></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Anuluj</button>
          <button onClick={() => { if(!f.vehicleId){alert("Wybierz pojazd");return;} if(!f.cenaEur){alert("Wpisz cene EUR");return;} onSave(f); }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{background:"#111827"}}>{record ? "Zapisz zmiany" : "Dodaj fracht"}</button>
        </div>
      </div>
    </div>
  );
}
