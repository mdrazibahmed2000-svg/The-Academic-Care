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
const loginCard = document.getElementById("loginCard");
const registerCard = document.getElementById("registerCard");
const studentDashboard = document.getElementById("studentDashboard");
const adminPanel = document.getElementById("adminPanel");
const idOrRoleInput = document.getElementById("idOrRoleInput");
const adminAuthFields = document.getElementById("adminAuthFields");
const loginBtn = document.getElementById("loginBtn");
const authError = document.getElementById("authError");

function showRegister() {
  loginCard.classList.add("hidden");
  registerCard.classList.remove("hidden");
  adminAuthFields.style.display = 'none';
  idOrRoleInput.value = "";
  authError.textContent = "";
}

function showLogin() {
  registerCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
  authError.textContent = "";
}

function logout() {
  auth.signOut().then(() => {
    currentStudent = "";
    studentDashboard.classList.add("hidden");
    adminPanel.classList.add("hidden");
    showLogin();
  }).catch((error) => {
    console.error("Logout Error:", error);
  });
}

// Event listener to show/hide admin email/password fields
idOrRoleInput.addEventListener('input', function() {
  if (this.value.toLowerCase() === 'admin') {
    adminAuthFields.style.display = 'block';
  } else {
    adminAuthFields.style.display = 'none';
  }
});

loginBtn.addEventListener('click', login);


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

// ===================== LOGIN ===================== //
function login() {
  const idOrRole = idOrRoleInput.value.trim();
  authError.textContent = "";

  if (idOrRole.toLowerCase() === "admin") {
    // Admin Login using Firebase Authentication
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value.trim();
    
    if (!email || !password) return authError.textContent = "Please enter admin email and password.";

    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Check if the user is the designated admin
        if (userCredential.user.email === ADMIN_EMAIL) { 
          loginCard.classList.add("hidden");
          adminPanel.classList.remove("hidden");
          loadAdminPanel();
        } else {
          auth.signOut();
          authError.textContent = "❌ Not authorized as admin.";
        }
      })
      .catch((error) => {
        authError.textContent = `❌ Admin Login Failed: ${error.message}`;
      });
    return;
  }

  // Student Login (Approved student ID)
  db.ref("students/" + idOrRole).once("value").then(s => {
    if (!s.exists()) return authError.textContent = "❌ Invalid Student ID!";
    const data = s.val();
    if (data.status !== "approved") return authError.textContent = "⏳ Your account is pending approval or not approved.";

    currentStudent = idOrRole;
    loginCard.classList.add("hidden");
    studentDashboard.classList.remove("hidden");
    document.getElementById("studentName").textContent =
      `${data.name} (ID: ${currentStudent}, Class ${data.class}, Roll ${data.roll})`;
    loadStudentDashboard(idOrRole);
  });
}

// ===================== ADMIN PANEL FUNCTIONS ===================== //
function loadAdminPanel() {
  // Listener to update pending/approved students in real-time
  db.ref("students").on("value", s => { 
    const data = s.val() || {};
    let pending = "", approved = "";
    for (let id in data) {
      const st = data[id];
      if (st.status === "pending")
        pending += `<li>${st.name} (${st.class}-${st.roll}) <button onclick="approveStudent('${id}')" class='btn bg-green-500 hover:bg-green-600 text-white text-xs'>Approve</button></li>`;
      else if (st.status === "approved")
        approved += `<li>${st.name} (${st.class}-${st.roll}) (${id})</li>`;
    }
    document.getElementById("pendingStudents").innerHTML = pending || "<li>No pending students.</li>";
    document.getElementById("approvedStudents").innerHTML = approved || "<li>No approved students.</li>";
    loadStudentDropdown(data);
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

function loadStudentDropdown(data) {
  const dropdown = document.getElementById("studentSelector");
  let html = '<option value="">Select Approved Student</option>';
  
  for (let id in data)
      if (data[id].status === "approved")
        html += `<option value="${id}">${data[id].name} (${id})</option>`;
  
  const currentSelected = dropdown.value;
  dropdown.innerHTML = html;
  if (currentSelected && dropdown.querySelector(`option[value="${currentSelected}"]`)) {
    dropdown.value = currentSelected;
    loadMonthlyFees(); 
  } else {
    document.getElementById("monthlyFees").innerHTML = "<li>Select a student to view fees.</li>";
  }
}

// ===================== FEES MANAGEMENT ===================== //
function loadMonthlyFees() {
  const id = document.getElementById("studentSelector").value;
  if (!id) return document.getElementById("monthlyFees").innerHTML = "<li>Select a student</li>";
  
  db.ref("students/" + id + "/fees").off(); // Stop listening to previous student
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
      <li class="fee-item" style="border-left-color:${color}">
        <span><b>${month}</b> — <span style="color:${color};font-weight:bold;">${status}</span></span>
        <div class="space-x-1">
          <button class="btn bg-blue-500 hover:bg-blue-600 text-white text-xs" onclick="markPaid('${id}','${month}')">Paid</button>
          <button class="btn bg-orange-500 hover:bg-orange-600 text-white text-xs" onclick="markBreak('${id}','${month}')">Break</button>
          <button class="btn bg-gray-500 hover:bg-gray-600 text-white text-xs" onclick="undoPayment('${id}','${month}')">Undo</button>
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
      const statusClass = `status-${fees[m].status.toLowerCase()}`;
      html += `<li>${m}: <span class="${statusClass}">${fees[m].status}</span></li>`;
    }
    html += "</ul>";
    document.getElementById("studentFees").innerHTML = html;
  });
}

// Initial authentication state check (handles admin persistence after refresh)
auth.onAuthStateChanged((user) => {
  if (user && user.email === ADMIN_EMAIL) {
    loginCard.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    loadAdminPanel();
  } else {
    // Ensure a clean state when unauthorized or logged out
    studentDashboard.classList.add("hidden");
    adminPanel.classList.add("hidden");
    if (!loginCard.classList.contains('hidden')) {
      loginCard.classList.remove("hidden");
    }
  }
});
