// Lucky Frogs 3‑Reel Slot
// Everything persists in localStorage: balance, bet, symbols, mute.

(() => {
  // ---------- Persistence Helpers ----------
  const STORAGE_KEYS = {
    BALANCE: 'lf_balance',
    BET: 'lf_bet',
    SYMBOLS: 'lf_symbols_v1',
    MUTE: 'lf_mute',
    SOUND: 'lf_sound_style'
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
  function load(key, fallback){
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    try{ return JSON.parse(raw); } catch{ return fallback; }
  }

  // ---------- Default Symbols ----------
  // You can edit these defaults or add your own via the Symbol Manager UI.
  const DEFAULT_SYMBOLS = [
    { id:'cherry', name:'Cherry', type:'text', display:'🍒', weight:6, payout3:5, payout2:1.5, isWild:false },
    { id:'lemon',  name:'Lemon',  type:'text', display:'🍋', weight:6, payout3:5, payout2:1.5, isWild:false },
    { id:'grape',  name:'Grapes', type:'text', display:'🍇', weight:5, payout3:8, payout2:2, isWild:false },
    { id:'bell',   name:'Bell',   type:'text', display:'🔔', weight:4, payout3:10, payout2:3, isWild:false },
    { id:'star',   name:'Star',   type:'text', display:'⭐', weight:3, payout3:15, payout2:4, isWild:false },
    { id:'skull',  name:'Skull',  type:'text', display:'💀', weight:2, payout3:-20, payout2:-15, isWild:false },
    { id:'frog',  name:'Frog',  type:'text', display:'🐸', weight:3, payout3:30, payout2:6,isWild:false },
    { id:'wild',  name:'WILD',  type:'text', display:'🃏', weight:2, payout3:50, payout2:15, isWild:true  },
  ];

  let symbols = load(STORAGE_KEYS.SYMBOLS, DEFAULT_SYMBOLS);
  // --- Migration: convert legacy 'BCA' entries to 'Skull' ---
  (function migrateBcaToSkull(){
    let changed = false;
    symbols = symbols.map(s => {
      if(s.id === 'bca'){
        changed = true;
        return { id:'skull', name:'Skull', type:'text', display:'💀', weight:(s.weight||2), payout3:-20, payout2:-15, isWild:false };
      }
      return s;
    });
    if(changed) save(STORAGE_KEYS.SYMBOLS, symbols);
  })();

  // --- Migration: replace legacy 'Seven' with penalty 'Skull' image symbol ---
  (function migrateSevenToSkull(){
    const hasSkull = symbols.some(s => s.id==='skull');
    const idxSeven = symbols.findIndex(s => s.id==='seven');
    if(idxSeven !== -1){
      symbols[idxSeven] = { id:'skull',  name:'Skull',  type:'text', display:'💀', weight:2, payout3:-20, payout2:-15, isWild:false };
    }else if(!hasSkull){
      symbols.push({ id:'skull',  name:'Skull',  type:'text', display:'💀', weight:2, payout3:-20, payout2:-15, isWild:false });
    }
    save(STORAGE_KEYS.SYMBOLS, symbols);
  // --- Enforce payout table (Trevor spec) and Skull penalties ---
  (function enforceNewPayouts(){
    const map = {
      cherry:{p3:5, p2:1.5}, lemon:{p3:5, p2:1.5}, grape:{p3:8, p2:2},
      bell:{p3:10, p2:3}, star:{p3:15, p2:4}, frog:{p3:30, p2:6},
      wild:{p3:50, p2:15}, skull:{p3:-20, p2:-15}
    };
    symbols = symbols.map(s => (map[s.id] ? {...s, payout3:map[s.id].p3, payout2:map[s.id].p2} : s));
    save(STORAGE_KEYS.SYMBOLS, symbols);
  })();

  })();

  let mute = load(STORAGE_KEYS.MUTE, false);
  let soundStyle = load(STORAGE_KEYS.SOUND, 'arcade');

  // ---------- UI References ----------
  const balanceEl = $('#balance');
  const messageEl = $('#message');
  const reelsEls = $$('.reel');
  const spinBtn = $('#spinBtn');
  const autoSpinEl = $('#autoSpin');
  const depositAmountEl = $('#depositAmount');
  const depositBtn = $('#depositBtn');
  const resetBalanceBtn = $('#resetBalanceBtn');
  const betSelect = $('#betSelect');
  const muteBtn = $('#muteBtn');
  const payoutTable = $('#payoutTable');
  
  const soundSelect = $('#soundSelect');const symbolList = $('#symbolList');

  // Symbol Manager form
  const addSymbolForm = $('#addSymbolForm');
  const symNameEl = $('#symName');
  const symWeightEl = $('#symWeight');
  const symPay3El = $('#symPay3');
  const symPay2El = $('#symPay2');
  const symWildEl = $('#symWild');
  const symImageEl = $('#symImage');
  const resetSymbolsBtn = $('#resetSymbolsBtn');

  // ---------- Balance & Bet Initialization ----------
  let balance = load(STORAGE_KEYS.BALANCE, 1000);
  let bet = parseInt(load(STORAGE_KEYS.BET, 10), 10);
  balanceEl.textContent = balance;
  betSelect.value = String(bet);

  // ---------- Background Particles ----------
  function spawnParticles(){
    const bg = document.getElementById('bg');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const countStars = Math.min(60, Math.ceil(width/20));
    const countFrogs = Math.min(24, Math.ceil(width/40));
    function make(type, char, baseDur){
      const el = document.createElement('div');
      el.className = `particle ${type}`;
      el.textContent = char;
      const x = Math.random()*width;
      const y = height + Math.random()*height*0.75;
      const dur = baseDur + Math.random()*baseDur;
      const delay = -Math.random()*dur;
      const drift = (Math.random() * 120 - 60).toFixed(1) + 'px';
      el.style.left = x+'px';
      el.style.top = y+'px';
      el.style.animationDuration = dur.toFixed(1)+'s';
      el.style.animationDelay = delay.toFixed(2)+'s';
      el.style.setProperty('--drift', drift);
      bg.appendChild(el);
    }
    for(let i=0;i<countStars;i++) make('star','⭐', 18);
    for(let i=0;i<countFrogs;i++) make('frog','🐸', 24);
    // Periodically respawn a few
    setInterval(()=>{
      for(let i=0;i<3;i++) make('star','⭐', 18);
      if(Math.random()<0.5) make('frog','🐸', 24);
    }, 3000);
  }
  spawnParticles();

  // ---------- Sound Engine (WebAudio) ----------
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  function ensureAudio(){
    if(!ctx) ctx = new AudioCtx();
    if(ctx.state === 'suspended') ctx.resume();
  }

  function beep(freq=440, dur=0.08, type='sine', gain=0.03){
    if(mute) return;
    ensureAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  function coinJingle(){
    if(mute) return;
    ensureAudio();
    const now = ctx.currentTime;
    [880, 1320, 1760].forEach((f, i)=>{
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + i*0.06);
      g.gain.setValueAtTime(0.0001, now + i*0.06);
      g.gain.exponentialRampToValueAtTime(0.06, now + i*0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i*0.06 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(now + i*0.06);
      o.stop(now + i*0.06 + 0.3);
    });
  }

  
function spinSoundStart(){
  if(mute) return;
  ensureAudio();
  if(soundStyle==='edm'){
    let ticks=0;
    const iv=setInterval(()=>{
      if(ticks++>18) return clearInterval(iv);
      beep(4000,0.02,'square',0.015);
    },70);
  }else if(soundStyle==='retro'){
    let ticks=0;
    const iv=setInterval(()=>{
      if(ticks++>18) return clearInterval(iv);
      beep(280+Math.random()*80,0.05,'square',0.02);
    },70);
  }else{
    let ticks=0;
    const iv=setInterval(()=>{
      if(ticks++>18) return clearInterval(iv);
      beep(200+Math.random()*60,0.04,'square',0.02);
    },70);
  }
}

  
function reelStopTick(){
  if(mute) return;
  if(soundStyle==='edm') beep(180,0.03,'sine',0.04);
  else if(soundStyle==='retro') beep(500,0.05,'square',0.025);
  else beep(300,0.06,'square',0.025);
}

  
function winSound(){
  if(mute) return;
  ensureAudio();
  const now = ctx.currentTime;
  if(soundStyle==='edm'){
    const chords=[440,554.37,659.25,880];
    chords.forEach((f,i)=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sawtooth';
      o.frequency.setValueAtTime(f, now+i*0.1);
      g.gain.setValueAtTime(0.0001, now+i*0.1);
      g.gain.exponentialRampToValueAtTime(0.08, now+i*0.1+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now+i*0.1+0.25);
      o.connect(g).connect(ctx.destination);
      o.start(now+i*0.1); o.stop(now+i*0.1+0.28);
    });
  }else if(soundStyle==='retro'){
    [523.25,659.25,784].forEach((f)=> beep(f,0.12,'square',0.05));
  }else{
    const seq=[523.25,659.25,783.99,1046.5];
    seq.forEach((f,i)=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sawtooth';
      o.frequency.setValueAtTime(f, now+i*0.12);
      g.gain.setValueAtTime(0.0001, now+i*0.12);
      g.gain.exponentialRampToValueAtTime(0.05, now+i*0.12+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now+i*0.12+0.25);
      o.connect(g).connect(ctx.destination);
      o.start(now+i*0.12); o.stop(now+i*0.12+0.3);
    });
  }
}


  // ---------- Symbol Utilities ----------
  function saveSymbols(){ save(STORAGE_KEYS.SYMBOLS, symbols); }
  function buildPool(){
    const pool = [];
    symbols.forEach(sym => {
      for(let i=0;i<sym.weight;i++) pool.push(sym.id);
    });
    return pool;
  }
  let pool = buildPool();

  function getSymbolById(id){ return symbols.find(s => s.id === id); }
  function randomSymbol(){
    const id = pool[Math.floor(Math.random()*pool.length)];
    return getSymbolById(id);
  }

  function renderSymbol(container, sym){
    container.innerHTML = '';
    if(sym.type === 'image' && sym.dataUrl){
      const img = document.createElement('img');
      img.alt = sym.name;
      img.src = sym.dataUrl;
      if(sym.id==='skull'){ img.className = 'bca'; }
      container.appendChild(img);
    }else{
      const span = document.createElement('span');
      span.className = 'emoji';
      span.textContent = sym.display || '❔';
      container.appendChild(span);
    }
  }

  // ---------- Payout Table ----------
  
function refreshPayoutTable(){
    payoutTable.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'row header';
    header.innerHTML = `<div>Symbol</div><div>3 in a row</div><div>2 in a row</div><div>Type</div>`;
    payoutTable.appendChild(header);

    const order = ['cherry','lemon','grape','bell','star','frog','wild','skull'];
    const typeOf = id => (
      (id==='cherry' || id==='lemon' || id==='grape') ? 'Common' :
      (id==='bell' || id==='star') ? 'Epic' :
      (id==='frog') ? 'Legend!' :
      '—'
    );

    order.forEach(id => {
      const sym = symbols.find(s => s.id === id);
      if(!sym) return;

      const row = document.createElement('div');
      row.className = 'row';

      const symCell = document.createElement('div');
      symCell.className = 'sym';
      if(sym.type === 'image'){
        const img = document.createElement('img');
        img.src = sym.dataUrl;
        if(sym.id==='skull'){ img.className = 'bca'; }
        symCell.appendChild(img);
      }else{
        const sp = document.createElement('span');
        sp.className = 'emoji'; sp.textContent = sym.display;
        symCell.appendChild(sp);
      }
      const nm = document.createElement('span');
      nm.textContent = sym.name;
      symCell.appendChild(nm);

      const c3 = document.createElement('div'); c3.textContent = `${sym.payout3}×`;
      const c2 = document.createElement('div'); c2.textContent = `${sym.payout2}×`;
      const cT = document.createElement('div');
      cT.innerHTML = sym.isWild ? `<span class="badge">WILD</span>` : typeOf(sym.id);

      row.appendChild(symCell); row.appendChild(c3); row.appendChild(c2); row.appendChild(cT);
      payoutTable.appendChild(row);
    });
  }


  // ---------- Symbol Manager UI ----------
  function refreshSymbolList(){
    symbolList.innerHTML = '';
    symbols.forEach(sym => {
      const item = document.createElement('div');
      item.className = 'symbol-item';
      const left = document.createElement('div');
      left.className = 'left';
      if(sym.type === 'image'){
        const img = document.createElement('img'); img.src = sym.dataUrl;
      if(sym.id==='skull'){ img.className = 'bca'; } left.appendChild(img);
      }else{ const sp = document.createElement('span'); sp.className='emoji'; sp.textContent = sym.display; left.appendChild(sp); }
      const name = document.createElement('strong'); name.textContent = sym.name; left.appendChild(name);
      const meta = document.createElement('span'); meta.style.color='var(--muted)'; meta.textContent = `w:${sym.weight} • 3×${sym.payout3} • 2×${sym.payout2}`;
      left.appendChild(meta);

      const right = document.createElement('div');
      if(sym.isWild){ const badge = document.createElement('span'); badge.className='badge'; badge.textContent='WILD'; right.appendChild(badge); }
      const del = document.createElement('button'); del.className='btn ghost'; del.textContent='Delete';
      del.addEventListener('click', ()=>{
        symbols = symbols.filter(s => s.id !== sym.id);
        saveSymbols(); pool = buildPool(); refreshPayoutTable(); if(symbolList) refreshSymbolList();
      });
      right.appendChild(del);

      item.appendChild(left); item.appendChild(right);
      symbolList.appendChild(item);
    });
  }

  if(addSymbolForm) addSymbolForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = symNameEl.value.trim();
    const weight = Math.max(1, parseInt(symWeightEl.value,10)||1);
    const payout3 = Math.max(1, parseInt(symPay3El.value,10)||1);
    const payout2 = Math.max(0, parseInt(symPay2El.value,10)||0);
    const isWild = !!symWildEl.checked;
    const file = symImageEl.files[0];
    if(!file){ alert('Please choose an image.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,18)}_${Date.now().toString(36)}`;
      const sym = { id, name, type:'image', dataUrl, weight, payout3, payout2, isWild };
      symbols.push(sym);
      saveSymbols(); pool = buildPool();
      addSymbolForm.reset();
      refreshPayoutTable(); if(symbolList) refreshSymbolList();
      toast(`Added symbol: ${name}`);
    };
    reader.readAsDataURL(file);
  });

  if(resetSymbolsBtn) resetSymbolsBtn.addEventListener('click', ()=>{
    if(!confirm('Reset symbols to defaults? This removes your custom symbols.')) return;
    symbols = DEFAULT_SYMBOLS.map(s => ({...s}));
    saveSymbols(); pool = buildPool(); refreshPayoutTable(); if(symbolList) refreshSymbolList();
  });

  // ---------- Toast helper ----------
  function toast(text){
    messageEl.textContent = text;
    messageEl.style.color = 'var(--muted)';
  }

  // ---------- Reels Logic ----------
  const reels = reelsEls.map((reelEl, idx) => {
    return {
      el: reelEl,
      top: reelEl.querySelector('.cell.top'),
      center: reelEl.querySelector('.cell.center'),
      bottom: reelEl.querySelector('.cell.bottom'),
      timer: null,
      idx
    };
  });

  // Initialize with random symbols displayed
  reels.forEach(r => {
    renderSymbol(r.top, randomSymbol());
    renderSymbol(r.center, randomSymbol());
    renderSymbol(r.bottom, randomSymbol());
  });

  let spinning = false;

  function updateBalance(delta){
    balance += delta;
    if(balance < 0) balance = 0;
    save(STORAGE_KEYS.BALANCE, balance);
    balanceEl.textContent = balance;
  }

  function setBet(value){
    bet = Math.max(1, parseInt(value,10)||1);
    save(STORAGE_KEYS.BET, bet);
  }

  betSelect.addEventListener('change', (e)=> setBet(e.target.value));

  depositBtn.addEventListener('click', ()=>{
    const amt = Math.max(0, parseInt(depositAmountEl.value,10)||0);
    if(amt>0){
      updateBalance(amt);
      depositAmountEl.value = '';
      coinJingle();
      toast(`Deposited ${amt} credits`);
    }
  });
  resetBalanceBtn.addEventListener('click', ()=>{
    updateBalance(-balance);
    toast('Balance reset to 0');
  });

  muteBtn.addEventListener('click', ()=>{
    mute = !mute;
    save(STORAGE_KEYS.MUTE, mute);
    
  if(soundSelect){
    soundSelect.value = soundStyle;
    soundSelect.addEventListener('change', (e)=>{
      soundStyle = e.target.value;
      save(STORAGE_KEYS.SOUND, soundStyle);
      toast('Sound: ' + soundSelect.options[soundSelect.selectedIndex].text);
    });
  }
muteBtn.textContent = mute ? '🔇' : '🔊';
  });
  muteBtn.textContent = mute ? '🔇' : '🔊';

  // Compute payout with wild substitution
  function computeWin(centerSymbols){
    // Skull penalty (wilds do not count toward Skull)
    const skullCount = centerSymbols.filter(s => s.id === 'skull').length;
    if(skullCount >= 3){
      return { amount: -20 * bet, details: 'Skull penalty (3×)' };
    }
    if(skullCount === 2){
      return { amount: -15 * bet, details: 'Skull penalty (2×)' };
    }
    // centerSymbols: array of 3 symbol objects
    const wilds = centerSymbols.filter(s => s.isWild).length;
    const nonWilds = centerSymbols.filter(s => !s.isWild);
    // Count by id
    const counts = new Map();
    nonWilds.forEach(s => counts.set(s.id, (counts.get(s.id)||0)+1));

    // Check best 3-of-a-kind candidate
    let best = { amount:0, details:'' };

    // Consider each non-wild symbol as target
    for(const [id,count] of counts.entries()){
      const sym = getSymbolById(id);
      if(count + wilds >= 3){
        const amt = sym.payout3 * bet;
        if(amt > best.amount) best = { amount: amt, details: `3‑of‑a‑kind ${sym.name}` };
      }
    }
    // Case: all wilds (or using wilds to form 3)
    if(wilds === 3){
      const wildSym = symbols.find(s => s.isWild);
      if(wildSym){
        const amt = wildSym.payout3 * bet;
        if(amt > best.amount) best = { amount: amt, details: '3 WILDs' };
      }
    } else if(wilds > 0 && nonWilds.length > 0){
      // Could still be 3-of-kind via wilds for the most valuable nonwild present
      const candidates = nonWilds.map(s => s);
      candidates.forEach(s => {
        const cnt = counts.get(s.id)||0;
        if(cnt + wilds >= 3){
          const amt = s.payout3 * bet;
          if(amt > best.amount) best = { amount: amt, details: `3‑of‑a‑kind ${s.name} (with WILD)` };
        }
      });
    }

    if(best.amount > 0){
      return best.idx ? best : {...best, idx: []};
    }

    // Otherwise check best 2-of-a-kind
    for(const [id,count] of counts.entries()){
      const sym = getSymbolById(id);
      if(count + wilds >= 2){
        const amt = sym.payout2 * bet;
        if(amt > best.amount) best = { amount: amt, details: `2‑of‑a‑kind ${sym.name}` };
      }
    }
    // Case: 2 wilds
    if(wilds >= 2){
      const wildSym = symbols.find(s => s.isWild);
      if(wildSym){
        const amt = wildSym.payout2 * bet;
        if(amt > best.amount) best = { amount: amt, details: '2 WILDs' };
      }
    }

    return best.idx ? best : {...best, idx: []};
  }

  function setReelCells(r, topSym, centerSym, bottomSym){
    renderSymbol(r.top, topSym);
    renderSymbol(r.center, centerSym);
    renderSymbol(r.bottom, bottomSym);
  }

  function spinOnce(){
    if(spinning) return;
    if(balance < bet){
      toast('Insufficient balance — deposit more to play.');
      return;
    }
    spinning = true;
    spinBtn.disabled = true;
    depositBtn.disabled = true;
    betSelect.disabled = true;
    reelsEls.forEach(el => el.classList.remove('win'));

    updateBalance(-bet);
    spinSoundStart();

    // Decide final center results ahead of time
    const finalCenters = [randomSymbol(), randomSymbol(), randomSymbol()];
    // Top & bottom just for visuals
    const finals = finalCenters.map(fc => ({
      top: randomSymbol(), center: fc, bottom: randomSymbol()
    }));

    // Start fast cycling per reel
    reels.forEach(r => {
      r.el.classList.add('spinning');
      if(r.timer) clearInterval(r.timer);
      r.timer = setInterval(()=>{
        // Random flicker of symbols while spinning
        setReelCells(r, randomSymbol(), randomSymbol(), randomSymbol());
      }, 60);
    });

    // Stop reels sequentially
    const stopDelays = [900, 1500, 2100];
    let stopped = 0;
    reels.forEach((r, i) => {
      setTimeout(()=>{
        clearInterval(r.timer);
        const f = finals[i];
        setReelCells(r, f.top, f.center, f.bottom);
        r.el.classList.remove('spinning');
        reelStopTick();
        if(++stopped === 3){
          // All stopped: compute payout
          const result = finalCenters;
          const win = computeWin(result);
          if(win.amount > 0){
            updateBalance(win.amount);
            winSound();
            reelsEls.forEach((el,i) => el.classList.toggle('win', Array.isArray(win.idx) && win.idx.includes(i)));
            messageEl.style.color = 'var(--win)';
            messageEl.textContent = `WIN: +${win.amount} ( ${win.details} )`;
          }else if(win.amount < 0){
            updateBalance(win.amount);
            reelsEls.forEach(el=>el.classList.remove('win'));
            messageEl.style.color = 'var(--danger)';
            messageEl.textContent = `LOSS: ${win.amount} ( ${win.details} )`;
          }else{
            messageEl.style.color = 'var(--muted)';
            messageEl.textContent = 'No win — try again!';
          }

          // Done: re-enable
          spinning = false;
          spinBtn.disabled = false;
          depositBtn.disabled = false;
          betSelect.disabled = false;

          // Continue auto-spin if enabled
          if(autoSpinEl.checked){
            if(balance >= bet){
              setTimeout(spinOnce, 600);
            }else{
              autoSpinEl.checked = false;
              toast('Auto‑spin stopped (balance too low).');
            }
          }
        }
      }, stopDelays[i]);
    });
  }

  spinBtn.addEventListener('click', spinOnce);
  autoSpinEl.addEventListener('change', ()=>{
    if(autoSpinEl.checked && !spinning) spinOnce();
  });

  // ---------- Initial Render ----------
  refreshPayoutTable();
  if(symbolList) refreshSymbolList();
})();