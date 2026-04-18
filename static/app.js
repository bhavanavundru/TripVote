// ─── STATE ────────────────────────────────────────────────────
const API = 'http://localhost:5000/api';
let currentTripId = null;
let selectedOptions = { budget: null, vibe: null, duration: null };
let voterName = null;

// ─── ROUTING ──────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Check URL for trip ID on load
window.addEventListener('load', () => {
  const path = window.location.pathname;
  const match = path.match(/^\/trip\/([a-zA-Z0-9]+)$/);
  if (match) {
    currentTripId = match[1];
    navigate('questionnaire');
  } else {
    navigate('home');
  }
});

// ─── TOAST ────────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── CREATE TRIP ──────────────────────────────────────────────
async function createTrip() {
  const name = document.getElementById('trip-name').value.trim();
  const creator = document.getElementById('creator-name').value.trim();
  if (!name || !creator) { toast('Please fill in both fields!'); return; }

  const res = await fetch(`${API}/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, creator })
  });
  const data = await res.json();
  currentTripId = data.trip_id;

  const shareUrl = `${window.location.origin}/trip/${data.trip_id}`;
  document.getElementById('share-link-text').textContent = shareUrl;
  navigate('share');
  toast('Trip created! 🎉');
}

// ─── COPY LINK ────────────────────────────────────────────────
function copyLink() {
  const text = document.getElementById('share-link-text').textContent;
  navigator.clipboard.writeText(text).then(() => toast('Link copied! 📋'));
}

// ─── REFRESH RESPONSE COUNT ───────────────────────────────────
async function refreshCount() {
  if (!currentTripId) return;
  const res = await fetch(`${API}/trips/${currentTripId}`);
  const data = await res.json();
  document.getElementById('response-count').textContent = data.response_count || 0;
  toast(`${data.response_count} response(s) so far`);
}

// ─── OPTION SELECTION ─────────────────────────────────────────
function selectOption(type, groupId, btn, value) {
  selectedOptions[type] = value;
  document.querySelectorAll(`#${groupId}-options .option-btn`)
    .forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// ─── SUBMIT QUESTIONNAIRE ─────────────────────────────────────
async function submitQuestionnaire() {
  const name = document.getElementById('q-name').value.trim();
  const notes = document.getElementById('q-notes').value.trim();

  if (!name) { toast('Please enter your name!'); return; }
  if (!selectedOptions.budget) { toast('Please pick a budget!'); return; }
  if (!selectedOptions.vibe) { toast('Please pick a vibe!'); return; }
  if (!selectedOptions.duration) { toast('Please pick a duration!'); return; }

  voterName = name;

  const res = await fetch(`${API}/trips/${currentTripId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      budget: selectedOptions.budget,
      vibe: selectedOptions.vibe,
      duration: selectedOptions.duration,
      notes
    })
  });
  const data = await res.json();
  if (data.success) {
    toast('Preferences saved! 🎉');
    showThankYou();
  }
}

function showThankYou() {
  const page = document.getElementById('page-questionnaire');
  page.innerHTML = `
    <div class="form-container">
      <div style="text-align:center;padding:4rem 2rem">
        <div style="font-size:4rem;margin-bottom:1.5rem">🎉</div>
        <div class="success-badge" style="margin-bottom:1rem">✓ Submitted!</div>
        <h2 style="font-family:var(--font-display);font-size:2rem;font-weight:700;margin-bottom:1rem">
          You're all set!
        </h2>
        <p style="color:var(--text-muted);line-height:1.6">
          Your preferences have been saved. The trip organiser will share the results once everyone has responded.
        </p>
      </div>
    </div>`;
}

// ─── GET AI SUGGESTIONS ───────────────────────────────────────
async function getSuggestions() {
  toast('AI is thinking... 🧠');
  const res = await fetch(`${API}/trips/${currentTripId}/suggest`, { method: 'POST' });
  const data = await res.json();
  renderDestinations(data.suggestions);
  navigate('suggestions');
}

// ─── RENDER DESTINATIONS ──────────────────────────────────────
const EMOJIS = {
  'Bali, Indonesia': '🌴', 'Santorini, Greece': '🏛️', 'Maldives': '🏝️',
  'Phuket, Thailand': '🏖️', 'Amalfi Coast, Italy': '⛵',
  'Swiss Alps, Switzerland': '🏔️', 'Himalayas, Nepal': '🗻',
  'Dolomites, Italy': '⛰️', 'Patagonia, Argentina': '🌄', 'Rocky Mountains, USA': '🦅',
  'Tokyo, Japan': '🗼', 'Paris, France': '🥐', 'New York, USA': '🗽',
  'Barcelona, Spain': '🎨', 'Istanbul, Turkey': '🕌',
  'New Zealand': '🐑', 'Costa Rica': '🦜', 'Iceland': '🌋',
  'Peru': '🦙', 'South Africa': '🦁',
  'Kyoto, Japan': '⛩️', 'Marrakech, Morocco': '🕌', 'Rome, Italy': '🏟️',
  'Cairo, Egypt': '🐪', 'Varanasi, India': '🪔',
  'Lisbon, Portugal': '🛤️', 'Vienna, Austria': '🎻', 'Seoul, South Korea': '🌸',
  'Amsterdam, Netherlands': '🚲', 'Buenos Aires, Argentina': '💃'
};

function renderDestinations(destinations) {
  const grid = document.getElementById('destinations-grid');
  grid.innerHTML = destinations.map(dest => `
    <div class="dest-card" id="card-${dest.replace(/\W+/g,'-')}">
      <div class="dest-emoji">${EMOJIS[dest] || '✈️'}</div>
      <div class="dest-name">${dest}</div>
      <button class="dest-vote-btn" onclick="castVote('${dest}', this)">Vote for this →</button>
    </div>
  `).join('');
}

// ─── CAST VOTE ────────────────────────────────────────────────
async function castVote(destination, btn) {
  if (!voterName) {
    voterName = prompt('Enter your name to vote:') || 'Anonymous';
  }

  const res = await fetch(`${API}/trips/${currentTripId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination, voter: voterName })
  });
  const data = await res.json();

  // Mark all cards, highlight voted one
  document.querySelectorAll('.dest-card').forEach(c => c.classList.remove('voted'));
  btn.closest('.dest-card').classList.add('voted');
  toast(`Voted for ${destination}! 🗳️`);

  loadResults();
}

// ─── LOAD RESULTS ─────────────────────────────────────────────
async function loadResults() {
  const res = await fetch(`${API}/trips/${currentTripId}/results`);
  const data = await res.json();

  const totalVotes = Object.values(data.votes).reduce((a, b) => a + b, 0);
  const voteBars = document.getElementById('vote-bars');
  const voteResultsEl = document.getElementById('vote-results');
  const winnerEl = document.getElementById('winner-display');

  voteBars.innerHTML = data.suggestions.map(dest => {
    const count = data.votes[dest] || 0;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return `
      <div class="vote-bar-row">
        <div class="vote-bar-label"><span>${EMOJIS[dest] || '✈️'} ${dest}</span><span>${count} vote${count !== 1 ? 's' : ''}</span></div>
        <div class="vote-bar-track"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  if (data.winner) {
    winnerEl.innerHTML = `🏆 Current leader: ${data.winner}`;
  }

  voteResultsEl.style.display = 'block';
}
