// ====================================================================
// 1. FIREBASE INITIALIZATION AND SERVICE REFERENCES
// ====================================================================

// NOTE: REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    // Add other fields (storageBucket, messagingSenderId, appId) if necessary
};

// Initialize Firebase App
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase Services (Compatibility + Modular Destructuring)
const auth = firebase.auth();
const db = firebase.database();
const { ref, set, get, onValue, remove } = firebase.database; 

// Global variables for tracking state
let currentStudentData = null;
let allStudentsData = {};
let currentStudentId = null;

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// ====================================================================
// 2. AUTHENTICATION AND NAVIGATION
// ====================================================================

/**
 * Checks Firebase authentication status on page load.
 */
auth.onAuthStateChanged(user => {
    if (user) {
        // Check if the user is an Admin (logged in via password)
        const isAdmin = user.providerData.some(p => p.providerId === 'password');
        
        if (isAdmin) {
            initializeAdminPanel();
        } else {
            // Student login uses anonymous auth, so we rely on localStorage for the ID
            currentStudentId = localStorage.getItem('appLoginId');
            if (currentStudentId) {
                fetchStudentData(currentStudentId);
            } else {
                auth.signOut(); // Sign out orphaned anonymous users
            }
        }
    } else {
        // No user is signed in. Show the login form.
        showAuthContainer();
    }
});

/**
 * Fetches student data after successful login/re-login.
 */
async function fetchStudentData(studentId) {
    try {
        const studentRef = ref(db, `students/${studentId}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists() && snapshot.val().status === 'approved') {
            currentStudentData = snapshot.val();
            initializeStudentPanel(currentStudentData);
        } else {
            // Data missing or status not approved
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

/**
 * Handles the student login process (uses ID and anonymous auth).
 */
async function handleStudentLogin() {
    const studentIdInput = document.getElementById("student-id-input").value.toUpperCase().trim();
    const messageEl = document.getElementById("student-login-message");
    messageEl.innerText = "";
    
    if (!studentIdInput) {
        messageEl.innerText = "Please enter your Student ID.";
        return;
    }

    try {
        // 1. Sign in anonymously (or reuse existing session)
        await auth.signInAnonymously();
        
        // 2. Fetch data (RTDB rules will check if auth.uid matches $studentId)
        const studentRef = ref(db, `students/${studentIdInput}`);
        const snapshot = await get(studentRef);
        
        if (snapshot.exists() && snapshot.val().status === 'approved') {
            // If the security rule check passed, the data is readable
            currentStudentData = snapshot.val();
            currentStudentId = studentIdInput;
            localStorage.setItem('appLoginId', studentIdInput); // Store ID locally
            
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

/**
 * Handles the admin login process (uses email/password).
 */
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

/**
 * Logs out the current user (Admin or Student).
 */
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
    // Clear login messages
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

    // Populate break month selection
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

/**
 * Fetches all students for the admin panel.
 */
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

/**
 * Renders the list of students for the admin to select.
 */
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

/**
 * Filters the student list based on search input (ID or Name).
 */
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
// 5. FEE MANAGEMENT (ADMIN - Full Control)
// ====================================================================

/**
 * Checks if the current user is logged in via email/password (Admin).
 */
function checkAdminWritePermission() {
    if (!auth.currentUser) return false;
    // Check if the user logged in using email/password provider (as per RTDB rules)
    return auth.currentUser.providerData.some(p => p.providerId === 'password');
}

/**
 * Renders the fee management table for a specific student in the admin panel.
 */
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
                actionButtons = `
                    <button class="fee-action-btn" onclick="openPaymentModal('${studentId}', '${month}')">Mark Paid</button>
                    <button class="fee-action-btn" onclick="markBreak('${studentId}', '${month}')">Mark Break</button>
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
 * Prompts for payment method and calls markPaid.
 */
function openPaymentModal(studentId, monthKey) {
    const method = prompt(`Enter payment method for ${monthKey} (e.g., Cash, Bank, Mobile):`);
    if (method) {
        markPaid(studentId, monthKey, method);
    }
}

/**
 * Marks a student's fee status as 'PAID'.
 */
async function markPaid(studentId, monthKey, method) {
    if (!checkAdminWritePermission()) return;

    if (method && method.trim() !== "") {
        const feeRef = ref(db, `students/${studentId}/fees/${monthKey}`);
        const recordedBy = auth.currentUser.email || auth.currentUser.uid; 

        try {
            await set(feeRef, {
                status: "PAID",
                method: method.trim(),
                timestamp: Date.now(),
                recordedBy: recordedBy
            });

            alert(`Successfully marked ${monthKey} as PAID.`);
            renderAdminFeeManagement(studentId); 

        } catch (error) {
            console.error("Mark Paid Error:", error);
            alert("Error marking fee as PAID. Ensure your security rules allow the Admin write.");
        }
    }
}

/**
 * Marks a student's fee status as 'BREAK'.
 */
async function markBreak(studentId, monthKey) {
    if (!checkAdminWritePermission()) return;
    
    const reason = prompt(`Mark ${monthKey} as BREAK for ${studentId}.\n\nEnter Break Reason (Optional):`);

    if (reason !== null) { 
        const feeRef = ref(db, `students/${studentId}/fees/${monthKey}`);
        const recordedBy = auth.currentUser.email || auth.currentUser.uid;

        try {
            await set(feeRef, {
                status: "BREAK",
                reason: reason.trim() || "No reason provided",
                timestamp: Date.now(),
                recordedBy: recordedBy
            });

            alert(`Successfully marked ${monthKey} as BREAK.`);
            renderAdminFeeManagement(studentId);

        } catch (error) {
            console.error("Mark Break Error:", error);
            alert("Error marking fee as BREAK. Check console and security rules.");
        }
    }
}

/**
 * Undoes a fee status by deleting the record (reverts to PENDING/UNPAID).
 */
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
// 6. FEE VIEW (STUDENT - Read Only)
// ====================================================================

/**
 * Loads a student's fee data and sets up a real-time listener for the student panel.
 */
function loadStudentPayments(studentId) {
    const feesRef = ref(db, `students/${studentId}/fees`);
    
    onValue(feesRef, (snapshot) => {
        const feesData = snapshot.val() || {};
        renderStudentPayments(studentId, feesData);
    });
}

/**
 * Renders the fee status (read-only) for the student's panel.
 */
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
// 7. REGISTRATION AND BREAK REQUESTS
// ====================================================================

/**
 * Handles the new student registration submission.
 */
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
        messageEl.innerHTML = `
            Registration successful! Your Student ID is <strong>${newStudentId}</strong>. 
            Please wait for admin approval.
        `;

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

/**
 * Allows the student to request a break for a specific month.
 */
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
