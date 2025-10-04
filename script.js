// ====================================================================
// 1. FIREBASE INITIALIZATION AND SERVICE REFERENCES
// ====================================================================

// NOTE: REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
};

// Initialize Firebase App
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase Services (Compatibility + Modular Destructuring)
const auth = firebase.auth();
const db = firebase.database();
const { ref, set, get, onValue, remove } = firebase.database; 

// Global variables for tracking state and modal context
let currentStudentData = null;
let allStudentsData = {};
let currentStudentId = null;
let modalContext = {}; // Stores {studentId, monthKey, action} for the modal

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// ====================================================================
// 2. AUTHENTICATION AND NAVIGATION
// ====================================================================

/**
 * Ensures the correct panel is shown on load based on authentication status.
 * This is why your initial view is the login page when nobody is signed in.
 */
auth.onAuthStateChanged(user => {
    if (user) {
        const isAdmin = user.providerData.some(p => p.providerId === 'password');
        
        if (isAdmin) {
            initializeAdminPanel();
        } else {
            currentStudentId = localStorage.getItem('appLoginId');
            if (currentStudentId) {
                fetchStudentData(currentStudentId);
            } else {
                auth.signOut();
                showAuthContainer();
            }
        }
    } else {
        // This runs when the user is signed out, showing the login page (1000008430.jpg)
        showAuthContainer();
    }
});

async function fetchStudentData(studentId) {
    try {
        const studentRef = ref(db, `students/${studentId}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists() && snapshot.val().status === 'approved') {
            currentStudentData = snapshot.val();
            initializeStudentPanel(currentStudentData);
        } else {
            auth.signOut(); 
            localStorage.removeItem('appLoginId');
            showAuthContainer();
        }
    } catch (error) {
        console.error("Fetch Student Data Error:", error);
        auth.signOut();
        localStorage.removeItem('appLoginId');
        showAuthContainer();
    }
}

async function handleStudentLogin() {
    const studentIdInput = document.getElementById("student-id-input").value.toUpperCase().trim();
    const messageEl = document.getElementById("student-login-message");
    messageEl.innerText = "";
    if (!studentIdInput) {
        messageEl.innerText = "Please enter your Student ID.";
        return;
    }

    try {
        // Sign in anonymously and check if the student ID is valid and approved
        await auth.signInAnonymously();
        
        const studentRef = ref(db, `students/${studentIdInput}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists() && snapshot.val().status === 'approved') {
            currentStudentData = snapshot.val();
            currentStudentId = studentIdInput;
            localStorage.setItem('appLoginId', studentIdInput);
            
            initializeStudentPanel(currentStudentData);
        } else {
            messageEl.innerText = "Student ID not found or approval pending.";
            auth.signOut(); 
        }

    } catch (error) {
        console.error("Student Login Error:", error);
        messageEl.innerText = `Login failed: ${error.message}`;
    }
}

async function handleAdminLogin() {
    const email = document.getElementById("admin-email-input").value;
    const password = document.getElementById("admin-password-input").value;
    const messageEl = document.getElementById("admin-login-message");

    try {
        await auth.signInWithEmailAndPassword(email, password);
        messageEl.innerText = "Admin login successful.";
        initializeAdminPanel();
    } catch (error) {
        console.error("Admin Login Error:", error);
        messageEl.innerText = `Login failed: ${error.message}`;
    }
}

function logout() {
    auth.signOut();
    localStorage.removeItem('appLoginId');
    currentStudentData = null;
    currentStudentId = null;
    allStudentsData = {};
    showAuthContainer();
}

// ====================================================================
// 3. UI MANAGEMENT AND RENDERING
// ====================================================================

function showAuthContainer() {
    document.querySelectorAll('.panel').forEach(el => el.style.display = 'none');
    document.getElementById('auth-container').style.display = 'block';
    document.getElementById("student-login-message").innerText = "";
    document.getElementById("admin-login-message").innerText = "";
}

function showRegistrationForm() {
    document.querySelectorAll('.panel').forEach(el => el.style.display = 'none');
    document.getElementById('registration-container').style.display = 'block';
}

function initializeStudentPanel(studentData) {
    document.querySelectorAll('.panel').forEach(el => el.style.display = 'none');
    document.getElementById('student-panel').style.display = 'block';
    
    document.getElementById('student-name-display').innerText = studentData.name;
    document.getElementById('student-status-display').innerText = studentData.status.toUpperCase();
    
    loadStudentPayments(studentData.id);

    const breakMonthSelect = document.getElementById('break-month-select');
    breakMonthSelect.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
}

async function initializeAdminPanel() {
    document.querySelectorAll('.panel').forEach(el => el.style.display = 'none');
    const adminPanel = document.getElementById('admin-panel');
    adminPanel.style.display = 'block';
    
    document.getElementById('auth-uid-display').innerText = auth.currentUser.email || auth.currentUser.uid + ' (Admin)';
    
    await fetchAllStudents();
    renderStudentList(allStudentsData);
}

// ====================================================================
// 4. DATA FETCHING AND LIST RENDERING (ADMIN)
// ====================================================================

async function fetchAllStudents() {
    const studentsRef = ref(db, 'students');
    try {
        const snapshot = await get(studentsRef);
        allStudentsData = snapshot.val() || {};
    } catch (error) {
        console.error("Error fetching all students:", error);
        allStudentsData = {};
    }
}

function renderStudentList(students) {
    const container = document.getElementById('student-list-container');
    const studentIds = Object.keys(students);
    
    if (studentIds.length === 0) {
        container.innerHTML = "<p>No student records found.</p>";
        return;
    }
    
    const html = studentIds.map(id => {
        const student = students[id];
        return `
            <div onclick="renderAdminFeeManagement('${id}')">
                <strong>${student.id}</strong> - ${student.name} (${student.status.toUpperCase()})
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function filterStudents() {
    const searchTerm = document.getElementById('admin-search-input').value.toLowerCase();
    const filteredStudents = {};
    
    for (const id in allStudentsData) {
        const student = allStudentsData[id];
        if (id.toLowerCase().includes(searchTerm) || student.name.toLowerCase().includes(searchTerm)) {
            filteredStudents[id] = student;
        }
    }
    renderStudentList(filteredStudents);
}

// ====================================================================
// 5. MODAL MANAGEMENT (Replaces prompt())
// ====================================================================

/**
 * Opens the modal for payment or break reason input.
 */
function openActionModal(studentId, monthKey, action) {
    if (!checkAdminWritePermission()) return;

    modalContext = { studentId, monthKey, action };
    const modal = document.getElementById('payment-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const inputEl = document.getElementById('modal-input');
    const confirmBtn = modal.querySelector('.modal-buttons button:last-child');

    if (action === 'paid') {
        titleEl.innerText = 'Mark PAID';
        messageEl.innerText = `Mark ${monthKey} as PAID for ${studentId}. Enter Payment Method:`;
        inputEl.placeholder = "Cash, Bank Transfer, Bkash, etc.";
        inputEl.value = "";
        confirmBtn.setAttribute('onclick', 'confirmPayment()');
    } else if (action === 'break') {
        titleEl.innerText = 'Mark BREAK';
        messageEl.innerText = `Mark ${monthKey} as BREAK for ${studentId}. Enter Reason (Optional):`;
        inputEl.placeholder = "Reason (e.g., Vacation, Exam)";
        inputEl.value = "";
        confirmBtn.setAttribute('onclick', 'confirmBreak()');
    }
    
    modal.style.display = 'block';
    inputEl.focus();
}

function closeModal() {
    document.getElementById('payment-modal').style.display = 'none';
    modalContext = {};
}

/**
 * Handles confirmation from the modal for payment action.
 */
function confirmPayment() {
    const { studentId, monthKey } = modalContext;
    const method = document.getElementById('modal-input').value.trim();
    
    if (method === "") {
        alert("Payment method cannot be empty.");
        return;
    }
    closeModal();
    markFeeStatus(studentId, monthKey, 'PAID', { method });
}

/**
 * Handles confirmation from the modal for break action.
 */
function confirmBreak() {
    const { studentId, monthKey } = modalContext;
    const reason = document.getElementById('modal-input').value.trim();
    
    closeModal();
    markFeeStatus(studentId, monthKey, 'BREAK', { reason });
}

// ====================================================================
// 6. FEE MANAGEMENT (ADMIN - Logic)
// ====================================================================

function checkAdminWritePermission() {
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        alert("Permission Denied: Only authenticated administrators can perform this action.");
        return false;
    }
    return true;
}

async function renderAdminFeeManagement(studentId) {
    if (!checkAdminWritePermission()) return;
    
    currentStudentId = studentId;
    const container = document.getElementById("payments-container");
    container.innerHTML = `<p>Loading fee data for ${studentId}...</p>`;

    try {
        const feesRef = ref(db, `students/${studentId}/fees`);
        const snapshot = await get(feesRef);
        const feesData = snapshot.val() || {}; 

        let html = `
            <h3>Fee Status: ${studentId} - ${allStudentsData[studentId]?.name || 'Student'}</h3>
            <table class="fee-table">
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Status</th>
                        <th>Info</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        months.forEach(month => {
            const feeRecord = feesData[month];
            const status = feeRecord?.status || "PENDING";
            let paymentInfo = "N/A";
            let actionButtons = '';
            
            let statusClass = "pending";
            if (status === "PAID") {
                statusClass = "paid";
                const date = new Date(feeRecord.timestamp).toLocaleDateString();
                paymentInfo = `Paid on ${date} via ${feeRecord.method} (by ${feeRecord.recordedBy})`;
            } else if (status === "BREAK") {
                statusClass = "break";
                const date = new Date(feeRecord.timestamp).toLocaleDateString();
                paymentInfo = `On break since ${date} (by ${feeRecord.recordedBy})`;
            }

            if (status === "PENDING") {
                // Using the new modal function
                actionButtons = `
                    <button class="fee-action-btn" onclick="openActionModal('${studentId}', '${month}', 'paid')">Mark Paid</button>
                    <button class="fee-action-btn" onclick="openActionModal('${studentId}', '${month}', 'break')">Mark Break</button>
                `;
            } else {
                actionButtons = `
                    <button class="fee-action-btn" onclick="undoStatus('${studentId}', '${month}')">Undo Status</button>
                `;
            }

            html += `
                <tr>
                    <td>${month}</td>
                    <td class="${statusClass}">${status}</td>
                    <td>${paymentInfo}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (error) {
        console.error("Error rendering fee management:", error);
        container.innerHTML = `<p style="color:red;">Error loading fee data: ${error.message}</p>`;
    }
}

/**
 * Generic function to mark fee status.
 */
async function markFeeStatus(studentId, monthKey, status, data = {}) {
    if (!checkAdminWritePermission()) return;

    const feeRef = ref(db, `students/${studentId}/fees/${monthKey}`);
    const recordedBy = auth.currentUser.email || auth.currentUser.uid; 
    
    const payload = {
        status: status,
        timestamp: Date.now(),
        recordedBy: recordedBy,
        ...data // Add method or reason
    };

    try {
        await set(feeRef, payload);
        alert(`Successfully marked ${monthKey} as ${status}.`);
        renderAdminFeeManagement(studentId); 

    } catch (error) {
        console.error(`Mark ${status} Error:`, error);
        alert(`Error marking fee as ${status}. Check console and security rules.`);
    }
}

async function undoStatus(studentId, monthKey) {
    if (!checkAdminWritePermission()) return;

    if (!confirm(`Are you sure you want to UNDO the status for ${monthKey} for ${studentId}? This will delete the fee record.`)) return;

    const feeRef = ref(db, `students/${studentId}/fees/${monthKey}`);

    try {
        await remove(feeRef);
        alert(`Successfully undid status for ${monthKey}.`);
        renderAdminFeeManagement(studentId); 
    } catch (error) {
        console.error("Undo Status Error:", error);
        alert("ERROR: Failed to undo status. Check console and security rules.");
    }
}

// ====================================================================
// 7. FEE VIEW (STUDENT - Read Only)
// ====================================================================

function loadStudentPayments(studentId) {
    const feesRef = ref(db, `students/${studentId}/fees`);
    
    onValue(feesRef, (snapshot) => {
        const feesData = snapshot.val() || {};
        renderStudentPayments(studentId, feesData);
    });
}

function renderStudentPayments(studentId, feesData = {}) {
    const container = document.getElementById("student-fee-view");
    if (!container) return; 

    let html = `
        <h3>Your Fee Status</h3>
        <table class="fee-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Status</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
    `;

    months.forEach(month => {
        const feeRecord = feesData[month];
        const status = feeRecord?.status || "PENDING";
        let statusClass = "pending";
        let details = "—";

        if (status === "PAID") {
            statusClass = "paid";
            const date = new Date(feeRecord.timestamp).toLocaleDateString();
            details = `Paid on ${date} via ${feeRecord.method}`;
        } else if (status === "BREAK") {
            statusClass = "break";
            details = `On Break (Reason: ${feeRecord.reason || 'N/A'})`;
        }

        html += `
            <tr>
                <td>${month}</td>
                <td class="${statusClass}">${status}</td>
                <td>${details}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ====================================================================
// 8. REGISTRATION AND BREAK REQUESTS
// ====================================================================

async function handleRegistration() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-guardian-phone').value.trim();
    const studentClass = document.getElementById('reg-class').value.trim();
    const roll = document.getElementById('reg-roll').value.trim();
    const messageEl = document.getElementById('registration-message');
    
    if (!name || !phone || !studentClass || !roll) {
        messageEl.style.color = 'red';
        messageEl.innerText = 'Please fill out all fields.';
        return;
    }

    try {
        // Create a unique student ID
        const timestamp = Date.now().toString().slice(-6);
        const uniqueId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const newStudentId = `S${timestamp}${uniqueId}`;

        const studentRef = ref(db, `students/${newStudentId}`);
        
        await set(studentRef, {
            id: newStudentId,
            name: name,
            guardianPhone: phone,
            class: studentClass,
            roll: roll,
            status: 'pending',
            registeredAt: Date.now()
        });

        messageEl.style.color = 'green';
        messageEl.innerHTML = `Registration successful! Your Student ID is <strong>${newStudentId}</strong>. Please wait for admin approval.`;
        
        // Clear form
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-guardian-phone').value = '';
        document.getElementById('reg-class').value = '';
        document.getElementById('reg-roll').value = '';


    } catch (error) {
        console.error("Registration Error:", error);
        messageEl.style.color = 'red';
        messageEl.innerText = `Registration failed: ${error.message}`;
    }
}

async function requestBreak() {
    if (!currentStudentId || !currentStudentData) return;

    const monthKey = document.getElementById('break-month-select').value;
    const requestRef = ref(db, `breakRequests/${currentStudentId}`);
    const messageEl = document.getElementById('break-request-message');

    try {
        await set(requestRef, {
            studentId: currentStudentId,
            studentName: currentStudentData.name,
            requestedForMonth: monthKey,
            requestedAt: Date.now(),
            status: 'pending' // Admin must approve this
        });

        messageEl.style.color = 'blue';
        messageEl.innerText = `Break request for ${monthKey} submitted. Waiting for admin approval.`;
    } catch (error) {
        console.error("Break Request Error:", error);
        messageEl.style.color = 'red';
        messageEl.innerText = `Request failed: ${error.message}`;
    }
}
