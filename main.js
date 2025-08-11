import { db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Houses & criteria
const HOUSES = ['Aravali', 'Nilgiri', 'Shivalik', 'Udaigiri'];
const CRITERIA = [
  { key: 'decoration', label: 'Display House Decoration', max: 20 },
  { key: 'items', label: 'Display Items & Belongings', max: 20 },
  { key: 'inside_clean', label: 'Cleanliness Inside Dorm', max: 10 },
  { key: 'fan_tube', label: 'Status of Fan & Tube', max: 10 },
  { key: 'footpath', label: 'Cleanliness of Surrounding Footpath', max: 10 },
  { key: 'grass', label: 'Cleanliness of Grass & Bushes', max: 10 },
  { key: 'surrounding', label: 'Cleanliness of Surrounding', max: 20 }
];

// DOM elements
const housesContainer = document.getElementById('housesContainer');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const judgeNameDisplay = document.getElementById('judgeNameDisplay');

const judgeName = localStorage.getItem('judgeName') || 'Unknown Judge';
if (judgeNameDisplay) judgeNameDisplay.textContent = judgeName;

// Disable submit if judge missing
if (submitBtn) submitBtn.disabled = (judgeName === 'Unknown Judge');

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

// Enable submit only if all > 0
function checkIfCanSubmit() {
  if (!submitBtn) return;
  if (judgeName === 'Unknown Judge') {
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

// ---------- CHECK JUDGE LIMIT ON PAGE LOAD ----------
async function checkJudgeLimitOnLoad() {
  try {
    const judgesSnapshot = await getDocs(collection(db, 'judges_scores'));
    if (judgesSnapshot.size >= 3) {
      alert("⚠️ 3 judges have already submitted results. Submissions are now closed.");
      if (submitBtn) submitBtn.disabled = true;
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

    if (!judgeName || judgeName === 'Unknown Judge') {
      alert('Judge not found. Please login again.');
      window.location.href = 'login.html';
      return;
    }

    // Check all fields filled
    for (const house of HOUSES) {
      for (const c of CRITERIA) {
        const val = Number(document.getElementById(`${house}-${c.key}`)?.value || 0);
        if (val === 0) {
          alert(`Please enter marks for all fields. Missing: ${house} - ${c.label}`);
          return;
        }
      }
    }

    // 🔹 NEW: Check if 3 judges have already submitted
    try {
      const judgesSnapshot = await getDocs(collection(db, 'judges_scores'));
      if (judgesSnapshot.size >= 3) {
        alert("❌ Only 3 judges can submit results. Submissions are now closed.");
        return;
      }
    } catch (err) {
      console.error("Error checking judges limit:", err);
      alert("Error verifying judges count. Please try again.");
      return;
    }

    const housesObj = {};
    HOUSES.forEach(house => {
      const hobj = {};
      let total = 0;
      CRITERIA.forEach(c => {
        const val = Number(document.getElementById(`${house}-${c.key}`).value);
        hobj[c.key] = val;
        total += val;
      });
      hobj.total = total;
      housesObj[house] = hobj;
    });

    const docId = judgeName.replace(/\s+/g, '_').toLowerCase();
    const payload = { judge: judgeName, houses: housesObj, timestamp: serverTimestamp() };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      await setDoc(doc(db, 'judges_scores', docId), payload);
      alert('Scores saved successfully ✅');

      // Reset scores to 0
      HOUSES.forEach(house => {
        CRITERIA.forEach(c => {
          document.getElementById(`${house}-${c.key}`).value = 0;
        });
      });

    } catch (err) {
      console.error(err);
      alert('Error saving scores: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Scores';
    }
  });
}

// Initialize totals
HOUSES.forEach(h => updateHouseTotal(h));
checkIfCanSubmit();
