// main.js (replace your existing main.js with this)
import { db } from './firebase-config.js';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Houses & criteria (kept same as before)
const HOUSES = ['Aravali', 'Nilgiri', 'Shivalik', 'Udaigiri'];
const CRITERIA = [
  { key: 'decoration', label: 'Display House Decoration', max: 20 },
  { key: 'items', label: 'Display Items & Belongings', max: 20 },
  { key: 'dorm', label: 'Cleanliness Inside Dorm', max: 10 },
  { key: 'fanTube', label: 'Status of Fan & Tube', max: 10 },
  { key: 'footpath', label: 'Cleanliness of Surrounding Footpath', max: 10 },
  { key: 'grass', label: 'Cleanliness of Grass & Bushes', max: 10 },
  { key: 'surrounding', label: 'Cleanliness of Surrounding', max: 20 }
];

// DOM elements
const housesContainer = document.getElementById('housesContainer');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const judgeNameDisplay = document.getElementById('judgeNameDisplay');
const categorySelect = document.getElementById('categorySelect');

const judgeName = localStorage.getItem('judgeName') || '';
const judgeId = localStorage.getItem('judgeId') || ''; // important!

// If no judge logged in, redirect
if (!judgeName || !judgeId) {
  alert('Please login first as a judge.');
  window.location.href = 'login.html';
}

// show judge name
if (judgeNameDisplay) judgeNameDisplay.textContent = judgeName;

// Disable submit initially
if (submitBtn) submitBtn.disabled = true;

// Create select DOM for a criterion
function createSelect(id, max) {
  const sel = document.createElement('select');
  sel.className = 'form-select form-select-sm';
  sel.id = id;
  for (let i = 0; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    sel.appendChild(opt);
  }
  return sel;
}

// Create one house card
function createHouseCard(house) {
  const col = document.createElement('div');
  col.className = 'col-12 col-md-6';

  const card = document.createElement('div');
  card.className = 'card p-3 house-card';

  const header = document.createElement('div');
  header.className = 'd-flex justify-content-between align-items-center mb-2';
  header.innerHTML = `<h5 class="mb-0">${house}</h5>
    <div class="badge bg-secondary total-badge" id="${house}-total">Total: 0</div>`;

  const body = document.createElement('div');
  CRITERIA.forEach(c => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-2';

    const label = document.createElement('label');
    label.className = 'form-label mb-1 small';
    label.textContent = `${c.label} (${c.max}M)`;

    const sel = createSelect(`${house}-${c.key}`, c.max);
    sel.addEventListener('change', () => {
      updateHouseTotal(house);
      checkIfCanSubmit();
    });

    wrapper.appendChild(label);
    wrapper.appendChild(sel);
    body.appendChild(wrapper);
  });

  card.appendChild(header);
  card.appendChild(body);
  col.appendChild(card);
  return col;
}

// Render form
function renderForm() {
  housesContainer.innerHTML = '';
  HOUSES.forEach(house => housesContainer.appendChild(createHouseCard(house)));
}
renderForm();

// Update total for a house
function updateHouseTotal(house) {
  const totalEl = document.getElementById(`${house}-total`);
  let sum = 0;
  CRITERIA.forEach(c => {
    const sel = document.getElementById(`${house}-${c.key}`);
    sum += parseInt(sel.value || '0', 10);
  });
  if (totalEl) totalEl.textContent = `Total: ${sum}`;
}

// Enable submit only if all > 0 and category selected
function checkIfCanSubmit() {
  if (!submitBtn) return;
  if (!judgeName || !judgeId) {
    submitBtn.disabled = true;
    return;
  }
  if (!categorySelect || !categorySelect.value) {
    submitBtn.disabled = true;
    return;
  }
  for (const house of HOUSES) {
    for (const c of CRITERIA) {
      const val = Number(document.getElementById(`${house}-${c.key}`)?.value || 0);
      if (val === 0) {
        submitBtn.disabled = true;
        return;
      }
    }
  }
  submitBtn.disabled = false;
}

// ---------- CLEAR SELECTIONS ----------
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    const selects = document.querySelectorAll('#scoresForm select');
    selects.forEach(s => { s.value = "0"; });

    HOUSES.forEach(h => updateHouseTotal(h));
    if (submitBtn) submitBtn.disabled = true;

    alert('Selections cleared.');
  });
}

// ---------- Safety check on load: prevent new judges when limit reached ----------
async function checkJudgeLimitOnLoad() {
  try {
    const judgesSnapshot = await getDocs(collection(db, 'judges'));
    // If there are >= 3 judges, only allow submission if current judge is one of them
    if (judgesSnapshot.size >= 3) {
      const isRegistered = judgesSnapshot.docs.some(d => d.id === judgeId || (d.data() && d.data().name === judgeName));
      if (!isRegistered) {
        alert("❌ 3 judges have already registered. Submissions are closed.");
        submitBtn.disabled = true;
      }
    }
  } catch (err) {
    console.error("Error checking judges limit on load:", err);
  }
}
checkJudgeLimitOnLoad();

// ---------- SUBMIT ----------
const scoresForm = document.getElementById('scoresForm');
if (scoresForm) {
  scoresForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Category check
    const category = (categorySelect && categorySelect.value) ? categorySelect.value.trim().toLowerCase() : '';
    if (!category) {
      alert('Please select a category');
      return;
    }

    // Ensure judgeId present
    if (!judgeId) {
      alert('Judge not found. Please login again.');
      window.location.href = 'login.html';
      return;
    }

    // Ensure all inputs filled
    for (const house of HOUSES) {
      for (const c of CRITERIA) {
        const val = Number(document.getElementById(`${house}-${c.key}`)?.value || 0);
        if (val === 0) {
          alert(`Please enter marks for all fields. Missing: ${house} - ${c.label}`);
          return;
        }
      }
    }

    // Safety: check judges count again and ensure this judge is allowed (server-side check is recommended)
    try {
      const judgesSnapshot = await getDocs(collection(db, 'judges'));
      if (judgesSnapshot.size >= 3) {
        const isRegistered = judgesSnapshot.docs.some(d => d.id === judgeId || (d.data() && d.data().name === judgeName));
        if (!isRegistered) {
          alert("❌ 3 judges have already registered. Submissions are closed.");
          return;
        }
      }
    } catch (err) {
      console.error('Error verifying judges count:', err);
      alert('Error verifying judges count. Try again.');
      return;
    }

    // Build payload: nested `scores` object per house (keeps per-judge doc compact)
    const housesObj = {};
    HOUSES.forEach(house => {
      const hobj = {};
      let total = 0;
      CRITERIA.forEach(c => {
        const val = Number(document.getElementById(`${house}-${c.key}`).value);
        // Use canonical keys that results.js will understand (normalize handles variants)
        hobj[c.key] = val;
        total += val;
      });
      hobj.total = total;
      housesObj[house] = hobj;
    });

    // Use a deterministic doc id: `${category}_${judgeId}` so each judge can submit exactly once per category.
    const docId = `${category}_${judgeId}`;
    const docRef = doc(db, 'scores', docId);

    try {
      // Check if this judge already submitted for this category
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        alert('You have already submitted scores for this category.');
        return;
      }

      // Save the per-judge doc (one doc per judge per category)
      const payload = {
        judge: judgeName,
        judgeId,
        category,
        scores: housesObj,
        timestamp: new Date()
      };

      await setDoc(docRef, payload);

      alert('Scores submitted successfully ✅');

      // Reset UI
      renderForm();
      if (categorySelect) categorySelect.value = '';
      checkIfCanSubmit();

    } catch (err) {
      console.error('Error submitting scores:', err);
      alert('Error saving scores: ' + (err.message || err));
    }
  });
}

// Initialize totals
HOUSES.forEach(h => updateHouseTotal(h));
checkIfCanSubmit();
