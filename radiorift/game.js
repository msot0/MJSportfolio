// ============================================================
//  RADIO RIFT — Full Game
//  Clean rewrite: working mouse clicks, centered, bg music
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W      = canvas.width;   // 800
const H      = canvas.height;  // 500

// ══════════════════════════════════════════════════════════════
//  STATE — declared first
// ══════════════════════════════════════════════════════════════
let gameState     = 'intro';
let prevState     = 'home';
let levelIndex    = 0;
let battleIndex   = 0;
let tokens        = [];
let frame         = 0;
let lastBeatFrame = 0;
let knockoutTimer = 0;
let levelIntroAge = 0;
let transitionAge = 0;
let transitionMsg = '';
let introPanel    = 0;
let introPanelAge = 0;
let libScrollY    = 0;  // library scroll offset

// ══════════════════════════════════════════════════════════════
//  INPUT — simple and reliable
// ══════════════════════════════════════════════════════════════
let keys      = {};
let mouseX    = 0;
let mouseY    = 0;
let clickX    = -999;
let clickY    = -999;
let hadClick  = false;

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
  if (e.key === 'Escape' && gameState === 'library') gameState = prevState;
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouseX = (e.clientX - r.left) * (W / r.width);
  mouseY = (e.clientY - r.top)  * (H / r.height);
});

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  clickX   = (e.clientX - r.left) * (W / r.width);
  clickY   = (e.clientY - r.top)  * (H / r.height);
  hadClick = true;
  unlockAudio();
});

canvas.addEventListener('wheel', e => {
  if (gameState === 'library') {
    libScrollY = Math.max(0, libScrollY + e.deltaY * 0.4);
    e.preventDefault();
  }
}, { passive: false });

// Did the mouse click land in this box this frame?
function wasClicked(x, y, w, h) {
  return hadClick && clickX > x && clickX < x+w && clickY > y && clickY < y+h;
}
// Is mouse hovering this box?
function isHovered(x, y, w, h) {
  return mouseX > x && mouseX < x+w && mouseY > y && mouseY < y+h;
}
// Was space pressed? (consumes it)
function spacePressed() {
  if (keys[' ']) { keys[' '] = false; return true; }
  return false;
}
// Button helper — click OR space
function btnActivated(x, y, w, h) {
  return wasClicked(x, y, w, h) || spacePressed();
}

// ══════════════════════════════════════════════════════════════
//  AUDIO
// ══════════════════════════════════════════════════════════════
let audioCtx    = null;
let bgTimer     = null;
let bgOn        = false;
let bgBar       = 0;

let nowPlaying  = null;

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function unlockAudio() { getAudio(); }

function tone(freq, type, dur, vol=0.15, delay=0) {
  try {
    const ac   = getAudio();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
    gain.gain.setValueAtTime(vol, ac.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + dur);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + dur + 0.01);
  } catch(e) {}
}

function sfxShoot() {
  if (levelIndex===0) { tone(440,'triangle',0.14,0.12); tone(554,'triangle',0.09,0.07,0.06); }
  else if (levelIndex===1) { tone(880,'sawtooth',0.07,0.14); tone(220,'sine',0.06,0.09,0.04); }
  else { tone(110,'sawtooth',0.16,0.18); tone(165,'square',0.08,0.09,0.05); }
}
function sfxDeflect()   { tone(900,'sine',0.09,0.22); tone(1300,'sine',0.07,0.16,0.06); }
function sfxHit()       { tone(200,'square',0.10,0.14); }
function sfxPlayerHit() { tone(140,'square',0.20,0.20); }
function sfxDeath()     { [440,330,220,110].forEach((f,i)=>tone(f,'sawtooth',0.20,0.14,i*0.13)); }
function sfxWin()       { [523,659,784,1047].forEach((f,i)=>tone(f,'triangle',0.26,0.18,i*0.10)); }
function sfxBeat()      { tone(52,'sine',0.05,0.025); }

const bgTracks = [
  { bpm:68,  chords:[[196,247,294],[261,330,392],[293,370,440],[196,247,294]], bass:[98,130,146,98],  type:'triangle' },
  { bpm:100, chords:[[130,155,195],[116,138,174],[155,184,220],[116,138,174]], bass:[65,58,77,58],    type:'sawtooth' },
  { bpm:82,  chords:[[110,165,220],[98,147,196],[123,185,246],[98,147,196]],   bass:[55,49,61,49],    type:'square'   },
];

function startBG() {
  if (bgOn) return;
  bgOn = true; bgBar = 0;
  scheduleBG();
}
function stopBG() {
  bgOn = false;
  if (bgTimer) { clearTimeout(bgTimer); bgTimer = null; }
}
function scheduleBG() {
  if (!bgOn) return;
  const t       = bgTracks[Math.min(levelIndex,2)];
  const chord   = t.chords[bgBar % t.chords.length];
  const bassN   = t.bass[bgBar % t.bass.length];
  const beatSec = 60 / t.bpm;
  const barSec  = beatSec * 4;
  chord.forEach((f,i) => tone(f, t.type, barSec*0.8, 0.04, i*0.02));
  tone(bassN, 'sine', beatSec*0.65, 0.06);
  tone(58,'sine',0.14,0.05); tone(58,'sine',0.14,0.05,beatSec*2);
  if (levelIndex===2) { tone(185,'square',0.07,0.02,beatSec); tone(185,'square',0.07,0.02,beatSec*3); }
  if (levelIndex===1) { [0,1,2,3].forEach(b=>tone(3800,'square',0.035,0.01,beatSec*b)); }
  if (levelIndex===0) { chord.forEach((f,i)=>tone(f,'triangle',0.10,0.022,beatSec+i*0.015)); }
  bgBar++;
  bgTimer = setTimeout(()=>{ if(bgOn) scheduleBG(); }, barSec*1000);
}

// ── Upbeat intro / home screen music ─────────────────────────
let introMusicOn    = false;
let introMusicTimer = null;
let introMusicBar   = 0;

const introTrack = {
  bpm: 118,
  arps: [
    [523,659,784,1047,784,659],
    [587,740,880,587,740,880],
    [440,554,659,880,659,554],
    [523,659,784,1047,784,523],
  ],
  bass: [130,147,110,130],
};

function startIntroMusic() {
  if (introMusicOn) return;
  introMusicOn  = true;
  introMusicBar = 0;
  scheduleIntroBar();
}
function stopIntroMusic() {
  introMusicOn = false;
  if (introMusicTimer) { clearTimeout(introMusicTimer); introMusicTimer=null; }
}
function scheduleIntroBar() {
  if (!introMusicOn) return;
  const beatSec = 60 / introTrack.bpm;
  const barSec  = beatSec * 6;
  const arp     = introTrack.arps[introMusicBar % introTrack.arps.length];
  const bassN   = introTrack.bass[introMusicBar % introTrack.bass.length];
  arp.forEach((f,i) => tone(f,'triangle', beatSec*0.4, 0.05, i*beatSec));
  tone(bassN,'sine', beatSec*1.6, 0.065);
  tone(70,'sine',0.10,0.04,0);
  tone(70,'sine',0.08,0.03,beatSec*3);
  [0,1,2,3,4,5].forEach(b=>tone(4800,'square',0.025,0.007,beatSec*b));
  introMusicBar++;
  introMusicTimer = setTimeout(()=>{ if(introMusicOn) scheduleIntroBar(); }, barSec*1000);
}

// ── Music preview playback via iTunes Search API ──────────────
// iTunes allows direct browser requests with no CORS proxy.
// 
// KEY TRICK: pre-fetch the preview URL when the battle STARTS
// (enemy spawns). By the time the player wins, the URL is ready.
// Then audio.play() fires synchronously inside the kill shot's
// keydown/click handler — browser allows it no problem.

let _sndEl        = null;
let _prefetchedUrl = null;   // URL fetched during battle, ready for win
let _prefetchEntry = null;   // the song entry being pre-fetched
let _deezerTimer  = null;

async function itunesSearch(query) {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=5`;
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const data = await r.json();
    return (data.results || []).find(t => t.previewUrl) || null;
  } catch(e) { return null; }
}

function _getAudioEl() {
  if (!_sndEl) { _sndEl = new Audio(); _sndEl.volume = 0.7; }
  return _sndEl;
}

// Pre-fetch the upcoming battle reward song while the battle runs.
// Call this at battle start — gives ~30+ seconds for the fetch to complete.
function prefetchNextSong() {
  const song = getSong(levelIndex, battleIndex);
  _prefetchedUrl  = null;
  _prefetchEntry  = {...song, levelIndex};
  itunesSearch(song.query).then(tr => {
    if (tr && _prefetchEntry && _prefetchEntry.query === song.query) {
      _prefetchedUrl = tr.previewUrl;
      _prefetchEntry.previewUrl = tr.previewUrl;
    }
  });
}

// Called synchronously from inside the kill-shot event chain.
// If prefetch finished: plays immediately, no popup needed.
// If prefetch still in progress: shows small top-bar notification to tap.
function awardAndPlaySong(l, b) {
  const song  = getSong(l, b);
  nextPool(l, b);
  const entry = _prefetchEntry && _prefetchEntry.query === song.query
    ? _prefetchEntry
    : {...song, levelIndex: l};
  entry.levelIndex = l;
  if (!earnedSongs.includes(entry)) earnedSongs.push(entry);
  songNotif = {song: entry, timer: 320};
  sfxWin();

  if (_prefetchedUrl) {
    // URL ready — play right now (still synchronous in gesture chain)
    _playNow(_prefetchedUrl, entry);
    _prefetchedUrl = null;
  } else {
    // Still fetching — show small top-bar tap hint, not a modal
    entry._pendingPlay = true;
    // When fetch eventually completes, store URL and show tap hint
    if (_prefetchEntry) {
      const checkInterval = setInterval(() => {
        if (_prefetchedUrl) {
          clearInterval(checkInterval);
          entry.previewUrl = _prefetchedUrl;
          entry._pendingPlay = false;
          _prefetchedUrl = null;
          // Can't play here (not in gesture) — show small hint bar
          _tapHint = { entry, timer: 500 };
        }
      }, 200);
      // Give up after 15s
      setTimeout(() => clearInterval(checkInterval), 15000);
    }
  }
}

// Small top-bar hint — NOT a modal, stays at top of screen
let _tapHint = null;  // { entry, timer }

// Play synchronously — must be in click/keydown call chain
function _playNow(previewUrl, entry) {
  _stopPreview();
  stopBG(); stopIntroMusic();
  const el = _getAudioEl();
  el.src = previewUrl;
  el.currentTime = 0;
  el.onended = () => { nowPlaying = null; restartBGAfterSong(); };
  el.play().catch(err => {
    // Still blocked? Show top-bar hint
    _tapHint = { entry, timer: 500 };
  });
  nowPlaying = { song: entry };
  clearTimeout(_deezerTimer);
  _deezerTimer = setTimeout(() => { _stopPreview(); restartBGAfterSong(); }, 33000);
}

function _stopPreview() {
  clearTimeout(_deezerTimer); _deezerTimer = null;
  if (_sndEl) { _sndEl.pause(); _sndEl.onended = null; }
  nowPlaying = null;
}

function stopDeezer() { _stopPreview(); _tapHint = null; }

// Library ▶ button — inside click handler, play cached URL or fetch+hint
function playLibrarySong(entry) {
  if (entry.previewUrl) {
    _playNow(entry.previewUrl, entry);
  } else {
    entry._loading = true;
    itunesSearch(entry.query).then(tr => {
      entry._loading = false;
      if (!tr) return;
      entry.previewUrl = tr.previewUrl;
      _tapHint = { entry, previewUrl: tr.previewUrl, timer: 600 };
    });
  }
}

function restartBGAfterSong() {
  if (gameState==='playing'||gameState==='transition'||gameState==='levelIntro') startBG();
  else if (gameState==='intro'||gameState==='home') startIntroMusic();
}

// Draw the small top-bar tap hint (replaces the big modal popup)
function drawTapHint() {
  if (!_tapHint) return;
  _tapHint.timer--;
  if (_tapHint.timer <= 0) { _tapHint = null; return; }

  const entry = _tapHint.entry;
  const lvl   = levels[entry.levelIndex] || levels[0];
  const alpha = _tapHint.timer < 50 ? _tapHint.timer/50 : 1;
  const bx = W/2-160, by = 8, bw = 320, bh = 32;
  const hot = isHovered(bx, by, bw, bh);

  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = hot ? lvl.accent : 'rgba(0,0,0,0.85)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
  ctx.strokeStyle = lvl.accent; ctx.lineWidth = 1.5;
  if (hot) { ctx.shadowColor = lvl.accent; ctx.shadowBlur = 8; }
  ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = hot ? '#000' : '#fff';
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  const label = entry.previewUrl
    ? `♪ tap to play: ${entry.title.slice(0,26)}`
    : `♪ loading: ${entry.title.slice(0,26)}...`;
  ctx.fillText(label, W/2, by+21);
  ctx.restore(); ctx.textAlign = 'left';

  if (wasClicked(bx, by, bw, bh) && entry.previewUrl) {
    const url = entry.previewUrl;
    _tapHint = null;
    _playNow(url, entry);
  }
}

// ══════════════════════════════════════════════════════════════
//  SONG DATA
// ══════════════════════════════════════════════════════════════
const songPools = [
  [
    [{artist:'Woody Guthrie',   title:'This Land Is Your Land', query:'Woody Guthrie This Land Is Your Land', year:'1940'},
     {artist:'Woody Guthrie',   title:'Dust Bowl Refugee',       query:'Woody Guthrie Dust Bowl Refugee',       year:'1940'}],
    [{artist:'Hank Williams',   title:"Your Cheatin' Heart",    query:'Hank Williams Your Cheatin Heart',      year:'1952'},
     {artist:'Hank Williams',   title:'Hey Good Lookin',         query:'Hank Williams Hey Good Lookin',         year:'1951'}],
    [{artist:'Waylon Jennings', title:"Mammas Don't Let Your Babies", query:'Waylon Jennings Mammas Dont Let Your Babies', year:'1978'},
     {artist:'Waylon Jennings', title:'Good Hearted Woman',     query:'Waylon Jennings Good Hearted Woman',    year:'1972'}],
  ],
  [
    [{artist:'Avicii',      title:'Wake Me Up',        query:'Avicii Wake Me Up',             year:'2013'},
     {artist:'Avicii',      title:'Levels',            query:'Avicii Levels',                 year:'2011'}],
    [{artist:'Fatboy Slim', title:'Praise You',        query:'Fatboy Slim Praise You',        year:'1998'},
     {artist:'Fatboy Slim', title:'Rockafeller Skank', query:'Fatboy Slim Rockafeller Skank', year:'1998'}],
    [{artist:'Daft Punk',   title:'Da Funk',           query:'Daft Punk Da Funk',             year:'1995'},
     {artist:'Daft Punk',   title:'Instant Crush',     query:'Daft Punk Instant Crush',       year:'2013'},
     {artist:'Daft Punk',   title:'Veridis Quo',       query:'Daft Punk Veridis Quo',         year:'2001'}],
  ],
  [
    [{artist:'Led Zeppelin', title:'Whole Lotta Love', query:'Led Zeppelin Whole Lotta Love', year:'1969'},
     {artist:'Led Zeppelin', title:'Kashmir',          query:'Led Zeppelin Kashmir',          year:'1975'}],
    [{artist:'Pearl Jam',    title:'Even Flow',        query:'Pearl Jam Even Flow',           year:'1991'},
     {artist:'Pearl Jam',    title:'Black',            query:'Pearl Jam Black',               year:'1991'},
     {artist:'Pearl Jam',    title:'Alive',            query:'Pearl Jam Alive',               year:'1991'}],
    [{artist:'Jimi Hendrix', title:'Purple Haze',      query:'Jimi Hendrix Purple Haze',      year:'1967'},
     {artist:'Jimi Hendrix', title:'All Along The Watchtower', query:'Jimi Hendrix All Along The Watchtower', year:'1968'}],
  ],
];

let poolIdx   = [[0,0,0],[0,0,0],[0,0,0]];
let earnedSongs = [];
let songNotif   = null;

// ── Bonus bubble song pools (separate from earned artist songs) ──
const bubblePools = [
  // Country Circuits bonus
  [{artist:'Johnny Cash',   title:'Ring of Fire',          query:'Johnny Cash Ring of Fire',           year:'1963'},
   {artist:'Johnny Cash',   title:'Folsom Prison Blues',   query:'Johnny Cash Folsom Prison Blues',     year:'1955'},
   {artist:'Dolly Parton',  title:'Jolene',                query:'Dolly Parton Jolene',                 year:'1973'},
   {artist:'Dolly Parton',  title:'9 to 5',                query:'Dolly Parton 9 to 5',                 year:'1980'},
   {artist:'Willie Nelson', title:'On The Road Again',     query:'Willie Nelson On The Road Again',     year:'1980'},
   {artist:'Willie Nelson', title:'Always On My Mind',     query:'Willie Nelson Always On My Mind',     year:'1982'}],
  // Neon Nexus bonus
  [{artist:'The Chemical Brothers', title:'Block Rockin Beats',   query:'Chemical Brothers Block Rockin Beats',   year:'1997'},
   {artist:'The Chemical Brothers', title:'Galvanize',            query:'Chemical Brothers Galvanize',            year:'2005'},
   {artist:'Underworld',            title:'Born Slippy',          query:'Underworld Born Slippy',                 year:'1995'},
   {artist:'Underworld',            title:'Two Months Off',       query:'Underworld Two Months Off',              year:'2002'},
   {artist:'The Prodigy',           title:'Firestarter',          query:'Prodigy Firestarter',                    year:'1996'},
   {artist:'The Prodigy',           title:'Breathe',              query:'Prodigy Breathe',                        year:'1996'}],
  // Rock Ravine bonus
  [{artist:'Black Sabbath',           title:'Iron Man',           query:'Black Sabbath Iron Man',                 year:'1970'},
   {artist:'Black Sabbath',           title:'Paranoid',           query:'Black Sabbath Paranoid',                 year:'1970'},
   {artist:'The Clash',               title:'Should I Stay',      query:'The Clash Should I Stay or Should I Go', year:'1982'},
   {artist:'The Clash',               title:'London Calling',     query:'The Clash London Calling',               year:'1979'},
   {artist:'Rage Against the Machine','title':'Killing In The Name',query:'Rage Against the Machine Killing In The Name',year:'1992'},
   {artist:'Rage Against the Machine','title':'Bulls On Parade',  query:'Rage Against the Machine Bulls On Parade',year:'1996'}],
];
let bubblePoolIdx = [0,0,0];
function getBubbleSong(lvl) {
  const pool = bubblePools[lvl];
  // Build set of already-earned queries to avoid repeats
  const earned = new Set(earnedSongs.map(s=>s.query));
  // Find next song not already earned
  let attempts = 0;
  while (attempts < pool.length) {
    const song = pool[bubblePoolIdx[lvl] % pool.length];
    bubblePoolIdx[lvl] = (bubblePoolIdx[lvl]+1) % pool.length;
    if (!earned.has(song.query)) return song;
    attempts++;
  }
  // All songs earned — just return the next one anyway (full library!)
  const song = pool[bubblePoolIdx[lvl] % pool.length];
  bubblePoolIdx[lvl] = (bubblePoolIdx[lvl]+1) % pool.length;
  return song;
}
function shuffleBubblePools() {
  bubblePoolIdx = [0,1,2].map(i=>Math.floor(Math.random()*bubblePools[i].length));
}

// ── Active music bubbles floating on screen ──
let musicBubbles = [];

function getSong(l,b)    { return songPools[l][b][poolIdx[l][b]]; }
function nextPool(l,b)   { poolIdx[l][b] = (poolIdx[l][b]+1) % songPools[l][b].length; }
function shufflePools()  {
  songPools.forEach((_,li)=>[0,1,2].forEach(bi=>{
    poolIdx[li][bi] = Math.floor(Math.random()*songPools[li][bi].length);
  }));
}
function awardSong(l,b) {
  awardAndPlaySong(l, b);
}

// ══════════════════════════════════════════════════════════════
//  LEVEL DATA
// ══════════════════════════════════════════════════════════════
const levels = [
  {name:'Country Circuits', bpm:90,
   skyTop:'#e8883a', skyBot:'#f5c97a', floorTop:'#8b5e2e', floorBot:'#5a3510',
   accent:'#f0a030', lineColor:'#a0724a', tokenIcon:'🪙',
   albumColors:['#8b5e2e','#f0a030','#e8883a'],
   intro:"The radio crackles with twang and dust.\nWelcome to COUNTRY CIRCUITS."},
  {name:'Neon Nexus', bpm:128,
   skyTop:'#0a0020', skyBot:'#26124b', floorTop:'#1a0840', floorBot:'#0d0420',
   accent:'#c800ff', lineColor:'#8a2be2', tokenIcon:'🎧',
   albumColors:['#26124b','#c800ff','#00ffff'],
   intro:"Bass drops into the void.\nWelcome to NEON NEXUS."},
  {name:'Rock Ravine', bpm:140,
   skyTop:'#0d0000', skyBot:'#3a0000', floorTop:'#2b0000', floorBot:'#1a0000',
   accent:'#ff2200', lineColor:'#cc2200', tokenIcon:'🎸',
   albumColors:['#2b0000','#ff2200','#ffaa00'],
   intro:"The ground shakes. Amps scream.\nWelcome to ROCK RAVINE."},
];

const battleNames = [
  ['Sound Snakes',  'Banjo Specter', 'ROBOT COWBOY'],
  ['Bass Crawlers', 'Strobe Phantom','DJ MONSTER'],
  ['Amp Gargoyles', 'Riff Wraith',   'GUITAR DEMON LORD'],
];

// ══════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════
function drawBtn(label, x, y, w, h, accent='#ff6600') {
  const hot = isHovered(x,y,w,h);
  ctx.fillStyle   = hot ? accent : 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(x,y,w,h,8); ctx.fill();
  ctx.strokeStyle = hot ? '#fff' : accent;
  ctx.lineWidth   = 2;
  if (hot) { ctx.shadowColor=accent; ctx.shadowBlur=10; }
  ctx.stroke(); ctx.shadowBlur=0;
  ctx.fillStyle   = hot ? '#000' : '#fff';
  ctx.font        = 'bold 15px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(label, x+w/2, y+h/2+5);
  ctx.textAlign   = 'left';
}

function drawLibBtn() {
  const hot = isHovered(W-52,8,44,34);
  ctx.fillStyle   = hot ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.6)';
  ctx.beginPath(); ctx.roundRect(W-52,8,44,34,7); ctx.fill();
  ctx.strokeStyle = '#666'; ctx.lineWidth=1; ctx.stroke();
  ctx.font='20px serif'; ctx.textAlign='center';
  ctx.fillStyle='#fff'; ctx.fillText('📼',W-30,33);
  ctx.textAlign='left';
}
function checkLibBtn() {
  if (wasClicked(W-52,8,44,34)) { prevState=gameState; gameState='library'; }
}

// ══════════════════════════════════════════════════════════════
//  INTRO PANELS
// ══════════════════════════════════════════════════════════════
const panels = [
  {text:"Garage sale. Sunday morning.\nYou weren't even looking for anything.\nThen you saw it.",              draw:panelBeatbox},
  {text:"A battered old beatbox.\nLabel scratched off. Warm to the touch.\nSuspiciously, weirdly warm.",      draw:panelCloseup},
  {text:"Two dollars.\nYou thought: what's the worst that could happen?\n(Spoiler: this.)",                   draw:panelHand},
  {text:"The dial clicked. The static SCREAMED.\nWorld folded inward.\nGone before you could ask for a refund.", draw:panelSuck},
  {text:"Somewhere inside the signal.\nThree worlds. Three Genre Tokens.\nBeat the music — or become part of it.", draw:panelTitle},
];

function panelBeatbox(age) {
  ctx.fillStyle='#1a1208'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#3a2810'; ctx.fillRect(0,360,W,140);
  ctx.strokeStyle='#5a3a18'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,360); ctx.lineTo(W,360); ctx.stroke();
  const bx=W/2-90, by=195, bob=Math.sin(age*0.04)*2;
  ctx.fillStyle='#2a1a0a';
  ctx.beginPath(); ctx.roundRect(bx,by+bob,180,130,12); ctx.fill();
  ctx.strokeStyle='#ff4400'; ctx.lineWidth=2;
  ctx.shadowColor='#ff2200'; ctx.shadowBlur=12+Math.sin(age*0.08)*6; ctx.stroke(); ctx.shadowBlur=0;
  [[bx+20,by+30,bx+40,by+45],[bx+140,by+20,bx+160,by+35],[bx+80,by+90,bx+100,by+110]].forEach(([x1,y1,x2,y2])=>{
    ctx.strokeStyle='#4a2a00'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x1,y1+bob); ctx.lineTo(x2,y2+bob); ctx.stroke();
  });
  [bx+20,bx+110].forEach(sx=>{
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(sx+25,by+50+bob,30,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#333'; ctx.lineWidth=2; ctx.stroke();
    [22,16,10,5].forEach(r=>{
      ctx.strokeStyle=r===5?'#ff3300':'#2a2a2a'; ctx.lineWidth=r===5?2:1;
      ctx.beginPath(); ctx.arc(sx+25,by+50+bob,r,0,Math.PI*2); ctx.stroke();
    });
  });
  ctx.fillStyle='#111'; ctx.fillRect(bx+40,by+88+bob,100,22);
  ctx.strokeStyle='#ff2200'; ctx.lineWidth=1; ctx.strokeRect(bx+40,by+88+bob,100,22);
  ctx.fillStyle='#ff2200'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=14;
  [[bx+55,by+108],[bx+95,by+108],[bx+125,by+108]].forEach(([ex,ey])=>{
    ctx.beginPath(); ctx.ellipse(ex,ey+bob,6,3,0,0,Math.PI*2); ctx.fill();
  });
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.fillRect(bx+130,by-18+bob,44,24);
  ctx.fillStyle='#c00'; ctx.font='bold 11px monospace';
  ctx.fillText('$2.00',bx+133,by-2+bob);
}

function panelCloseup(age) {
  ctx.fillStyle='#0d0808'; ctx.fillRect(0,0,W,H);
  const cx=W/2,cy=H/2;
  ctx.fillStyle='#1a0f05'; ctx.beginPath(); ctx.roundRect(cx-200,cy-150,400,300,20); ctx.fill();
  ctx.strokeStyle='#ff3300'; ctx.lineWidth=3; ctx.shadowColor='#ff2200'; ctx.shadowBlur=20; ctx.stroke(); ctx.shadowBlur=0;
  const ang=age*0.01;
  ctx.fillStyle='#3a2010'; ctx.beginPath(); ctx.arc(cx-70,cy+10,55,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#8a5020'; ctx.lineWidth=3; ctx.stroke();
  ctx.strokeStyle='#ff6600'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(cx-70,cy+10); ctx.lineTo(cx-70+Math.cos(ang)*44,cy+10+Math.sin(ang)*44); ctx.stroke();
  ctx.strokeStyle='rgba(255,100,0,0.3)'; ctx.lineWidth=1;
  for (let i=0;i<6;i++) {
    const hx=cx+60+i*18;
    ctx.beginPath(); ctx.moveTo(hx+Math.sin(age*0.05+i)*4,cy-120); ctx.lineTo(hx+Math.sin(age*0.05+i+1)*4,cy+120); ctx.stroke();
  }
  ctx.fillStyle='rgba(255,80,0,0.07)'; ctx.beginPath(); ctx.arc(cx,cy,200,0,Math.PI*2); ctx.fill();
}

function panelHand(age) {
  ctx.fillStyle='#0d0808'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#1a0f05'; ctx.beginPath(); ctx.roundRect(W/2-80,60,160,110,10); ctx.fill();
  ctx.strokeStyle='#ff4400'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#ff2200'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=10;
  [W/2-30,W/2+10,W/2+40].forEach(ex=>{
    ctx.beginPath(); ctx.ellipse(ex,148,5,2.5,0,0,Math.PI*2); ctx.fill();
  });
  ctx.shadowBlur=0;
  const reach=Math.min(age/80,1), handY=H-60-reach*250;
  ctx.fillStyle='#b08878';
  ctx.fillRect(W/2-28,handY+60,56,H);
  ctx.beginPath(); ctx.roundRect(W/2-32,handY,64,55,10); ctx.fill();
  [-28,-10,8,26].forEach((fx,i)=>{ ctx.beginPath(); ctx.roundRect(W/2+fx,handY-28-(i%2)*6,14,34,6); ctx.fill(); });
  ctx.beginPath(); ctx.roundRect(W/2+34,handY+8,14,28,6); ctx.fill();
  ctx.strokeStyle='#7a5848'; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(W/2-32,handY,64,55,10); ctx.stroke();
  if (reach>0.7) {
    const a=(reach-0.7)/0.3;
    ctx.strokeStyle=`rgba(255,150,50,${a*0.9})`; ctx.lineWidth=2; ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.moveTo(W/2,170); ctx.bezierCurveTo(W/2+30,200,W/2-20,220,W/2+10,handY); ctx.stroke(); ctx.shadowBlur=0;
  }
}

function panelSuck(age) {
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  const cx=W/2,cy=H/2,spin=age*0.06;
  for (let r=0;r<12;r++) {
    const radius=(r*45+age*3)%360, alpha=1-radius/360;
    ctx.strokeStyle=`rgba(255,${80+r*10},0,${alpha*0.8})`; ctx.lineWidth=3-r*0.1; ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(cx,cy,radius+10,spin+r*0.5,spin+r*0.5+Math.PI*1.4); ctx.stroke();
  }
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff';
  for (let i=0;i<80;i++) {
    const nx=Math.sin(i*173+age*0.3)*350+cx, ny=Math.cos(i*97+age*0.25)*200+cy;
    ctx.globalAlpha=Math.random()*0.8;
    ctx.beginPath(); ctx.arc(nx,ny,Math.random()*2,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  const scale=Math.max(0.05,1-age/120);
  ctx.save(); ctx.translate(cx,cy); ctx.scale(scale,scale);
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.ellipse(0,-60,20,25,0,0,Math.PI*2); ctx.fill();
  ctx.fillRect(-18,-30,36,50); ctx.fillRect(-32,-20,14,40); ctx.fillRect(18,-20,14,40);
  ctx.fillRect(-20,20,14,44); ctx.fillRect(6,20,14,44);
  ctx.restore();
}

function panelTitle(age) {
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,80,0,0.18)'; ctx.lineWidth=2;
  for (let i=0;i<8;i++) {
    ctx.beginPath();
    for (let x=0;x<W;x+=4) {
      const y=H/2+Math.sin((x+age*3)*0.02+i*0.8)*(20+i*12);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  const p=1+Math.sin(age*0.06)*0.04;
  ctx.save(); ctx.translate(W/2,H/2-60); ctx.scale(p,p);
  ctx.fillStyle='#ff4400'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=30;
  ctx.font='bold 72px monospace'; ctx.textAlign='center';
  ctx.fillText('RADIO',0,0); ctx.fillStyle='#ffaa00'; ctx.fillText('RIFT',0,72);
  ctx.restore(); ctx.shadowBlur=0;
  ctx.fillStyle='#aaa'; ctx.font='17px monospace'; ctx.textAlign='center';
  ctx.fillText('Three worlds. Three tokens.',W/2,H/2+70);
  ctx.fillText('Fight your way home.',W/2,H/2+94);
}

function drawIntro() {
  introPanelAge++;
  const p = panels[introPanel];
  p.draw(introPanelAge);

  const lines = p.text.split('\n'), boxH = lines.length*28+30;
  ctx.fillStyle='rgba(0,0,0,0.84)'; ctx.beginPath(); ctx.roundRect(30,H-boxH-22,W-60,boxH,10); ctx.fill();
  ctx.strokeStyle='rgba(255,100,0,0.4)'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='15px monospace'; ctx.textAlign='center';
  lines.forEach((line,i)=>ctx.fillText(line,W/2,H-boxH-2+i*28));

  if (introPanelAge>70) {
    if (Math.floor(introPanelAge/28)%2===0) {
      ctx.fillStyle='#aaa'; ctx.font='12px monospace';
      ctx.fillText('click anywhere or SPACE to continue',W/2,H-6);
    }
    if (hadClick || spacePressed()) {
      if (introPanel < panels.length-1) { introPanel++; introPanelAge=0; }
      else gameState='home';
    }
  }
  ctx.textAlign='left';
}

// ══════════════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════════════
function drawHome() {
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,80,0,0.14)'; ctx.lineWidth=2;
  for (let i=0;i<6;i++) {
    ctx.beginPath();
    for (let x=0;x<W;x+=4) {
      const y=H/2+Math.sin((x+frame*1.5)*0.018+i*1.1)*(16+i*9);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  const p=1+Math.sin(frame*0.05)*0.03;
  ctx.save(); ctx.translate(W/2,120); ctx.scale(p,p);
  ctx.fillStyle='#ff4400'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=22;
  ctx.font='bold 64px monospace'; ctx.textAlign='center';
  ctx.fillText('RADIO',0,0); ctx.fillStyle='#ffaa00'; ctx.fillText('RIFT',0,66);
  ctx.restore(); ctx.shadowBlur=0;
  ctx.fillStyle='#777'; ctx.font='13px monospace'; ctx.textAlign='center';
  ctx.fillText('An Audio Adventure',W/2,222);
  if (tokens.length>0) { ctx.fillStyle='#fff'; ctx.font='18px monospace'; ctx.fillText(tokens.join('  '),W/2,255); }

  drawBtn('▶   PLAY',    W/2-110,286,220,48,'#ff6600');
  drawBtn('📼 PLAYLIST', W/2-110,348,220,48,'#8844ff');

  // Controls box — taller, more visible
  const cbx=W/2-200, cby=408, cbw=400, cbh=84;
  ctx.fillStyle='rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.roundRect(cbx,cby,cbw,cbh,8); ctx.fill();
  ctx.strokeStyle='#555'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#ddd'; ctx.font='bold 12px monospace'; ctx.textAlign='center';
  ctx.fillText('CONTROLS', W/2, cby+17);
  // Divider
  ctx.strokeStyle='#444'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cbx+16,cby+23); ctx.lineTo(cbx+cbw-16,cby+23); ctx.stroke();
  ctx.fillStyle='#bbb'; ctx.font='12px monospace';
  ctx.fillText('← →  move     ↑  jump     ↓  crouch', W/2, cby+40);
  ctx.fillText('SPACE  shoot     Z  tap to shield (4 sec)', W/2, cby+57);
  ctx.fillStyle='#999'; ctx.font='11px monospace';
  ctx.fillText('📼 top-right corner opens playlist anytime', W/2, cby+74);
  ctx.textAlign='left';

  if (wasClicked(W/2-110,286,220,48)) beginPlay();
  if (wasClicked(W/2-110,348,220,48)) { prevState='home'; gameState='library'; }
}

function beginPlay() {
  stopIntroMusic();
  gameState='levelIntro'; levelIntroAge=0; startBG();
}

// ══════════════════════════════════════════════════════════════
//  LEVEL INTRO
// ══════════════════════════════════════════════════════════════
function drawLevelIntro() {
  levelIntroAge++;
  const lvl=levels[levelIndex];
  ctx.fillStyle=`rgba(0,0,0,${Math.min(levelIntroAge/30,1)})`; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=lvl.accent; ctx.globalAlpha=Math.max(0,0.28-levelIntroAge/100); ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
  ctx.fillStyle=lvl.accent; ctx.font='bold 13px monospace'; ctx.textAlign='center';
  ctx.shadowColor=lvl.accent; ctx.shadowBlur=8;
  ctx.fillText(`LEVEL ${levelIndex+1}`,W/2,H/2-90); ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.font='bold 44px monospace';
  ctx.shadowColor=lvl.accent; ctx.shadowBlur=18;
  ctx.fillText(lvl.name,W/2,H/2-22); ctx.shadowBlur=0;
  if (levelIntroAge>28) {
    ctx.fillStyle='#aaa'; ctx.font='14px monospace';
    lvl.intro.split('\n').forEach((line,i)=>ctx.fillText(line,W/2,H/2+40+i*24));
  }
  if (levelIntroAge>50) {
    ctx.fillStyle='#555'; ctx.font='11px monospace'; ctx.fillText('ENCOUNTERS:',W/2,H/2+112);
    battleNames[levelIndex].forEach((name,i)=>{
      ctx.fillStyle=i===2?lvl.accent:'#777';
      ctx.fillText((i===2?'⚡ BOSS: ':`  ${i+1}. `)+name,W/2,H/2+130+i*19);
    });
  }
  drawLibBtn(); checkLibBtn();
  if (levelIntroAge>65) {
    drawBtn('ENTER →',W/2-70,H-62,140,42,lvl.accent);
    if (wasClicked(W/2-70,H-62,140,42)) { gameState='playing'; resetBattle(); }
  }
  ctx.textAlign='left';
}

// ══════════════════════════════════════════════════════════════
//  BATTLE TRANSITION
// ══════════════════════════════════════════════════════════════
function showTransition(msg) { gameState='transition'; transitionAge=0; transitionMsg=msg; }

function drawTransition() {
  transitionAge++;
  const lvl=levels[levelIndex];
  ctx.fillStyle='rgba(0,0,0,0.92)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=lvl.accent; ctx.shadowColor=lvl.accent; ctx.shadowBlur=14;
  ctx.font='bold 26px monospace'; ctx.textAlign='center';
  ctx.fillText(transitionMsg,W/2,H/2-30); ctx.shadowBlur=0;
  if (battleIndex<3) {
    ctx.fillStyle='#777'; ctx.font='15px monospace';
    ctx.fillText(`Next: ${battleNames[levelIndex][battleIndex]||''}`,W/2,H/2+12);
  }
  drawLibBtn(); checkLibBtn();
  if (transitionAge>55) {
    drawBtn('CONTINUE →',W/2-80,H-62,160,42,lvl.accent);
    if (wasClicked(W/2-80,H-62,160,42)) advanceAfterTransition();
  }
  ctx.textAlign='left';
}

function advanceAfterTransition() {
  if (battleIndex>=3) {
    tokens.push(levels[levelIndex].tokenIcon);
    battleIndex=0; levelIndex++;
    stopDeezer();
    if (levelIndex>=levels.length) { gameState='win'; return; }
    gameState='levelIntro'; levelIntroAge=0;
  } else {
    gameState='playing'; resetBattle();
  }
}

// ══════════════════════════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════════════════════════
const GROUND=400, GRAVITY=0.40, SHOOTCD=36, SHIELDMAX=240, SHIELDCD=280;

const player = {
  x:120, y:GROUND-56, w:36, h:56,
  vy:0, vx:0, onGround:true,
  hp:100, maxHp:100,
  bullets:[], shootCD:0, facing:1,
  walkFrame:0, bobOffset:0,
  isWalking:false, isCrouching:false,
  invincible:0,
  shielding:false, shieldCooldown:0, shieldDuration:0, _zHeld:false,
};

function handleInput() {
  if (gameState!=='playing') return;
  player.isWalking=false; player.isCrouching=false; player.vx=0;
  if (keys['ArrowRight']) { player.vx=2.6;  player.facing=1;  player.isWalking=true; }
  if (keys['ArrowLeft'])  { player.vx=-2.6; player.facing=-1; player.isWalking=true; }
  if (keys['ArrowDown'])  { player.isCrouching=true; }
  if (keys['ArrowUp'] && player.onGround) { player.vy=-11; player.onGround=false; }
  if (keys[' ']) doShoot();

  // Shield toggle — press Z once to activate, lasts SHIELDMAX frames, then cooldown
  if ((keys['z']||keys['Z']) && !player._zHeld) {
    player._zHeld = true;
    if (!player.shielding && player.shieldCooldown<=0) {
      player.shielding = true;
      player.shieldDuration = 0;
    }
  }
  if (!(keys['z']||keys['Z'])) player._zHeld = false;

  // Tick shield duration down
  if (player.shielding) {
    player.shieldDuration++;
    if (player.shieldDuration >= SHIELDMAX) {
      player.shielding = false;
      player.shieldCooldown = SHIELDCD;
      player.shieldDuration = 0;
    }
  }
  if (player.shieldCooldown > 0) player.shieldCooldown--;
  player.x+=player.vx; player.x=Math.max(0,Math.min(W-player.w,player.x));
}

function doShoot() {
  if (player.shootCD>0) return;
  player.bullets.push({x:player.x+(player.facing===1?player.w+4:-12), y:player.y+18, vx:4.5*player.facing});
  player.shootCD=SHOOTCD; sfxShoot();
}

function physics() {
  player.vy+=GRAVITY; player.y+=player.vy;
  if (player.y>=GROUND-player.h) { player.y=GROUND-player.h; player.vy=0; player.onGround=true; }
  if (player.invincible>0) player.invincible--;
}

function updateBullets() {
  if (player.shootCD>0) player.shootCD--;
  player.bullets.forEach(b=>b.x+=b.vx);
  player.bullets=player.bullets.filter(b=>b.x>-20&&b.x<W+20);
  player.bullets.forEach(b=>{
    if (!enemy) return;
    if (b.x<enemy.x+enemy.w&&b.x+8>enemy.x&&b.y<enemy.y+enemy.h&&b.y+8>enemy.y) {
      enemy.hp-=10; b.x=9999; sfxHit();
      // 45% chance to drop a bubble on every hit
      if (Math.random()<0.45) spawnBubble(enemy.x+enemy.w/2, enemy.y);
      if (enemy.hp<=0) {
        // Burst of 3 bubbles on kill
        for(let i=0;i<3;i++) spawnBubble(enemy.x+enemy.w/2+((Math.random()-0.5)*40), enemy.y+Math.random()*20);
        battleWon();
      }
    }
  });
}

function checkStomp() {
  if (!enemy||enemy.type!==0) return;
  const overlapX=player.x<enemy.x+enemy.w&&player.x+player.w>enemy.x;
  const feetY=player.y+player.h;
  if (player.vy>0&&overlapX&&feetY>enemy.y&&feetY<enemy.y+24) {
    enemy.hp-=40; player.vy=-9; player.invincible=30; sfxHit();
    // Stomp = guaranteed 2 bubbles
    spawnBubble(enemy.x+enemy.w/2-15, enemy.y);
    spawnBubble(enemy.x+enemy.w/2+15, enemy.y-10);
    if (enemy.hp<=0) battleWon();
  }
}

function updatePlayerAnim() {
  if (player.isWalking) player.walkFrame=(player.walkFrame+0.14)%4;
  player.bobOffset=player.onGround&&!player.isWalking?Math.sin(frame*0.055)*2.5:0;
}

// ══════════════════════════════════════════════════════════════
//  MUSIC BUBBLES
// ══════════════════════════════════════════════════════════════
function spawnBubble(x, y) {
  musicBubbles.push({
    x, y,
    vy: -1.5 - Math.random()*1.5,   // float upward
    vx: (Math.random()-0.5)*1.2,
    life: 300,                        // frames before disappearing
    pulse: Math.random()*Math.PI*2,  // phase offset for glow
    lvl: levelIndex,
  });
}

function updateBubbles() {
  musicBubbles.forEach(b=>{
    b.x += b.vx;
    b.y += b.vy;
    b.vy += 0.02;  // gentle gravity pull back down, makes them bob
    b.vy = Math.max(b.vy, -0.5);  // cap upward float
    b.life--;
    // Bounce off walls
    if (b.x<20||b.x>W-20) b.vx*=-1;
    // Don't go above sky area
    if (b.y<60) { b.y=60; b.vy=Math.abs(b.vy)*0.5; }
  });
  musicBubbles = musicBubbles.filter(b=>b.life>0);

  // Player collects bubble by touching it
  musicBubbles.forEach(b=>{
    const dx=(player.x+player.w/2)-b.x, dy=(player.y+player.h/2)-b.y;
    if (Math.hypot(dx,dy)<28) {
      collectBubble(b);
      b.life=0;
    }
  });
  musicBubbles = musicBubbles.filter(b=>b.life>0);
}

function collectBubble(b) {
  const song = getBubbleSong(b.lvl);
  const entry = {...song, levelIndex:b.lvl, isBonus:true};
  earnedSongs.push(entry);
  songNotif = {song:entry, timer:280};
  tone(880,'sine',0.08,0.18); tone(1320,'sine',0.06,0.14,0.06);
  // Fetch preview URL for this bubble song
  itunesSearch(song.query).then(tr => {
    if (!tr) return;
    entry.previewUrl = tr.previewUrl;
    _tapHint = { entry, timer: 600 };
  });
}

function drawBubbles() {
  const lvl = levels[levelIndex];
  musicBubbles.forEach(b=>{
    const alpha = b.life<60 ? b.life/60 : b.life>280 ? (300-b.life)/20 : 1;
    const pulse = Math.sin(frame*0.1 + b.pulse)*0.25+0.75;
    const r = 15 + Math.sin(frame*0.12+b.pulse)*2; // pulsing size
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y);

    // Outer glow
    ctx.shadowColor = lvl.accent;
    ctx.shadowBlur  = 10 + pulse*12;

    // Bubble body — gradient fill
    const bg = ctx.createRadialGradient(-4,-4,2,0,0,r);
    bg.addColorStop(0,'rgba(255,255,255,0.5)');
    bg.addColorStop(0.4,`${lvl.accent}66`);
    bg.addColorStop(1,`${lvl.accent}cc`);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

    // Rim
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = alpha*0.8;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur  = 0;

    // Shine highlight
    ctx.globalAlpha = alpha*0.7;
    ctx.fillStyle   = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(-4,-5,4,3,-0.5,0,Math.PI*2); ctx.fill();

    // Music note inside
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#fff';
    ctx.font        = `bold ${Math.round(r*0.9)}px serif`;
    ctx.textAlign   = 'center';
    ctx.fillText('♪', 1, 4);

    // Sparkle dots orbiting
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1;
    [0,1,2].forEach(i=>{
      const sa = frame*0.06 + i*Math.PI*2/3 + b.pulse;
      const sr = r+5;
      ctx.globalAlpha = alpha * (Math.sin(frame*0.1+i)*0.3+0.5);
      ctx.beginPath(); ctx.arc(Math.cos(sa)*sr, Math.sin(sa)*sr, 2, 0, Math.PI*2);
      ctx.fillStyle = lvl.accent; ctx.fill();
    });

    ctx.restore();
  });
}

// ══════════════════════════════════════════════════════════════
//  ENEMY
// ══════════════════════════════════════════════════════════════
let enemy=null, eBullets=[];

function buildEnemy() {
  eBullets=[];
  const type=battleIndex, hpBase=[70,110,200];
  const hp=hpBase[type]+levelIndex*28;
  const base={x:620,y:GROUND-60,w:48,h:60,hp,maxHp:hp,type,levelIndex,
    phase:0,actionTimer:80,moveDir:-1,vy:0,onGround:true,anim:0,shootCD:0};
  if (type===0) return {...base,speed:1.4+levelIndex*0.3};
  if (type===1) return {...base,speed:1.1+levelIndex*0.25};
  return {...base,w:70,h:78,x:560,y:GROUND-78,speed:1.2+levelIndex*0.3};
}

function eFire()  {
  const dx=player.x-enemy.x, dy=player.y-enemy.y, dist=Math.hypot(dx,dy)||1;
  eBullets.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,vx:(dx/dist)*2.4,vy:(dy/dist)*2.4,w:10,h:10,dmg:6+levelIndex*2,life:280,kind:'single'});
}
function eSpread() {
  const base=Math.atan2(player.y-enemy.y,player.x-enemy.x);
  [-0.22,0,0.22].forEach(a=>{
    eBullets.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2,vx:Math.cos(base+a)*2.6,vy:Math.sin(base+a)*2.6,w:10,h:10,dmg:8+levelIndex*2,life:300,kind:'spread'});
  });
}
function eWave() {
  [-1,0,1].forEach(i=>{
    eBullets.push({x:enemy.x+enemy.w/2,y:enemy.y+enemy.h/2+i*32,vx:(player.x<enemy.x?-2.8:2.8),vy:i*0.55,w:12,h:12,dmg:10+levelIndex*3,life:240,kind:'wave'});
  });
}

function updateEnemy() {
  if (!enemy) return;
  enemy.anim++;
  enemy.vy+=GRAVITY; enemy.y+=enemy.vy;
  if (enemy.y>=GROUND-enemy.h) { enemy.y=GROUND-enemy.h; enemy.vy=0; enemy.onGround=true; }

  // Wall margins — enemy bounces off these
  const wallL = 40, wallR = W - enemy.w - 40;

  if (enemy.type===0) {
    const dx=player.x-enemy.x; enemy.moveDir=dx>0?1:-1; enemy.x+=enemy.moveDir*enemy.speed;
    // Wall bounce
    if (enemy.x<=wallL) { enemy.x=wallL; enemy.moveDir=1; }
    if (enemy.x>=wallR) { enemy.x=wallR; enemy.moveDir=-1; }
    enemy.actionTimer--;
    if (enemy.actionTimer<=0&&enemy.onGround&&Math.abs(dx)<200) {
      enemy.vy=-9; enemy.onGround=false; enemy.actionTimer=140+Math.random()*100;
    }
  } else if (enemy.type===1) {
    const target=player.x>400?150:W-enemy.w-150, dtx=target-enemy.x;
    if (Math.abs(dtx)>14) enemy.x+=(dtx>0?1:-1)*enemy.speed;
    // Wall bounce for ranged too
    if (enemy.x<=wallL) { enemy.x=wallL; }
    if (enemy.x>=wallR) { enemy.x=wallR; }
    const fpb=Math.round((60/levels[levelIndex].bpm)*60);
    if (frame%(fpb*6)===0) eFire();
  } else {
    const pct=enemy.hp/enemy.maxHp;
    enemy.phase=pct>0.66?0:pct>0.33?1:2;
    const fpb=Math.round((60/levels[levelIndex].bpm)*60);
    if (enemy.phase===0) {
      enemy.actionTimer--; if (enemy.actionTimer<=0){enemy.moveDir=-1;enemy.actionTimer=160;}
      enemy.x+=enemy.moveDir*enemy.speed;
      if (enemy.x<=wallL) { enemy.x=wallL; enemy.moveDir=1; }
      if (enemy.x>=wallR) { enemy.x=wallR; enemy.moveDir=-1; }
      if (frame%(fpb*7)===0) eFire();
    } else if (enemy.phase===1) {
      enemy.actionTimer--; if (enemy.actionTimer<=0){enemy.moveDir=-1;enemy.actionTimer=120;}
      enemy.x+=enemy.moveDir*(enemy.speed*1.2);
      if (enemy.x<=wallL) { enemy.x=wallL; enemy.moveDir=1; }
      if (enemy.x>=wallR) { enemy.x=wallR; enemy.moveDir=-1; }
      if (frame%(fpb*6)===0) eSpread();
    } else {
      enemy.x+=enemy.moveDir*(enemy.speed*1.4);
      if (enemy.x<=wallL) { enemy.x=wallL; enemy.moveDir=1; }
      if (enemy.x>=wallR) { enemy.x=wallR; enemy.moveDir=-1; }
      if (frame%(fpb*5)===0) eWave();
    }
  }
  enemy.x=Math.max(0,Math.min(W-enemy.w,enemy.x));

  eBullets.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.life--;});
  eBullets=eBullets.filter(b=>b.life>0&&b.x>-60&&b.x<W+60&&b.y>-60&&b.y<H+60);

  if (player.invincible<=0) {
    eBullets.forEach(b=>{
      if (b.x<player.x+player.w&&b.x+b.w>player.x&&b.y<player.y+player.h&&b.y+b.h>player.y) {
        if (player.shielding) { b.vx=-1.1;b.vy=-0.8;b.dmg=22;b.kind='deflected';sfxDeflect(); }
        else { player.hp-=b.dmg;b.life=0;player.invincible=55;sfxPlayerHit(); if(player.hp<=0)playerDied(); }
      }
    });
  }
  eBullets.filter(b=>b.kind==='deflected').forEach(b=>{
    if (b.x<enemy.x+enemy.w&&b.x+8>enemy.x&&b.y<enemy.y+enemy.h&&b.y+8>enemy.y) {
      enemy.hp-=b.dmg;b.life=0;sfxHit(); if(enemy.hp<=0)battleWon();
    }
  });
  if (enemy.type===0&&player.invincible<=0&&
      player.x<enemy.x+enemy.w&&player.x+player.w>enemy.x&&
      player.y<enemy.y+enemy.h&&player.y+player.h>enemy.y) {
    if (player.shielding) sfxDeflect();
    else { player.hp-=0.25;player.invincible=16; if(player.hp<=0)playerDied(); }
  }
}

// ══════════════════════════════════════════════════════════════
//  BEAT PULSE
// ══════════════════════════════════════════════════════════════
function beatPulse() {
  const bpm=levels[levelIndex].bpm, fpb=Math.round((60/bpm)*60), phase=frame%fpb;
  if (phase===0&&frame!==lastBeatFrame) { lastBeatFrame=frame; sfxBeat(); }
  return Math.max(0,1-phase/(fpb*0.25));
}

// ══════════════════════════════════════════════════════════════
//  BACKGROUNDS
// ══════════════════════════════════════════════════════════════
function drawBG() {
  const lvl=levels[levelIndex], pulse=beatPulse();
  const sg=ctx.createLinearGradient(0,0,0,GROUND);
  sg.addColorStop(0,lvl.skyTop); sg.addColorStop(1,lvl.skyBot);
  ctx.fillStyle=sg; ctx.fillRect(0,0,W,GROUND);
  if(levelIndex===0) countryBG(pulse);
  if(levelIndex===1) edmBG(pulse);
  if(levelIndex===2) rockBG(pulse);
  const fg=ctx.createLinearGradient(0,GROUND,0,H);
  fg.addColorStop(0,lvl.floorTop); fg.addColorStop(1,lvl.floorBot);
  ctx.fillStyle=fg; ctx.fillRect(0,GROUND,W,H-GROUND);
  ctx.save(); ctx.shadowColor=lvl.accent; ctx.shadowBlur=6+pulse*18;
  ctx.strokeStyle=lvl.lineColor; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,GROUND); ctx.lineTo(W,GROUND); ctx.stroke(); ctx.restore();
}

function countryBG(pulse) {
  // Multi-layer hills
  ctx.fillStyle='#d4854a';
  ctx.beginPath(); ctx.moveTo(0,GROUND);
  ctx.bezierCurveTo(80,230,220,200,380,255); ctx.bezierCurveTo(500,295,600,225,680,255); ctx.bezierCurveTo(740,270,780,285,800,GROUND);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#c87040';
  ctx.beginPath(); ctx.moveTo(0,GROUND);
  ctx.bezierCurveTo(100,280,200,260,320,275); ctx.bezierCurveTo(420,285,520,265,640,280); ctx.bezierCurveTo(720,290,770,295,800,GROUND);
  ctx.closePath(); ctx.fill();

  // Pulsing sun with rays
  const sp=1+pulse*0.07;
  ctx.save(); ctx.translate(680,95); ctx.scale(sp,sp);
  // Sun rays
  ctx.strokeStyle='rgba(255,220,50,0.4)'; ctx.lineWidth=3;
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+frame*0.005;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*45,Math.sin(a)*45); ctx.lineTo(Math.cos(a)*70,Math.sin(a)*70); ctx.stroke();
  }
  // Sun body
  ctx.fillStyle='#ffe040'; ctx.shadowColor='#ffaa00'; ctx.shadowBlur=22+pulse*18;
  ctx.beginPath(); ctx.arc(0,0,38,0,Math.PI*2); ctx.fill();
  // Sun face
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(200,140,0,0.5)';
  ctx.beginPath(); ctx.arc(-10,-8,5,0,Math.PI*2); ctx.arc(10,-8,5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(200,140,0,0.6)'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,5,10,0,Math.PI); ctx.stroke();
  ctx.restore();

  // Fluffy clouds
  [[140,80,1.0],[380,60,0.9],[560,90,0.8]].forEach(([cx,cy,s])=>{
    ctx.save(); ctx.translate(cx+Math.sin(frame*0.008)*8,cy); ctx.scale(s,s);
    ctx.fillStyle='rgba(255,245,220,0.88)';
    [[-20,0,22],[-2,-12,18],[18,-6,20],[36,2,16]].forEach(([ox,oy,r])=>{
      ctx.beginPath(); ctx.arc(ox,oy,r,0,Math.PI*2); ctx.fill();
    });
    ctx.restore();
  });

  // Saloon building — more detailed
  // Main structure
  ctx.fillStyle='#8b4a18';
  ctx.beginPath(); ctx.roundRect(38,268,162,132,4); ctx.fill();
  // Wood plank lines
  ctx.strokeStyle='#6a3610'; ctx.lineWidth=1;
  for(let y=280;y<400;y+=12){ ctx.beginPath(); ctx.moveTo(38,y); ctx.lineTo(200,y); ctx.stroke(); }
  // False front / sign board
  ctx.fillStyle='#a05c20';
  ctx.beginPath(); ctx.roundRect(28,248,182,26,3); ctx.fill();
  ctx.strokeStyle='#6a3610'; ctx.lineWidth=2; ctx.strokeRect(28,248,182,26);
  // Sign text
  ctx.fillStyle='#ffe080'; ctx.font='bold 10px monospace'; ctx.textAlign='center';
  ctx.fillText('THE RUSTY RADIO',119,264); ctx.textAlign='left';
  // Door with rounded top
  ctx.fillStyle='#3a1a00';
  ctx.beginPath(); ctx.roundRect(100,330,38,70,4); ctx.fill();
  ctx.fillStyle='#5a3010'; ctx.beginPath(); ctx.arc(119,330,19,Math.PI,0); ctx.fill();
  // Door handle
  ctx.fillStyle='#c8a000'; ctx.beginPath(); ctx.arc(110,360,3,0,Math.PI*2); ctx.fill();
  // Windows with shutters
  [[52,290],[145,290]].forEach(([wx,wy])=>{
    ctx.fillStyle='#ffcc66'; ctx.fillRect(wx,wy,32,26);
    ctx.fillStyle='#8b5a20'; ctx.fillRect(wx-6,wy,6,26); ctx.fillRect(wx+32,wy,6,26); // shutters
    // Window cross
    ctx.strokeStyle='#8b4a18'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(wx+16,wy); ctx.lineTo(wx+16,wy+26); ctx.moveTo(wx,wy+13); ctx.lineTo(wx+32,wy+13); ctx.stroke();
  });
  // Porch railing
  ctx.fillStyle='#6a3a10';
  ctx.fillRect(38,388,162,6);
  for(let x=45;x<200;x+=12){ ctx.fillRect(x,354,4,34); }
  // Chimney with smoke
  ctx.fillStyle='#7a4a20'; ctx.fillRect(155,230,22,42);
  ctx.fillStyle='rgba(200,200,200,0.35)';
  [0,1,2].forEach(i=>{
    const sy=228-i*14+Math.sin(frame*0.04+i)*4, sr=5+i*3;
    ctx.beginPath(); ctx.arc(166+Math.sin(frame*0.03+i)*4,sy,sr,0,Math.PI*2); ctx.fill();
  });

  // Detailed cactus
  ctx.fillStyle='#5a8a38';
  ctx.beginPath(); ctx.roundRect(700,315,20,85,8); ctx.fill(); // trunk
  ctx.strokeStyle='#3a6020'; ctx.lineWidth=1; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(662,330,40,14,6); ctx.fill(); // left arm base
  ctx.beginPath(); ctx.roundRect(660,310,16,26,6); ctx.fill(); // left arm up
  ctx.beginPath(); ctx.roundRect(720,325,40,14,6); ctx.fill(); // right arm
  ctx.beginPath(); ctx.roundRect(726,305,16,26,6); ctx.fill(); // right arm up
  // Cactus flower
  ctx.fillStyle='#ff8888'; ctx.beginPath(); ctx.arc(710,315,5,0,Math.PI*2); ctx.fill();

  // Fence with posts and rails — more detailed
  ctx.fillStyle='#c8965a';
  for(let i=185;i<630;i+=48){
    // Post with rounded top
    ctx.beginPath(); ctx.roundRect(i,358,11,42,2); ctx.fill();
    ctx.strokeStyle='#8b6a3e'; ctx.lineWidth=1; ctx.stroke();
  }
  // Two rails
  ctx.fillStyle='#b07a40';
  ctx.fillRect(185,368,440,6); ctx.fillRect(185,383,440,6);

  // Tumbleweeds rolling
  const tw=[(frame*0.4)%820,(frame*0.25+400)%820];
  tw.forEach(tx=>{
    ctx.save(); ctx.translate(tx,GROUND-6);
    ctx.strokeStyle='#8b6a30'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.stroke();
    for(let a=0;a<Math.PI*2;a+=0.7){
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a+frame*0.05)*7,Math.sin(a+frame*0.05)*7); ctx.stroke();
    }
    ctx.restore();
  });
}

function edmBG(pulse) {
  // Animated grid floor — brighter, more defined tiles
  const cols=10, tileW=W/cols, tileH=42;
  const colors=['#ff00ff','#00ffff','#ff6600','#00ff88','#ff0088','#8800ff','#0088ff'];
  for(let r=0;r<3;r++){
    for(let c=0;c<cols;c++){
      const ci=(c+r+Math.floor(frame/14))%colors.length;
      const bright = (c+r)%2===0 ? 0.22+pulse*0.42 : 0.08;
      ctx.fillStyle=colors[ci]; ctx.globalAlpha=bright;
      ctx.fillRect(c*tileW+1,GROUND-tileH*(r+1)+1,tileW-2,tileH-2);
      // Tile edge glow on beat
      if(pulse>0.6&&(c+r)%3===0){
        ctx.globalAlpha=pulse*0.5;
        ctx.strokeStyle=colors[ci]; ctx.lineWidth=2;
        ctx.strokeRect(c*tileW+1,GROUND-tileH*(r+1)+1,tileW-2,tileH-2);
      }
    }
  }
  ctx.globalAlpha=1;

  // Moving laser beams — more of them
  const laserCols=['#ff00ff','#00ffff','#ff4400','#ffff00','#00ff88'];
  laserCols.forEach((col,i)=>{
    const x=100+i*150+Math.sin(frame*0.025+i*1.3)*55;
    ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=2.5;
    ctx.globalAlpha=0.35+pulse*0.45; ctx.shadowColor=col; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(x,GROUND); ctx.stroke();
    // Second beam from opposite
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W-x,GROUND); ctx.stroke();
    ctx.restore();
  });

  // Light rig bar at top
  ctx.fillStyle='#111'; ctx.fillRect(0,0,W,20);
  ctx.fillStyle='#222'; ctx.fillRect(0,18,W,4);
  // Stage lights hanging
  const lightColors=['#ff00ff','#00ffff','#ffff00','#ff4400','#00ff88'];
  [80,180,280,380,480,580,680,760].forEach((lx,i)=>{
    ctx.fillStyle='#333'; ctx.fillRect(lx-4,0,8,30);
    const lc=lightColors[i%lightColors.length];
    ctx.fillStyle=lc; ctx.shadowColor=lc; ctx.shadowBlur=10+pulse*14;
    ctx.beginPath(); ctx.arc(lx,30,7,0,Math.PI*2); ctx.fill();
    // Light cone on pulse
    if(pulse>0.3){
      ctx.save(); ctx.globalAlpha=(pulse-0.3)*0.5;
      const cg=ctx.createLinearGradient(lx,30,lx+Math.sin(i)*60,GROUND);
      cg.addColorStop(0,lc); cg.addColorStop(1,'transparent');
      ctx.fillStyle=cg;
      ctx.beginPath(); ctx.moveTo(lx,30); ctx.lineTo(lx-35,GROUND); ctx.lineTo(lx+35,GROUND); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur=0;
  });

  // Speaker towers — more detailed
  [[18,160],[710,160]].forEach(([sx,sy])=>{
    ctx.fillStyle='#1a1a2e'; ctx.beginPath(); ctx.roundRect(sx,sy,68,240,4); ctx.fill();
    ctx.strokeStyle='#333'; ctx.lineWidth=2; ctx.stroke();
    // Speaker cones
    [sy+20,sy+80,sy+140,sy+200].forEach(speakerY=>{
      ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(sx+34,speakerY,24,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#444'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(sx+34,speakerY,16,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=pulse>0.5?'#c800ff':'#550088';
      ctx.shadowColor='#c800ff'; ctx.shadowBlur=pulse>0.5?12:4;
      ctx.beginPath(); ctx.arc(sx+34,speakerY,8,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    });
  });

  // DJ booth — more detailed
  ctx.fillStyle='#1a0030';
  ctx.beginPath(); ctx.roundRect(295,322,210,78,6); ctx.fill();
  ctx.strokeStyle='#c800ff'; ctx.lineWidth=2;
  ctx.shadowColor='#c800ff'; ctx.shadowBlur=6+pulse*8; ctx.stroke(); ctx.shadowBlur=0;
  // Mixer surface
  ctx.fillStyle='#110020'; ctx.beginPath(); ctx.roundRect(300,312,200,16,3); ctx.fill();
  // Knobs and sliders
  [315,345,375,405,435,465,490].forEach((kx,i)=>{
    ctx.fillStyle=i%2===0?'#c800ff':'#00ffff';
    ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=4;
    ctx.beginPath(); ctx.arc(kx,320,4,0,Math.PI*2); ctx.fill();
  });
  ctx.shadowBlur=0;
  // Vinyl records spinning
  [[330,350],[470,350]].forEach(([rx,ry])=>{
    ctx.save(); ctx.translate(rx,ry);
    const spin=frame*0.04;
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#333'; ctx.lineWidth=1;
    [16,12,8,4].forEach(r=>{ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();});
    ctx.fillStyle='#c800ff'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
    // Highlight stripe
    ctx.strokeStyle='rgba(200,0,255,0.4)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,14,spin,spin+1.2); ctx.stroke();
    ctx.restore();
  });

  // Crowd silhouettes — animated, more varied
  ctx.fillStyle='#0d0015';
  for(let x=0;x<W;x+=22){
    const bounce=Math.sin(x*0.15+frame*0.08)*10+Math.sin(frame*0.12+x)*5;
    const h=26+bounce;
    ctx.beginPath(); ctx.arc(x+11,GROUND+16,10,0,Math.PI*2); ctx.fill();
    ctx.fillRect(x+3,GROUND+16,16,h);
    // Raised hands occasionally
    if(Math.floor((x+frame*0.02)/22)%3===0){
      ctx.fillRect(x,GROUND+14-Math.abs(bounce)*0.5,4,16);
      ctx.fillRect(x+18,GROUND+14-Math.abs(bounce)*0.5,4,16);
    }
  }
}

function rockBG(pulse) {
  // Stage curtains — more detailed with folds
  [[0,130],[670,130]].forEach(([cx,cw])=>{
    ctx.fillStyle='#1a0000'; ctx.fillRect(cx,0,cw,GROUND);
    // Fabric fold shading
    ctx.fillStyle='#2d0000';
    for(let x=cx+8;x<cx+cw-8;x+=20){ ctx.fillRect(x,0,9,GROUND); }
    // Curtain tie-back
    ctx.fillStyle='#8b2000'; ctx.beginPath();
    ctx.ellipse(cx+(cx===0?cw-10:10),GROUND/2,12,30,0,0,Math.PI*2); ctx.fill();
  });

  // Dramatic spotlights — 4 of them
  const spotColors=['#ff2200','#ff6600','#ffaa00','#ff0066'];
  spotColors.forEach((col,i)=>{
    const cx=160+i*160;
    const swing=Math.sin(frame*0.02+i*0.8)*30;
    ctx.save();
    ctx.globalAlpha=0.1+(i===1||i===2?pulse*0.18:0.04);
    const sg=ctx.createLinearGradient(cx+swing,0,cx+swing,GROUND);
    sg.addColorStop(0,col); sg.addColorStop(1,'transparent');
    ctx.fillStyle=sg;
    ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx+swing-50,GROUND); ctx.lineTo(cx+swing+50,GROUND); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Light source dot at top
    ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(cx,5,5,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  });

  // Hanging lights / marquee strip at top
  ctx.fillStyle='#1a0000'; ctx.fillRect(130,0,540,18);
  ctx.strokeStyle='#440000'; ctx.lineWidth=1; ctx.strokeRect(130,0,540,18);
  for(let x=145;x<670;x+=24){
    const lit=(x+Math.floor(frame*0.15))%72<24;
    ctx.fillStyle=lit?'#ff4400':'#330000';
    ctx.shadowColor=lit?'#ff2200':'transparent'; ctx.shadowBlur=lit?8:0;
    ctx.beginPath(); ctx.arc(x,10,5,0,Math.PI*2); ctx.fill();
  }
  ctx.shadowBlur=0;

  // Amp stacks — more detailed with speaker detail
  [[80,240],[680,240]].forEach(([ax,ay])=>{
    [0,1,2].forEach(stack=>{
      const stackY=ay+stack*56;
      // Amp body
      ctx.fillStyle='#111'; ctx.beginPath(); ctx.roundRect(ax,stackY,70,50,3); ctx.fill();
      ctx.strokeStyle='#2a0000'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.roundRect(ax+4,stackY+4,62,42,2); ctx.fill();
      // Two speaker cones
      [[ax+19,stackY+21],[ax+51,stackY+21]].forEach(([spx,spy])=>{
        ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(spx,spy,14,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle='#2a0000'; ctx.beginPath(); ctx.arc(spx,spy,8,0,Math.PI*2); ctx.fill();
        if(pulse>0.5){
          ctx.fillStyle='#ff2200'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.arc(spx,spy,4,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
        }
      });
    });
  });

  // Center drum kit — more detailed
  ctx.fillStyle='#2a0000';
  ctx.beginPath(); ctx.ellipse(400,GROUND-8,90,28,0,0,Math.PI*2); ctx.fill();
  // Bass drum
  ctx.strokeStyle='#550000'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.ellipse(400,GROUND-4,50,22,0,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#1a0000'; ctx.beginPath(); ctx.ellipse(400,GROUND-4,44,18,0,0,Math.PI*2); ctx.fill();
  // Drum decal
  ctx.fillStyle='#ff2200'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
  ctx.fillText('⚡',400,GROUND); ctx.textAlign='left';
  // Tom-toms
  [[360,GROUND-55],[440,GROUND-55]].forEach(([tx,ty])=>{
    ctx.fillStyle='#2a0000'; ctx.beginPath(); ctx.ellipse(tx,ty,20,10,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#550000'; ctx.lineWidth=2; ctx.stroke();
  });
  // Cymbals
  [[320,GROUND-70],[480,GROUND-70],[400,GROUND-90]].forEach(([cx,cy])=>{
    ctx.fillStyle='#6a5000'; ctx.beginPath(); ctx.ellipse(cx,cy,22,5,0.1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#aa8800'; ctx.lineWidth=1; ctx.stroke();
  });
  // Hi-hat stand
  ctx.strokeStyle='#440000'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(330,GROUND); ctx.lineTo(325,GROUND-65); ctx.stroke();

  // Fire effects on beat
  if(pulse>0.4){
    [[130,GROUND],[670,GROUND]].forEach(([fx,fy])=>{
      const fh=20+pulse*40;
      ctx.save(); ctx.globalAlpha=0.6+pulse*0.3;
      for(let i=0;i<5;i++){
        const fw=8+i*3, foff=(Math.sin(frame*0.15+i)*8);
        const fg=ctx.createLinearGradient(fx+foff,fy,fx+foff,fy-fh-i*6);
        fg.addColorStop(0,'rgba(255,80,0,0.9)');
        fg.addColorStop(0.5,'rgba(255,200,0,0.6)');
        fg.addColorStop(1,'transparent');
        ctx.fillStyle=fg;
        ctx.beginPath(); ctx.ellipse(fx+foff,fy-10,fw/2,fh/2+i*4,0,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });
  }

  // Animated crowd
  ctx.fillStyle='#150000';
  for(let x=130;x<670;x+=20){
    const bounce=Math.abs(Math.sin(x*0.2+frame*0.1))*16;
    ctx.beginPath(); ctx.arc(x+10,GROUND+16,9,0,Math.PI*2); ctx.fill();
    ctx.fillRect(x+2,GROUND+16,16,22+bounce*0.5);
    // Raised fists on beat
    if(pulse>0.6&&x%60<20){
      ctx.fillRect(x,GROUND+8-bounce,4,14);
      ctx.fillRect(x+16,GROUND+10-bounce,4,14);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  DRAW PLAYER — cute cartoony style
// ══════════════════════════════════════════════════════════════
function drawPlayer() {
  const p=player, bob=p.bobOffset, cx=p.x+p.w/2, f=p.facing, squat=p.isCrouching?0.80:1;
  if (p.invincible>0&&Math.floor(frame/4)%2===0) return;
  ctx.save(); ctx.translate(cx, p.y+p.h+bob); ctx.scale(f, squat);
  const leg=p.isWalking?Math.sin(p.walkFrame*Math.PI/2)*12:0;

  // ── Legs & feet (rounded, cute) ────────────────────────────
  ctx.save(); ctx.translate(-9,-14); ctx.rotate((leg*Math.PI)/180);
  ctx.fillStyle='#3a4a5a'; // dark pants
  ctx.beginPath(); ctx.roundRect(-7,0,14,20,4); ctx.fill();
  // Shoe — big rounded toe
  ctx.fillStyle='#2a2a3a';
  ctx.beginPath(); ctx.ellipse(-2,21,10,7,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();

  ctx.save(); ctx.translate(9,-14); ctx.rotate((-leg*Math.PI)/180);
  ctx.fillStyle='#3a4a5a';
  ctx.beginPath(); ctx.roundRect(-7,0,14,20,4); ctx.fill();
  ctx.fillStyle='#2a2a3a';
  ctx.beginPath(); ctx.ellipse(2,21,10,7,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();

  // ── Body — chubby rounded jacket ──────────────────────────
  ctx.fillStyle='#5a7a9a'; // blue-grey jacket
  ctx.beginPath(); ctx.roundRect(-16,-42,32,30,8); ctx.fill();
  ctx.strokeStyle='#3a5a7a'; ctx.lineWidth=2; ctx.stroke();
  // Jacket button
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0,-34,2.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(0,-27,2.5,0,Math.PI*2); ctx.fill();

  // Arms — stubby and cute
  const armSwing=p.isWalking?Math.sin(p.walkFrame*Math.PI/2+Math.PI)*8:0;
  ctx.fillStyle='#5a7a9a';
  ctx.save(); ctx.translate(-16,-36); ctx.rotate((armSwing*Math.PI)/180);
  ctx.beginPath(); ctx.roundRect(-5,0,10,16,5); ctx.fill();
  ctx.strokeStyle='#3a5a7a'; ctx.lineWidth=1.5; ctx.stroke();
  // Hand
  ctx.fillStyle='#c09888'; ctx.beginPath(); ctx.arc(0,18,6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.fillStyle='#5a7a9a';
  ctx.save(); ctx.translate(16,-36); ctx.rotate((-armSwing*Math.PI)/180);
  ctx.beginPath(); ctx.roundRect(-5,0,10,16,5); ctx.fill();
  ctx.strokeStyle='#3a5a7a'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#c09888'; ctx.beginPath(); ctx.arc(0,18,6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Walkman on belt — cuter with screen
  ctx.fillStyle='#222';
  ctx.beginPath(); ctx.roundRect(-9,-20,18,12,3); ctx.fill();
  ctx.strokeStyle='#444'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#00ccff'; ctx.beginPath(); ctx.roundRect(-6,-18,12,6,2); ctx.fill(); // screen
  ctx.fillStyle='#888';
  ctx.beginPath(); ctx.arc(-2,-14,2,0,Math.PI*2); ctx.arc(4,-14,2,0,Math.PI*2); ctx.fill(); // reels
  // Cable up to headphones
  ctx.strokeStyle='#333'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(4,-20); ctx.bezierCurveTo(12,-28,16,-42,12,-54); ctx.stroke();

  // ── Big cute head ──────────────────────────────────────────
  // Head base — big and round
  ctx.fillStyle='#c09888'; // warm neutral skin
  ctx.beginPath(); ctx.ellipse(0,-58,20,19,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#8a6858'; ctx.lineWidth=2.5; ctx.stroke();

  // Rosy cheeks
  ctx.fillStyle='rgba(220,120,100,0.35)';
  ctx.beginPath(); ctx.ellipse(-12,-60,7,5,0.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12,-60,7,5,-0.2,0,Math.PI*2); ctx.fill();

  // Hair — messy cute chunks
  ctx.fillStyle='#2a1a08';
  ctx.beginPath(); ctx.ellipse(0,-72,18,11,0,Math.PI,Math.PI*2); ctx.fill();
  // Hair tufts sticking up
  ctx.beginPath(); ctx.ellipse(-14,-74,6,8,-0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,-77,5,8,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14,-74,6,8,0.3,0,Math.PI*2); ctx.fill();

  // Big shiny eyes
  const blink = Math.floor(frame/180)%8===0 ? 0.1 : 1; // blink
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.ellipse(-7,-58,7,blink>0.5?7:1,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7,-58,7,blink>0.5?7:1,0,0,Math.PI*2); ctx.fill();
  if(blink>0.5){
    ctx.fillStyle='#3a2010'; // dark brown iris
    ctx.beginPath(); ctx.ellipse(-7,-58,5,5.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7,-58,5,5.5,0,0,Math.PI*2); ctx.fill();
    // Pupils
    ctx.fillStyle='#111';
    ctx.beginPath(); ctx.ellipse(-6,-58,3,3.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8,-58,3,3.5,0,0,Math.PI*2); ctx.fill();
    // Shine
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(-5,-60,1.8,0,Math.PI*2); ctx.arc(9,-60,1.8,0,Math.PI*2); ctx.fill();
  }

  // Small cute nose
  ctx.fillStyle='rgba(160,100,80,0.6)';
  ctx.beginPath(); ctx.ellipse(0,-51,3,2,0,0,Math.PI*2); ctx.fill();

  // Happy mouth / expression
  ctx.strokeStyle='#8a5040'; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.arc(0,-46,6,0.1,Math.PI-0.1); ctx.stroke(); // smile

  // Headphones — big chunky cute ones
  ctx.strokeStyle='#222'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.arc(0,-63,22,Math.PI*1.08,Math.PI*1.92); ctx.stroke();
  // Ear cups — puffy
  ctx.fillStyle='#2a2a3a';
  ctx.beginPath(); ctx.roundRect(-28,-70,12,16,5); ctx.fill();
  ctx.strokeStyle='#444'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(16,-70,12,16,5); ctx.fill(); ctx.stroke();
  // Headphone accent color stripe
  ctx.fillStyle=levels[Math.min(levelIndex,2)].accent;
  ctx.fillRect(-26,-66,8,4); ctx.fillRect(18,-66,8,4);

  // Shield effect
  if (player.shielding) {
    const ac=levels[levelIndex].accent;
    ctx.strokeStyle=ac; ctx.lineWidth=3.5;
    ctx.globalAlpha=Math.sin(frame*0.25)*0.2+0.75;
    ctx.shadowColor=ac; ctx.shadowBlur=22;
    ctx.beginPath(); ctx.ellipse(0,-38,30,56,0,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.10; ctx.fillStyle=ac;
    ctx.beginPath(); ctx.ellipse(0,-38,30,56,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }

  ctx.restore();

  if (player.shieldCooldown>0) {
    const pct=1-player.shieldCooldown/SHIELDCD;
    ctx.fillStyle='#222'; ctx.fillRect(player.x,player.y+player.h+10,player.w,4);
    ctx.fillStyle='#44aaff'; ctx.fillRect(player.x,player.y+player.h+10,player.w*pct,4);
  }
}

// ══════════════════════════════════════════════════════════════
//  DRAW ENEMIES
// ══════════════════════════════════════════════════════════════
function glow(x,y,r,col) {
  ctx.save(); ctx.shadowColor=col; ctx.shadowBlur=14;
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.restore();
}

function drawEnemy() {
  if (!enemy) return;
  const pulse=beatPulse();
  ctx.save();
  if (enemy.hp/enemy.maxHp<0.25&&Math.floor(frame/4)%2===0) ctx.globalAlpha=0.7;
  if (enemy.levelIndex===0) {
    if(enemy.type===0) drawSnake(pulse);
    if(enemy.type===1) drawSpecter(pulse);
    if(enemy.type===2) drawCowboy(pulse);
  } else if (enemy.levelIndex===1) {
    if(enemy.type===0) drawCrawler(pulse);
    if(enemy.type===1) drawPhantom(pulse);
    if(enemy.type===2) drawDJ(pulse);
  } else {
    if(enemy.type===0) drawGargoyle(pulse);
    if(enemy.type===1) drawWraith(pulse);
    if(enemy.type===2) drawDemon(pulse);
  }
  ctx.restore();
  const bx=enemy.x,by=enemy.y-34;
  ctx.fillStyle='#333'; ctx.fillRect(bx,by,enemy.w,10);
  ctx.fillStyle='#ff3333'; ctx.fillRect(bx,by,enemy.w*(enemy.hp/enemy.maxHp),10);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(bx,by,enemy.w,10);
  if (enemy.type===2) {
    [0,1,2].forEach(i=>{
      ctx.fillStyle=i===enemy.phase?levels[levelIndex].accent:'#333';
      ctx.beginPath(); ctx.arc(bx+enemy.w/2-16+i*16,by-10,4,0,Math.PI*2); ctx.fill();
    });
  }
}

function drawSnake(pulse) {
  const ex=enemy.x,ey=enemy.y,segs=6;
  for (let i=segs;i>=0;i--) {
    const sx=ex+i*14,sy=ey+40+Math.sin(enemy.anim*0.14+i*0.7)*10,r=10-i*0.8;
    ctx.fillStyle=`hsl(30,${40+i*5}%,${25+i*3}%)`; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#8a7050'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(sx,sy,r,enemy.anim*0.05+i,enemy.anim*0.05+i+Math.PI*1.5); ctx.stroke();
    if(i%2===0){ctx.fillStyle='#aaa';ctx.beginPath();ctx.arc(sx+r*0.7,sy,2.5,0,Math.PI*2);ctx.fill();}
  }
  const hx=ex-8,hy=ey+38;
  ctx.fillStyle='#6a3a10'; ctx.beginPath(); ctx.ellipse(hx,hy,14,10,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#3a1a00'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#ff8800'; ctx.shadowColor='#ff6600'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.ellipse(hx-5,hy-2,3,4,0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+5,hy-2,3,4,-0.3,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='#ff2200'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(hx,hy+8); ctx.lineTo(hx,hy+18); ctx.moveTo(hx,hy+18); ctx.lineTo(hx-5,hy+26); ctx.moveTo(hx,hy+18); ctx.lineTo(hx+5,hy+26); ctx.stroke();
  const tx=ex+segs*14+10,ty=ey+40;
  ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(tx,ty,8,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#ff8800'; ctx.lineWidth=1;
  [6,4,2].forEach(r=>{ctx.beginPath();ctx.arc(tx,ty,r,0,Math.PI*2);ctx.stroke();});
  if(pulse>0.5) glow(tx,ty,5,'#ff8800');
}

function drawSpecter(pulse) {
  const ex=enemy.x,ey=enemy.y,float=Math.sin(enemy.anim*0.08)*10;
  ctx.globalAlpha=0.84;
  ctx.fillStyle='#3a2008'; ctx.fillRect(ex+4,ey-28+float,44,8); ctx.fillRect(ex+12,ey-46+float,28,20);
  ctx.fillStyle='#c8a000'; ctx.fillRect(ex+4,ey-22+float,44,5);
  ctx.fillStyle='#c8e8c0'; ctx.beginPath(); ctx.ellipse(ex+26,ey-8+float,18,20,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a3a10'; ctx.beginPath(); ctx.ellipse(ex+18,ey-10+float,5,7,0,0,Math.PI*2); ctx.ellipse(ex+34,ey-10+float,5,7,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#88ff44'; ctx.shadowColor='#44ff00'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.arc(ex+18,ey-10+float,3,0,Math.PI*2); ctx.arc(ex+34,ey-10+float,3,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle='#a8d8a0';
  ctx.beginPath(); ctx.moveTo(ex+8,ey+10+float); ctx.lineTo(ex+44,ey+10+float); ctx.lineTo(ex+48,ey+50+float);
  ctx.quadraticCurveTo(ex+36,ey+40+float,ex+26,ey+55+float); ctx.quadraticCurveTo(ex+16,ey+40+float,ex+4,ey+50+float); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(ex-10,ey+10+float); ctx.rotate(Math.sin(enemy.anim*0.06)*0.15);
  ctx.fillStyle='#6a3a00'; ctx.fillRect(-4,-40,8,44);
  ctx.fillStyle='#8b5020'; ctx.beginPath(); ctx.arc(0,-45,18,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c8a000'; ctx.lineWidth=2; ctx.stroke();
  ctx.strokeStyle='#fff'; ctx.lineWidth=1;
  [-6,-2,2,6].forEach(sx=>{ctx.beginPath();ctx.moveTo(sx,-60);ctx.lineTo(sx,4);ctx.stroke();});
  if(pulse>0.4){ctx.strokeStyle='#88ff44';ctx.lineWidth=1.5;ctx.globalAlpha=pulse*0.6;[12,22,32].forEach(r=>{ctx.beginPath();ctx.arc(0,-45,r,0,Math.PI*2);ctx.stroke();});ctx.globalAlpha=0.84;}
  ctx.restore(); ctx.globalAlpha=1;
}

function drawCowboy(pulse) {
  const ex=enemy.x,ey=enemy.y,bob=Math.sin(enemy.anim*0.08)*4,phase=enemy.phase;
  const ec=['#ffcc00','#ff8800','#ff4400'][phase];
  ctx.fillStyle='#4a2a08'; ctx.beginPath(); ctx.ellipse(ex+36,ey-24+bob,52,10,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#5a3410'; ctx.fillRect(ex+8,ey-52+bob,56,30);
  ctx.fillStyle='#4a2a08'; ctx.beginPath(); ctx.ellipse(ex+36,ey-52+bob,28,8,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#8b4010'; ctx.fillRect(ex+8,ey-26+bob,56,6);
  ctx.fillStyle='#c8a000'; ctx.beginPath(); ctx.arc(ex+36,ey-23+bob,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#7a6040'; ctx.beginPath(); ctx.roundRect(ex+6,ey-22+bob,60,46,6); ctx.fill();
  ctx.strokeStyle='#5a4020'; ctx.lineWidth=2; ctx.stroke();
  glow(ex+22,ey-2+bob,9,ec); glow(ex+50,ey-2+bob,9,ec);
  ctx.fillStyle='#2a1a00'; ctx.fillRect(ex+16,ey+16+bob,40,10);
  for(let i=0;i<5;i++){ctx.fillStyle=ec;ctx.fillRect(ex+18+i*7,ey+18+bob,4,6);}
  ctx.strokeStyle='#3a2000'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(ex+16,ey+14+bob); ctx.quadraticCurveTo(ex+22,ey+20+bob,ex+28,ey+14+bob);
  ctx.moveTo(ex+44,ey+14+bob); ctx.quadraticCurveTo(ex+50,ey+20+bob,ex+56,ey+14+bob); ctx.stroke();
  ctx.fillStyle='#6a4020';
  ctx.beginPath(); ctx.ellipse(ex-10,ey+30+bob,20,14,-0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ex+82,ey+30+bob,20,14,0.3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#7a5030'; ctx.fillRect(ex+4,ey+24+bob,64,40);
  ctx.fillStyle='#1a0800'; ctx.beginPath(); ctx.arc(ex+36,ey+44+bob,18,0,Math.PI*2); ctx.fill();
  [18,12,6].forEach((r,i)=>{ctx.strokeStyle=i===0?'#3a2000':ec;ctx.lineWidth=2;ctx.beginPath();ctx.arc(ex+36,ey+44+bob,r,0,Math.PI*2);ctx.stroke();});
  if(pulse>0.5) glow(ex+36,ey+44+bob,8,ec);
  ctx.fillStyle='#6a4020'; ctx.fillRect(ex-22,ey+28+bob,16,36); ctx.fillRect(ex+78,ey+28+bob,16,36);
  const ls=Math.sin(enemy.anim*0.07)*20;
  ctx.save(); ctx.translate(ex+86,ey+56+bob); ctx.rotate((ls*Math.PI)/180);
  ctx.strokeStyle='#c8a050'; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,14); ctx.lineTo(0,30); ctx.stroke(); ctx.restore();
  ctx.fillStyle='#4a2a00'; ctx.fillRect(ex+12,ey+62+bob,16,20); ctx.fillRect(ex+44,ey+62+bob,16,20);
  ctx.fillStyle='#3a1a00';
  ctx.beginPath(); ctx.moveTo(ex+6,ey+80+bob); ctx.lineTo(ex+32,ey+80+bob); ctx.lineTo(ex+36,ey+88+bob); ctx.lineTo(ex+4,ey+88+bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+40,ey+80+bob); ctx.lineTo(ex+66,ey+80+bob); ctx.lineTo(ex+70,ey+88+bob); ctx.lineTo(ex+38,ey+88+bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#c8a000'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(ex+6,ey+87+bob,6,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(ex+68,ey+87+bob,6,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#c8a000'; ctx.fillRect(ex+26,ey+62+bob,20,14);
  ctx.strokeStyle='#8b6000'; ctx.lineWidth=2; ctx.strokeRect(ex+26,ey+62+bob,20,14);
  ctx.fillStyle='#8b6000'; ctx.font='bold 7px monospace'; ctx.textAlign='center';
  ctx.fillText('RR',ex+36,ey+72+bob); ctx.textAlign='left';
}

function drawCrawler(pulse) {
  const ex=enemy.x,ey=enemy.y+30,segs=7;
  for(let i=segs;i>=0;i--){
    const sx=ex+i*13,sy=ey+Math.sin(enemy.anim*0.16+i*0.9)*6,r=11-i*0.6;
    ctx.fillStyle=`hsl(280,${60+i*5}%,${15+i*3}%)`; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#c800ff'; ctx.lineWidth=1; ctx.shadowColor='#c800ff'; ctx.shadowBlur=4+pulse*6;
    ctx.beginPath(); ctx.arc(sx,sy,r*0.6,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;
    if(i%2===0){ctx.strokeStyle='#8800ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,sy+r);ctx.lineTo(sx-8,sy+r+14);ctx.stroke();ctx.beginPath();ctx.moveTo(sx,sy+r);ctx.lineTo(sx+8,sy+r+14);ctx.stroke();}
  }
  const hx=ex-10,hy=ey;
  ctx.fillStyle='#2a0a4a'; ctx.beginPath(); ctx.ellipse(hx,hy,16,12,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c800ff'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(hx,hy,8,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c800ff'; ctx.shadowColor='#c800ff'; ctx.shadowBlur=8+pulse*12;
  [6,4,2].forEach(r=>{ctx.beginPath();ctx.arc(hx,hy,r,0,Math.PI*2);ctx.stroke();}); ctx.shadowBlur=0;
  glow(hx-6,hy-4,3,'#00ffff'); glow(hx+6,hy-4,3,'#00ffff');
}

function drawPhantom(pulse) {
  const ex=enemy.x,ey=enemy.y,float=Math.sin(enemy.anim*0.1)*15;
  ctx.globalAlpha=Math.sin(enemy.anim*0.4+frame*0.3)*0.3+0.7;
  ctx.fillStyle='#a0c8ff';
  ctx.beginPath(); ctx.moveTo(ex+10,ey+float); ctx.lineTo(ex+42,ey+float); ctx.lineTo(ex+48,ey+50+float);
  ctx.quadraticCurveTo(ex+38,ey+38+float,ex+26,ey+56+float); ctx.quadraticCurveTo(ex+14,ey+38+float,ex+4,ey+50+float); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#00ffff'; ctx.lineWidth=2; ctx.shadowColor='#00ffff'; ctx.shadowBlur=10+pulse*12; ctx.stroke(); ctx.shadowBlur=0;
  ctx.fillStyle='#d0e8ff'; ctx.beginPath(); ctx.ellipse(ex+26,ey-8+float,20,22,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,200,255,0.4)'; ctx.beginPath(); ctx.ellipse(ex+26,ey-8+float,16,14,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#00ffff'; ctx.lineWidth=2; ctx.shadowColor='#00ffff'; ctx.shadowBlur=14; ctx.stroke(); ctx.shadowBlur=0;
  glow(ex+18,ey-10+float,5,'#ff00ff'); glow(ex+34,ey-10+float,5,'#ff00ff');
  ctx.strokeStyle='#00ffff'; ctx.lineWidth=2; ctx.shadowColor='#00ffff'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.moveTo(ex+10,ey+15+float); ctx.lineTo(ex-8,ey+22+float); ctx.lineTo(ex-2,ey+30+float); ctx.lineTo(ex-14,ey+40+float); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex+42,ey+15+float); ctx.lineTo(ex+58,ey+22+float); ctx.lineTo(ex+50,ey+30+float); ctx.lineTo(ex+62,ey+40+float); ctx.stroke();
  ctx.shadowBlur=0; ctx.globalAlpha=1;
}

function drawDJ(pulse) {
  const ex=enemy.x,ey=enemy.y,bob=Math.sin(enemy.anim*0.09)*5,phase=enemy.phase;
  const mg=['#00ffcc','#ff8800','#ff00ff'][phase];
  ctx.fillStyle='#1a1a1a'; ctx.fillRect(ex+4,ey-26+bob,64,10); ctx.fillRect(ex+12,ey-44+bob,50,20); ctx.fillRect(ex-8,ey-28+bob,20,6);
  ctx.fillStyle='#2a1a4a'; ctx.beginPath(); ctx.roundRect(ex+4,ey-16+bob,64,58,10); ctx.fill();
  ctx.strokeStyle=mg; ctx.lineWidth=2; ctx.shadowColor=mg; ctx.shadowBlur=8+pulse*12; ctx.stroke(); ctx.shadowBlur=0;
  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.moveTo(ex+8,ey+6+bob); ctx.lineTo(ex+36,ey+6+bob); ctx.lineTo(ex+22,ey+22+bob); ctx.closePath();
  ctx.moveTo(ex+38,ey+6+bob); ctx.lineTo(ex+66,ey+6+bob); ctx.lineTo(ex+50,ey+22+bob); ctx.closePath(); ctx.fill();
  glow(ex+22,ey+12+bob,5,mg); glow(ex+50,ey+12+bob,5,mg);
  ctx.fillStyle=mg; ctx.shadowColor=mg; ctx.shadowBlur=16+pulse*20;
  ctx.beginPath(); ctx.arc(ex+36,ey+35+bob,14,0,Math.PI); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; for(let i=0;i<4;i++) ctx.fillRect(ex+24+i*7,ey+35+bob,5,8);
  ctx.fillStyle='#1a1a3a'; ctx.fillRect(ex,ey+42+bob,72,40); ctx.fillStyle='#111'; ctx.fillRect(ex+22,ey+58+bob,28,18);
  ctx.fillStyle='#2a1a4a'; ctx.fillRect(ex-22,ey+44+bob,20,34); ctx.fillRect(ex+74,ey+44+bob,20,34);
  ctx.strokeStyle='#333'; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(ex+36,ey-16+bob,38,Math.PI*1.1,Math.PI*1.9); ctx.stroke();
  ctx.fillStyle='#555'; ctx.beginPath(); ctx.ellipse(ex,ey-12+bob,11,14,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ex+72,ey-12+bob,11,14,0,0,Math.PI*2); ctx.fill();
}

function drawGargoyle(pulse) {
  const ex=enemy.x,ey=enemy.y,bob=Math.sin(enemy.anim*0.15)*5,wf=Math.sin(enemy.anim*0.18)*20;
  ctx.fillStyle='#3a3a4a';
  ctx.save(); ctx.translate(ex+10,ey+10+bob); ctx.rotate((-wf*Math.PI)/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-50,-20); ctx.lineTo(-55,10); ctx.lineTo(-35,30); ctx.lineTo(-10,20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#5a5a6a'; ctx.lineWidth=1; ctx.stroke();
  [-40,-30,-20].forEach(wx=>{ctx.strokeStyle='#2a2a3a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(wx,20);ctx.stroke();}); ctx.restore();
  ctx.save(); ctx.translate(ex+40,ey+10+bob); ctx.rotate((wf*Math.PI)/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(50,-20); ctx.lineTo(55,10); ctx.lineTo(35,30); ctx.lineTo(10,20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#5a5a6a'; ctx.lineWidth=1; ctx.stroke();
  [40,30,20].forEach(wx=>{ctx.strokeStyle='#2a2a3a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(wx,20);ctx.stroke();}); ctx.restore();
  ctx.fillStyle='#4a4a5a'; ctx.beginPath(); ctx.roundRect(ex+4,ey+8+bob,40,36,6); ctx.fill();
  ctx.strokeStyle='#6a6a7a'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex+24,ey+26+bob,14,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#ff2200'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=8+pulse*14;
  [12,8,4].forEach(r=>{ctx.beginPath();ctx.arc(ex+24,ey+26+bob,r,0,Math.PI*2);ctx.stroke();}); ctx.shadowBlur=0;
  ctx.fillStyle='#4a4a5a'; ctx.beginPath(); ctx.roundRect(ex+8,ey-18+bob,32,28,4); ctx.fill();
  ctx.strokeStyle='#6a6a7a'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#3a3a4a';
  ctx.beginPath(); ctx.moveTo(ex+10,ey-16+bob); ctx.lineTo(ex+4,ey-38+bob); ctx.lineTo(ex+16,ey-16+bob); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+38,ey-16+bob); ctx.lineTo(ex+44,ey-38+bob); ctx.lineTo(ex+32,ey-16+bob); ctx.fill();
  glow(ex+16,ey-8+bob,5,'#ff2200'); glow(ex+32,ey-8+bob,5,'#ff2200');
  ctx.fillStyle='#1a1a1a'; ctx.fillRect(ex+12,ey+2+bob,24,10);
  ctx.fillStyle='#fff'; [ex+14,ex+20,ex+26,ex+30].forEach(fx=>ctx.fillRect(fx,ey+2+bob,4,8));
  ctx.fillStyle='#3a3a4a'; ctx.fillRect(ex+6,ey+42+bob,14,10); ctx.fillRect(ex+28,ey+42+bob,14,10);
  ctx.fillStyle='#555';
  [-3,3,9].forEach(cx2=>{
    ctx.beginPath(); ctx.moveTo(ex+8+cx2,ey+52+bob); ctx.lineTo(ex+6+cx2,ey+62+bob); ctx.lineTo(ex+12+cx2,ey+52+bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex+30+cx2,ey+52+bob); ctx.lineTo(ex+28+cx2,ey+62+bob); ctx.lineTo(ex+34+cx2,ey+52+bob); ctx.fill();
  });
}

function drawWraith(pulse) {
  const ex=enemy.x,ey=enemy.y,float=Math.sin(enemy.anim*0.09)*12,waver=Math.sin(enemy.anim*0.06);
  ctx.globalAlpha=0.88;
  ctx.fillStyle='rgba(40,0,0,0.4)';
  for(let i=1;i<=4;i++){ctx.beginPath();ctx.ellipse(ex+24,ey+60+float+i*6,18-i*2,8-i,0,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#1a0808';
  ctx.beginPath(); ctx.moveTo(ex+4,ey+10+float); ctx.lineTo(ex+44,ey+10+float); ctx.lineTo(ex+52,ey+65+float);
  for(let i=0;i<5;i++){const tx=ex+52-i*12,ty=ey+65+float;ctx.lineTo(tx-4,ty+12+Math.sin(enemy.anim*0.1+i)*6);ctx.lineTo(tx-8,ty);}
  ctx.closePath(); ctx.fill(); ctx.strokeStyle='#330000'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.save(); ctx.translate(ex+36,ey+28+float); ctx.rotate(waver*0.1);
  ctx.fillStyle='#2a0000'; ctx.beginPath(); ctx.ellipse(0,15,14,18,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,-5,10,14,0,0,Math.PI*2); ctx.fill(); ctx.fillRect(-3,-30,6,32);
  ctx.strokeStyle='#ff2200'; ctx.shadowColor='#ff2200'; ctx.shadowBlur=10+pulse*14; ctx.lineWidth=1.5;
  [-4,-1,2,5].forEach(sx=>{ctx.beginPath();ctx.moveTo(sx,-30);ctx.lineTo(sx,20);ctx.stroke();}); ctx.shadowBlur=0; ctx.restore();
  ctx.fillStyle='#d8c8c0'; ctx.beginPath(); ctx.ellipse(ex+24,ey-10+float,18,20,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#8a5040'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#1a0000'; ctx.beginPath(); ctx.ellipse(ex+16,ey-12+float,6,7,0,0,Math.PI*2); ctx.ellipse(ex+32,ey-12+float,6,7,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff2200'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(ex+16,ey-12+float,3,0,Math.PI*2); ctx.arc(ex+32,ey-12+float,3,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='#d8c8c0'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(ex+10,ey+4+float); ctx.lineTo(ex+20,ey+10+float); ctx.lineTo(ex+28,ey+8+float); ctx.lineTo(ex+38,ey+4+float); ctx.stroke();
  ctx.globalAlpha=1;
}

function drawDemon(pulse) {
  const ex=enemy.x,ey=enemy.y,bob=Math.sin(enemy.anim*0.07)*6,phase=enemy.phase;
  const fc=['#ff6600','#ff2200','#ff0066'][phase],wf=Math.sin(enemy.anim*0.08)*15;
  ctx.fillStyle='#2a1a1a';
  ctx.save(); ctx.translate(ex+10,ey+20+bob); ctx.rotate((-wf*Math.PI)/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-80,-40); ctx.lineTo(-90,0); ctx.lineTo(-60,40); ctx.lineTo(-10,30); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=fc; ctx.lineWidth=1; ctx.shadowColor=fc; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;
  [-60,-40,-20].forEach(wx=>{ctx.strokeStyle='#1a0808';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(wx,28);ctx.stroke();}); ctx.restore();
  ctx.save(); ctx.translate(ex+62,ey+20+bob); ctx.rotate((wf*Math.PI)/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(80,-40); ctx.lineTo(90,0); ctx.lineTo(60,40); ctx.lineTo(10,30); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=fc; ctx.lineWidth=1; ctx.shadowColor=fc; ctx.shadowBlur=6; ctx.stroke(); ctx.shadowBlur=0;
  [60,40,20].forEach(wx=>{ctx.strokeStyle='#1a0808';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(wx,28);ctx.stroke();}); ctx.restore();
  ctx.fillStyle='#2a1a1a';
  ctx.beginPath(); ctx.moveTo(ex+8,ey-18+bob); ctx.lineTo(ex-26,ey-72+bob); ctx.lineTo(ex+14,ey-28+bob); ctx.fill();
  ctx.beginPath(); ctx.moveTo(ex+64,ey-18+bob); ctx.lineTo(ex+98,ey-72+bob); ctx.lineTo(ex+58,ey-28+bob); ctx.fill();
  ctx.strokeStyle=fc; ctx.lineWidth=2; ctx.shadowColor=fc; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.moveTo(ex+8,ey-18+bob); ctx.lineTo(ex-26,ey-72+bob); ctx.moveTo(ex+64,ey-18+bob); ctx.lineTo(ex+98,ey-72+bob); ctx.stroke(); ctx.shadowBlur=0;
  ctx.fillStyle='#3a2828'; ctx.beginPath(); ctx.roundRect(ex+4,ey-22+bob,64,52,8); ctx.fill();
  ctx.strokeStyle='#5a3838'; ctx.lineWidth=2; ctx.stroke();
  glow(ex+18,ey+0+bob,10,fc); glow(ex+54,ey+0+bob,10,fc);
  ctx.fillStyle='#1a0000'; ctx.beginPath(); ctx.moveTo(ex+14,ey+22+bob); ctx.lineTo(ex+58,ey+22+bob); ctx.lineTo(ex+54,ey+32+bob); ctx.lineTo(ex+18,ey+32+bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle=fc; ctx.shadowColor=fc; ctx.shadowBlur=10+pulse*12; ctx.beginPath(); ctx.arc(ex+36,ey+24+bob,8,0,Math.PI); ctx.fill(); ctx.shadowBlur=0;
  ctx.fillStyle='#c8c0b8'; [ex+18,ex+26,ex+36,ex+46].forEach(fx=>ctx.fillRect(fx,ey+22+bob,6,11));
  ctx.fillStyle='#3a2828'; ctx.fillRect(ex,ey+30+bob,72,52);
  ctx.strokeStyle=fc; ctx.lineWidth=2; ctx.shadowColor=fc; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.moveTo(ex+36,ey+38+bob); ctx.lineTo(ex+28,ey+50+bob); ctx.lineTo(ex+44,ey+50+bob); ctx.closePath(); ctx.stroke(); ctx.shadowBlur=0;
  const gs=Math.sin(enemy.anim*0.06)*14;
  ctx.save(); ctx.translate(ex+8,ey+48+bob); ctx.rotate((gs*Math.PI)/180);
  ctx.fillStyle='#3a0000'; ctx.beginPath(); ctx.ellipse(-22,12,24,20,-0.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#5a0000'; ctx.beginPath(); ctx.ellipse(-22,-8,17,15,-0.4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#2a0000'; ctx.fillRect(-8,-52,9,56);
  ctx.shadowColor=fc; ctx.shadowBlur=18+pulse*24; ctx.strokeStyle=fc; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-26,2); ctx.bezierCurveTo(-44,-14,-20,-26,-26,-40); ctx.stroke(); ctx.shadowBlur=0; ctx.restore();
  ctx.fillStyle='#3a2828'; ctx.fillRect(ex-22,ey+32+bob,20,40); ctx.fillRect(ex+74,ey+32+bob,20,40);
  ctx.fillStyle='#2a1a1a';
  [0,7,14].forEach(ox=>{
    ctx.beginPath(); ctx.moveTo(ex-22+ox,ey+70+bob); ctx.lineTo(ex-26+ox,ey+84+bob); ctx.lineTo(ex-18+ox,ey+70+bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex+74+ox,ey+70+bob); ctx.lineTo(ex+70+ox,ey+84+bob); ctx.lineTo(ex+78+ox,ey+70+bob); ctx.fill();
  });
  ctx.fillStyle='#3a2828'; ctx.fillRect(ex+8,ey+80+bob,20,18); ctx.fillRect(ex+44,ey+80+bob,20,18);
  ctx.fillStyle='#2a1a1a';
  [0,8,16].forEach(ox=>{
    ctx.beginPath(); ctx.moveTo(ex+8+ox,ey+96+bob); ctx.lineTo(ex+4+ox,ey+108+bob); ctx.lineTo(ex+12+ox,ey+96+bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ex+44+ox,ey+96+bob); ctx.lineTo(ex+40+ox,ey+108+bob); ctx.lineTo(ex+48+ox,ey+96+bob); ctx.fill();
  });
}

function drawEBullets() {
  const lvl=levels[levelIndex];
  eBullets.forEach(b=>{
    ctx.save(); ctx.translate(b.x,b.y); ctx.shadowColor=b.kind==='deflected'?'#44aaff':lvl.accent; ctx.shadowBlur=10;
    if(b.kind==='single'){ctx.strokeStyle=lvl.accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();}
    else if(b.kind==='spread'){ctx.fillStyle=lvl.accent;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(7,0);ctx.lineTo(0,7);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();}
    else if(b.kind==='deflected'){ctx.fillStyle='#44aaff';ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();}
    else{ctx.fillStyle=lvl.accent;ctx.fillRect(-8,-4,16,8);ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(-8,-4,16,8);}
    ctx.restore();
  });
}

function drawPBullets() {
  const lvl=levels[levelIndex];
  player.bullets.forEach(b=>{
    ctx.save(); ctx.translate(b.x,b.y);
    ctx.fillStyle=lvl.accent; ctx.shadowColor=lvl.accent; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.ellipse(0,0,5,4,-0.4,0,Math.PI*2); ctx.fill();
    ctx.fillRect(4,-10,2,10); ctx.beginPath(); ctx.moveTo(6,-10); ctx.quadraticCurveTo(14,-6,8,-2); ctx.fill();
    ctx.restore();
  });
}

// ══════════════════════════════════════════════════════════════
//  HUD
// ══════════════════════════════════════════════════════════════
function drawHUD() {
  const lvl=levels[levelIndex],bName=battleNames[levelIndex][battleIndex]||'';
  const hpPct=player.hp/player.maxHp;
  ctx.fillStyle='#222'; ctx.fillRect(20,18,180,14);
  ctx.fillStyle=hpPct>0.5?'#44dd66':hpPct>0.25?'#ffaa00':'#ff3333';
  ctx.fillRect(20,18,180*hpPct,14);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.strokeRect(20,18,180,14);
  ctx.fillStyle='#fff'; ctx.font='11px monospace'; ctx.fillText('HP',22,30);
  ctx.fillStyle=lvl.accent; ctx.font='bold 14px monospace'; ctx.textAlign='center';
  ctx.shadowColor=lvl.accent; ctx.shadowBlur=8; ctx.fillText(bName,W/2,30); ctx.shadowBlur=0; ctx.textAlign='left';
  if(tokens.length>0){ctx.font='16px monospace';ctx.fillStyle='#fff';ctx.fillText(tokens.join(' '),20,52);}
  ctx.textAlign='center';
  for(let i=0;i<3;i++){ctx.fillStyle=i<battleIndex?lvl.accent:i===battleIndex?'#fff':'#444';ctx.beginPath();ctx.arc(W/2-20+i*20,46,5,0,Math.PI*2);ctx.fill();}
  ctx.textAlign='left';
  if(player.shielding){
    // Active shield — show how long it lasts
    const pct=1-(player.shieldDuration/SHIELDMAX);
    ctx.fillStyle='#888';ctx.font='9px monospace';ctx.fillText('SHIELD ACTIVE',20,H-26);
    ctx.fillStyle='#222';ctx.fillRect(20,H-22,120,8);
    ctx.fillStyle='#44aaff';ctx.fillRect(20,H-22,120*pct,8);
    ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(20,H-22,120,8);
  } else if(player.shieldCooldown>0){
    // Cooldown — show recharge
    const pct=1-player.shieldCooldown/SHIELDCD;
    ctx.fillStyle='#888';ctx.font='9px monospace';ctx.fillText('SHIELD',20,H-26);
    ctx.fillStyle='#222';ctx.fillRect(20,H-22,120,8);
    ctx.fillStyle='#2266aa';ctx.fillRect(20,H-22,120*pct,8);
    ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.strokeRect(20,H-22,120,8);
  } else {
    // Ready
    ctx.fillStyle='#44aaff';ctx.font='9px monospace';ctx.fillText('SHIELD READY [Z]',20,H-22);
  }
  if(nowPlaying){
    const s = nowPlaying.song;
    const lnp = levels[s.levelIndex] || levels[0];
    ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.roundRect(10,H-52,294,40,8); ctx.fill();
    ctx.strokeStyle=lnp.accent; ctx.lineWidth=1.5; ctx.shadowColor=lnp.accent; ctx.shadowBlur=5; ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle=lnp.accent; ctx.beginPath(); ctx.arc(28,H-32,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(28,H-32,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='bold 10px monospace'; ctx.fillText((s.title||'').slice(0,26),44,H-38);
    ctx.fillStyle='#aaa'; ctx.font='9px monospace'; ctx.fillText(s.artist||'',44,H-24);
  }
  drawLibBtn(); checkLibBtn();
}

// ══════════════════════════════════════════════════════════════
//  SONG NOTIF
// ══════════════════════════════════════════════════════════════
function drawNotif() {
  if(!songNotif) return;
  songNotif.timer--;
  if(songNotif.timer<=0){songNotif=null;return;}
  const s=songNotif.song,lvl=levels[s.levelIndex];
  const alpha=songNotif.timer<45?songNotif.timer/45:songNotif.timer>270?(320-songNotif.timer)/50:1;
  const bx=W-315,by=68;
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.roundRect(bx,by,295,74,10); ctx.fill();
  ctx.strokeStyle=lvl.accent; ctx.lineWidth=2; ctx.shadowColor=lvl.accent; ctx.shadowBlur=8; ctx.stroke(); ctx.shadowBlur=0;
  const ax=bx+10,ay=by+10,as=52;
  ctx.fillStyle=lvl.albumColors[0]; ctx.fillRect(ax,ay,as,as);
  ctx.strokeStyle=lvl.albumColors[1]; ctx.lineWidth=2;
  [20,14,8,4].forEach(r=>{ctx.beginPath();ctx.arc(ax+as/2,ay+as/2,r,0,Math.PI*2);ctx.stroke();});
  ctx.fillStyle=lvl.albumColors[2]; ctx.beginPath(); ctx.arc(ax+as/2,ay+as/2,4,0,Math.PI*2); ctx.fill();
  ctx.font='15px serif'; ctx.textAlign='center'; ctx.fillText(lvl.tokenIcon,ax+as/2,ay+as/2-8);
  ctx.textAlign='left';
  ctx.fillStyle=lvl.accent; ctx.font='bold 11px monospace';
  ctx.fillText(s.isBonus ? '★  Bonus Find!' : '♪  Song Unlocked!', bx+72, by+22);
  ctx.fillStyle='#fff'; ctx.font='bold 12px monospace';
  ctx.fillText(s.title.length>23?s.title.slice(0,23)+'…':s.title,bx+72,by+40);
  ctx.fillStyle='#aaa'; ctx.font='10px monospace'; ctx.fillText(s.artist+' ('+s.year+')',bx+72,by+58);
  ctx.restore();
}

// Tap-to-play button — shown after earning a song
// This is the ONLY way to trigger audio.play() safely across all browsers
// because it fires directly inside the canvas click handler
// ══════════════════════════════════════════════════════════════
//  LIBRARY
// ══════════════════════════════════════════════════════════════
function drawLibrary() {
  ctx.fillStyle='rgba(0,0,0,0.94)'; ctx.fillRect(0,0,W,H);

  // Header (fixed, not scrolled)
  const closeHot=isHovered(W-46,8,38,34);
  ctx.fillStyle=closeHot?'#cc2200':'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.roundRect(W-46,8,38,34,6); ctx.fill();
  ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 18px monospace'; ctx.textAlign='center'; ctx.fillText('✕',W-27,30);
  if(wasClicked(W-46,8,38,34)){gameState=prevState; libScrollY=0;}

  ctx.fillStyle='#fff'; ctx.font='bold 20px monospace'; ctx.fillText('📼  YOUR PLAYLIST',W/2,38);
  ctx.fillStyle='#444'; ctx.font='10px monospace'; ctx.fillText('scroll to browse  •  ✕ or ESC to close',W/2,54);
  ctx.textAlign='left';

  if(earnedSongs.length===0){
    ctx.fillStyle='#666';ctx.font='14px monospace';ctx.textAlign='center';
    ctx.fillText('No songs yet — beat some enemies!',W/2,H/2);
    ctx.textAlign='left';return;
  }

  // Clipping region for scrollable content
  const contentTop = 62;
  const rowH = 64;
  const totalRows = Math.ceil(earnedSongs.length / 2);
  const totalContentH = totalRows * rowH + 10;
  const maxScroll = Math.max(0, totalContentH - (H - contentTop));
  libScrollY = Math.min(libScrollY, maxScroll);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, contentTop, W, H - contentTop);
  ctx.clip();

  earnedSongs.forEach((s,i)=>{
    const lvl=levels[s.levelIndex],row=Math.floor(i/2),col=i%2;
    const x=28+col*390, y=contentTop+row*rowH - libScrollY;

    // Skip rows fully outside view
    if (y + rowH < contentTop || y > H) return;

    const hot=isHovered(x,y,366,rowH-6);
    ctx.fillStyle=hot?'#242424':'#1a1a1a'; ctx.beginPath(); ctx.roundRect(x,y,366,rowH-6,8); ctx.fill();
    ctx.strokeStyle=lvl.accent; ctx.lineWidth=1.5; if(hot){ctx.shadowColor=lvl.accent;ctx.shadowBlur=6;} ctx.stroke(); ctx.shadowBlur=0;

    const vx=x+8,vy=y+7,vs=46;
    ctx.fillStyle=lvl.albumColors[0]; ctx.fillRect(vx,vy,vs,vs);
    ctx.strokeStyle=lvl.albumColors[1]; ctx.lineWidth=2;
    [18,12,6].forEach(r=>{ctx.beginPath();ctx.arc(vx+vs/2,vy+vs/2,r,0,Math.PI*2);ctx.stroke();});
    ctx.fillStyle=lvl.albumColors[2]; ctx.beginPath(); ctx.arc(vx+vs/2,vy+vs/2,3,0,Math.PI*2); ctx.fill();
    ctx.font='13px serif'; ctx.textAlign='center'; ctx.fillText(lvl.tokenIcon,vx+vs/2,vy+vs/2-8);

    ctx.textAlign='left';
    ctx.fillStyle=lvl.accent; ctx.font='bold 10px monospace'; ctx.fillText(lvl.name.toUpperCase(),x+66,y+18);
    if(s.isBonus){
      ctx.fillStyle='#ffcc00'; ctx.font='bold 9px monospace'; ctx.fillText('★ BONUS',x+66+ctx.measureText(lvl.name.toUpperCase()).width+8,y+18);
    }
    ctx.fillStyle='#fff'; ctx.font='bold 12px monospace'; ctx.fillText(s.title.length>25?s.title.slice(0,25)+'…':s.title,x+66,y+34);
    ctx.fillStyle='#888'; ctx.font='10px monospace'; ctx.fillText(s.artist+' ('+s.year+')',x+66,y+50);

    // Play button — shows loading state if URL not yet fetched
    const isPlaying = nowPlaying && nowPlaying.song === s;
    const isLoading = s._loading;
    const btnLabel  = isPlaying ? '■' : isLoading ? '…' : '▶';
    const btnColor  = isPlaying ? '#ff4444' : isLoading ? '#888' : lvl.accent;
    drawBtn(btnLabel, x+328, y+14, 30, 26, btnColor);
    if(hadClick && clickX>x+328 && clickX<x+358 && clickY>y+14 && clickY<y+40){
      if (isPlaying) { _stopPreview(); restartBGAfterSong(); }
      else if (!isLoading) { playLibrarySong(s); }
    }
  });

  ctx.restore();

  // Scrollbar if needed
  if (maxScroll > 0) {
    const sbH = H - contentTop;
    const thumbH = Math.max(30, sbH * (sbH / totalContentH));
    const thumbY = contentTop + (libScrollY / maxScroll) * (sbH - thumbH);
    ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(W-8, contentTop, 6, sbH);
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.roundRect(W-8,thumbY,6,thumbH,3); ctx.fill();
  }
}

// ══════════════════════════════════════════════════════════════
//  KNOCKOUT + WIN
// ══════════════════════════════════════════════════════════════
function drawKnockout() {
  knockoutTimer--;
  ctx.fillStyle='rgba(80,0,0,0.82)'; ctx.fillRect(0,0,W,H);
  const p=Math.sin(frame*0.08)*0.14+1;
  ctx.save(); ctx.translate(W/2,H/2-65); ctx.scale(p,p);
  ctx.fillStyle='#ff2200'; ctx.font='bold 70px monospace'; ctx.textAlign='center';
  ctx.shadowColor='#ff0000'; ctx.shadowBlur=28; ctx.fillText('✖',0,0); ctx.restore(); ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.font='bold 28px monospace'; ctx.textAlign='center'; ctx.fillText('KNOCKED OUT',W/2,H/2+8);
  ctx.fillStyle='#ff9999'; ctx.font='15px monospace'; ctx.fillText('Restarting this battle...',W/2,H/2+36);
  const bw=260,prog=knockoutTimer/180;
  ctx.fillStyle='#333'; ctx.fillRect(W/2-bw/2,H/2+56,bw,12);
  ctx.fillStyle='#ff4444'; ctx.fillRect(W/2-bw/2,H/2+56,bw*prog,12);
  ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(W/2-bw/2,H/2+56,bw,12);
  drawBtn('Restart Now',W/2-70,H/2+82,140,36,'#ff4444'); ctx.textAlign='left';
  if(knockoutTimer<=0||wasClicked(W/2-70,H/2+82,140,36)) resetBattle();
}

function drawWin() {
  ctx.fillStyle='rgba(0,0,0,0.92)'; ctx.fillRect(0,0,W,H);
  const p=Math.sin(frame*0.06)*0.1+1;
  ctx.save(); ctx.translate(W/2,110); ctx.scale(p,p);
  ctx.fillStyle='#ffdd00'; ctx.font='bold 48px monospace'; ctx.textAlign='center';
  ctx.shadowColor='#ffaa00'; ctx.shadowBlur=24; ctx.fillText('YOU ESCAPED!',0,0); ctx.restore(); ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.font='18px monospace'; ctx.textAlign='center';
  ctx.fillText('All 3 Genre Tokens collected',W/2,175); ctx.fillText(tokens.join('  '),W/2,208);
  ctx.fillStyle='#aaa'; ctx.font='13px monospace'; ctx.fillText(`${earnedSongs.length} songs in your playlist`,W/2,244);
  drawBtn('▶  PLAY AGAIN',W/2-90,282,180,44,'#ffdd00');
  drawBtn('HOME',W/2-60,342,120,40,'#888888');
  if(wasClicked(W/2-90,282,180,44)){levelIndex=0;battleIndex=0;tokens=[];earnedSongs=[];shufflePools();stopDeezer();gameState='levelIntro';levelIntroAge=0;}
  if(wasClicked(W/2-60,342,120,40)){levelIndex=0;battleIndex=0;tokens=[];gameState='home';stopDeezer();}
  ctx.textAlign='left';
}

// ══════════════════════════════════════════════════════════════
//  GAME STATE TRANSITIONS
// ══════════════════════════════════════════════════════════════
function battleWon() {
  awardSong(levelIndex,battleIndex); battleIndex++;
  showTransition(`${battleNames[levelIndex][battleIndex-1]} defeated!`);
}
function playerDied() { player.hp=0; gameState='knockout'; knockoutTimer=180; sfxDeath(); stopDeezer(); }
function resetBattle() {
  player.hp=100;player.x=120;player.y=GROUND-player.h;player.vy=0;player.vx=0;
  player.bullets=[];player.invincible=0;player.shielding=false;player.shieldCooldown=0;player.shieldDuration=0;player._zHeld=false;
  enemy=buildEnemy(); eBullets=[]; musicBubbles=[]; gameState='playing';
  // Start pre-fetching the reward song URL while the battle runs
  prefetchNextSong();
}

// ══════════════════════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════════════════════
function update() {
  frame++;
  if(gameState==='playing'&&!bgOn) startBG();
  if(gameState==='home'&&bgOn) stopBG();
  // Intro music on intro + home screens
  if((gameState==='intro'||gameState==='home')&&!introMusicOn) startIntroMusic();
  if(gameState!=='intro'&&gameState!=='home'&&introMusicOn) stopIntroMusic();

  switch(gameState) {
    case 'playing': handleInput();physics();updateBullets();updateEnemy();checkStomp();updatePlayerAnim();updateBubbles(); break;
    case 'knockout': physics(); break;
  }

  // DRAW
  ctx.clearRect(0,0,W,H);
  switch(gameState) {
    case 'intro':      drawIntro(); break;
    case 'home':       drawHome(); break;
    case 'levelIntro': drawLevelIntro(); break;
    case 'transition': drawTransition();drawTapHint(); break;
    case 'playing':    drawBG();drawEnemy();drawEBullets();drawBubbles();drawPlayer();drawPBullets();drawHUD();drawNotif();drawTapHint(); break;
    case 'knockout':   drawBG();drawEnemy();drawPlayer();drawHUD();drawKnockout();drawTapHint(); break;
    case 'library':    drawBG();drawLibrary(); break;
    case 'win':        drawWin(); break;
  }

  // Reset click state at END of frame — after all draw functions consumed it
  hadClick  = false;
  clickX    = -999;
  clickY    = -999;

  requestAnimationFrame(update);
}

// ── INIT ─────────────────────────────────────────────────────
shufflePools();
shuffleBubblePools();
enemy = buildEnemy();
update();
