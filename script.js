// ===================== FIREBASE CONFIGURATION ===================== //
var firebaseConfig = {
  apiKey: "YOUR_API_KEY", // <-- REPLACE WITH YOUR API KEY
  authDomain: "the-academic-care.firebaseapp.com",
  databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "the-academic-care",
  storageBucket: "the-academic-care.appspot.com",
  messagingSenderId: "728354914429",
  appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();
var auth = firebase.auth(); 
var currentStudent = "";

// Set your Admin Email here (must match the user in Firebase Auth and Security Rules)
const ADMIN_EMAIL = 'your-admin-email@example.com'; // <-- REPLACE THIS

// ===================== DOM Elements and Navigation ===================== //
const loginPage = document.getElementById("login-page");
const registerPage = document.getElementById("register-page");
const studentDashboard = document.getElementById("dashboard");
const adminPanel = document.getElementById("admin-panel");
const idOrRoleInput = document.getElementById("studentId");
const adminAuthFields = document.getElementById("adminFields");
const authError = document.getElementById("loginError");

// Utility function for clean page switching
function showPage(pageElement) {
  [loginPage, registerPage, studentDashboard, adminPanel].forEach(p => {
    if (p) { // Check if element exists before trying to access classList
      p.classList.remove("active");
      p.classList.add("hidden");
    }
  });
  if (pageElement) {
    pageElement.classList.remove("hidden");
    pageElement.classList.add("active");
  }
}

function showRegister() {
  showPage(registerPage);
}

function showLogin() {
  showPage(loginPage);
  adminAuthFields.classList.add('hidden'); // Ensure admin fields are hidden
  idOrRoleInput.value = "";
  authError.textContent = "";
}

function logout() {
  auth.signOut().then(() => {
    currentStudent = "";
    showLogin();
    // Clean up database listeners
    db.ref("students").off();
  }).catch((error) => {
    console.error("Logout Error:", error);
  });
}

// Event listener to toggle admin fields (must be outside the login function)
document.addEventListener('DOMContentLoaded', () => {
  if (idOrRoleInput && adminAuthFields) {
    idOrRoleInput.addEventListener('input', function() {
      const val = this.value.trim().toLowerCase();
      adminAuthFields.classList.toggle('hidden', val !== 'admin');
    });
  }
});

// ===================== REGISTER ===================== //
function registerStudent() {
  const name = document.getElementById("regName").value.trim();
  const cls = document.getElementById("regClass").value.trim();
  const roll = document.getElementById("regRoll").value.trim();
  const guardian = document.getElementById("regGuardian").value.trim();

  if (!name || !cls || !roll || !guardian) return alert("Please fill all fields for registration.");

  const year = new Date().getFullYear().toString().substring(2); 
  const id = "S" + year + cls.padStart(2, '0') + roll.padStart(2, '0');

  db.ref("students/" + id).set({
    name, class: cls, roll, guardian, status: "pending"
  }, err => {
    if (err) alert("Error during registration: " + err);
    else {
      alert("✅ Registration successful! Your ID is: " + id + ". Please wait for admin approval to log in.");
      showLogin();
    }
  });
}

// ===================== LOGIN (MODIFIED & CORRECTED) ===================== //
function login() {
  const id = document.getElementById("studentId").value.trim();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();
  const err = document.getElementById("loginError");
  err.textContent = "";

  // ---------- ADMIN LOGIN ----------
  if (id.toLowerCase() === "admin") {
    if (!email || !password) {
      err.textContent = "Please enter admin email and password.";
      return;
    }

    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Check if the user is the designated admin
        if (userCredential.user.email === ADMIN_EMAIL) {
          showPage(adminPanel);
          loadAdminPanel();
        } else {
          auth.signOut();
          err.textContent = "❌ Not authorized as admin.";
        }
      })
      .catch(e => err.textContent = `❌ Admin Login Failed: ${e.message}`);
    return;
  }

  // ---------- STUDENT LOGIN (FIXED: Added .catch() for error handling) ----------
  db.ref("students/" + id).once("value").then(s => {
    if (!s.exists()) return err.textContent = "❌ Invalid ID!";
    const data = s.val();
    if (data.status !== "approved") return err.textContent = "⏳ Awaiting approval.";

    currentStudent = id;
    showPage(studentDashboard);
    document.getElementById("studentName").textContent =
      `${data.name} (ID: ${currentStudent}, Class ${data.class}, Roll ${data.roll})`;

    loadStudentDashboard(id);
  })
  .catch(error => {
    // THIS CATCH IS CRUCIAL. It stops the silent failure from security rules or network issues.
    console.error("Student Login Error:", error);
    err.textContent = "❌ Login failed. Check Student ID or contact admin.";
  });
}

// ===================== ADMIN PANEL FUNCTIONS ===================== //
function loadAdminPanel() {
  db.ref("students").on("value", s => { 
    const data = s.val() || {};
    let pending = "", approved = "";
    const studentSelector = document.getElementById("studentSelector");
    let selectorOptions = '<option value="">Select Student</option>';

    for (let id in data) {
      const st = data[id];
      if (st.status === "pending")
        pending += `<li>${st.name} (${st.class}-${st.roll}) <button onclick="approveStudent('${id}')" class='bg-green-500 hover:bg-green-600 text-white text-xs'>Approve</button></li>`;
      else if (st.status === "approved") {
        approved += `<li>${st.name} (${st.class}-${st.roll}) (${id})</li>`;
        selectorOptions += `<option value="${id}">${st.name} (${id})</option>`;
      }
    }
    document.getElementById("pendingStudents").innerHTML = pending || "<li>No pending students.</li>";
    document.getElementById("approvedStudents").innerHTML = approved || "<li>No approved students.</li>";
    studentSelector.innerHTML = selectorOptions;

    if (studentSelector.value) loadMonthlyFees();
  });
}

function approveStudent(id) {
  db.ref("students/" + id + "/status").set("approved", () => {
    initializeMonthlyFees(id);
    alert("Approved! ID: " + id + ". Monthly fees initialized.");
  });
}

function initializeMonthlyFees(id) {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const obj = {};
  months.forEach(m => obj[m] = { status: "UNPAID" });
  db.ref("students/" + id + "/fees").set(obj);
}

function loadMonthlyFees() {
  const id = document.getElementById("studentSelector").value;
  const monthlyFeesContainer = document.getElementById("monthlyFees");
  if (!id) return monthlyFeesContainer.innerHTML = "<li>Select a student</li>";
  
  db.ref("students/" + id + "/fees").off();
  db.ref("students/" + id + "/fees").on("value", s => renderPayments(id, s.val() || {}));
}

function renderPayments(id, data) {
  const container = document.getElementById("monthlyFees");
  container.innerHTML = "";
  for (let month in data) {
    const info = data[month];
    const status = info.status || "UNPAID";
    const color = status === "PAID" ? "#10b981" : status === "BREAK" ? "#f97316" : "#ef4444";

    container.innerHTML += `
      <li class="fee-item" style="border-left: 4px solid ${color};">
        <span><b>${month}</b> — <span style="color:${color};font-weight:bold;">${status}</span></span>
        <div class="space-x-1">
          <button class="bg-blue-500 hover:bg-blue-600 text-white text-xs" onclick="markPaid('${id}','${month}')">Paid</button>
          <button class="bg-orange-500 hover:bg-orange-600 text-white text-xs" onclick="markBreak('${id}','${month}')">Break</button>
          <button class="bg-gray-500 hover:bg-gray-600 text-white text-xs" onclick="undoPayment('${id}','${month}')">Undo</button>
        </div>
      </li>`;
  }
}

function markPaid(id, month) {
  const method = prompt(`Enter payment method for ${month}:`);
  if (!method) return;
  db.ref(`students/${id}/fees/${month}`).set({
    status: "PAID",
    method,
    recordedBy: auth.currentUser ? auth.currentUser.email : "admin",
    timestamp: new Date().toISOString()
  });
}

function markBreak(id, month) {
  const reason = prompt(`Enter reason for break in ${month}:`);
  if (!reason) return;
  db.ref(`students/${id}/fees/${month}`).set({
    status: "BREAK",
    reason,
    recordedBy: auth.currentUser ? auth.currentUser.email : "admin",
    timestamp: new Date().toISOString()
  });
}

function undoPayment(id, month) {
  if (!confirm(`Are you sure you want to undo the payment/break status for ${month}?`)) return;
  db.ref(`students/${id}/fees/${month}`).set({ status: "UNPAID" });
}

// ===================== STUDENT DASHBOARD ===================== //
function loadStudentDashboard(id) {
  db.ref("students/" + id + "/fees").on("value", s => {
    const fees = s.val() || {};
    let html = "<ul>";
    for (let m in fees) {
      const statusClass = `status-${(fees[m].status || 'UNPAID').toLowerCase()}`;
      html += `<li>${m}: <span class="${statusClass}">${fees[m].status || 'UNPAID'}</span></li>`;
    }
    html += "</ul>";
    document.getElementById("studentFees").innerHTML = html;
  });
}

// Initial state check (handles admin persistence after refresh)
auth.onAuthStateChanged((user) => {
  if (user && user.email === ADMIN_EMAIL) {
    showPage(adminPanel);
    loadAdminPanel();
  } else if (loginPage && !loginPage.classList.contains('active')) {
    // If not admin and not already on a page, revert to login page
    showPage(loginPage);
  }
});
