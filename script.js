// --- COMPLETE, FINAL, AND CORRECTED script.js (with Break System and Colors) ---

// Firebase config (Use your actual configuration)
var firebaseConfig = {
    apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8",
    authDomain: "the-academic-care.firebaseapp.com",
    databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "the-academic-care",
    storageBucket: "the-academic-care.firebasestorage.app",
    messagingSenderId: "728354914429",
    appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
    measurementId: "G-37MDWVYWFJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var database = firebase.database();
var auth = firebase.auth(); 
var currentStudent = "";

// Utility function to get the correct CSS class for status
function getStatusClass(status) {
    if (status === "paid") return "status-paid";
    if (status === "unpaid") return "status-unpaid";
    if (status === "break") return "status-break";
    return "";
}

// UI Functions
function showRegister() {
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("register-page").classList.remove("hidden");
    clearLoginError();
}

function showLogin() {
    document.getElementById("register-page").classList.add("hidden");
    document.getElementById("login-page").classList.remove("hidden");
}

function logout() {
    auth.signOut();
    currentStudent = "";
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("login-page").classList.remove("hidden");
    clearLoginError();
}

function clearLoginError() {
    document.getElementById("loginError").innerText = "";
}

// Student Registration
function registerStudent() {
    var name = document.getElementById("regName").value.trim();
    var studentClass = document.getElementById("regClass").value.trim();
    var roll = document.getElementById("regRoll").value.trim();
    var guardian = document.getElementById("regGuardian").value.trim();
    if (!name || !studentClass || !roll || !guardian) return alert("⚠️ Fill all fields");

    var year = new Date().getFullYear();
    var studentId = "S" + year + String(studentClass).padStart(2, '0') + String(roll).padStart(2, '0');

    database.ref('students/' + studentId).set({
        name: name,
        class: studentClass,
        roll: roll,
        guardian: guardian,
        status: "pending"
    }, function(error) {
        if (error) alert("❌ " + error);
        else {
            alert("✅ Registration successful! Student ID: " + studentId);
            document.getElementById("registerForm").reset();
            showLogin();
        }
    });
}

// SECURE LOGIN FUNCTION
function login() {
    var id = document.getElementById("studentId").value.trim();
    clearLoginError();

    // 1. ADMIN FLOW CHECK
    if (id === "admin" || id.includes('@')) {

        var email = id.includes('@') ? id : prompt("Enter admin email:");
        var password = prompt("Enter admin password:");

        if (!email || !password) {
            document.getElementById("loginError").innerText = "Admin login cancelled.";
            return;
        }

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // --- SUCCESS BLOCK: SHOW ADMIN PANEL ---
                document.getElementById("login-page").classList.add("hidden");
                document.getElementById("admin-panel").classList.remove("hidden");

                loadAdminPanel();
                loadStudentFeesDropdown();
            })
            .catch((error) => {
                // --- FAILURE BLOCK: SHOW ERROR MESSAGE ---
                console.error("Admin Login Error:", error.code, error.message);
                document.getElementById("loginError").innerText = "❌ Admin Login Failed: Invalid email or password.";
            });

        return; 
    }

    // 2. STUDENT FLOW
    database.ref('students/' + id).once('value').then(function(snapshot) {
        if (snapshot.exists()) {
            var student = snapshot.val();
            
            if (student.status !== "approved") {
                document.getElementById("loginError").innerText = "⏳ Pending admin approval";
                return;
            }
            
            currentStudent = id;
            document.getElementById("login-page").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            
            loadStudentDashboard(id); 
        } else {
            document.getElementById("loginError").innerText = "❌ Invalid ID!";
        }
    });
}

// Admin Panel Functions
function loadAdminPanel() {
    if (!auth.currentUser) return logout();
    database.ref('students').once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;
        var students = snapshot.val();
        var pendingHTML = "", approvedHTML = "";
        for (var id in students) {
            var s = students[id];
            var line = s.name + " (Class " + s.class + ", Roll " + s.roll + ") - ID: " + id;
            if (s.status === "pending") pendingHTML += "<li>" + line + " <button onclick=\"approveStudent('" + id + "')\">Approve</button></li>";
            else if (s.status === "approved") approvedHTML += "<li>" + line + " <button onclick=\"markPaid('" + id + "')\">Mark Paid</button></li>";
        }
        document.getElementById("pendingStudents").innerHTML = pendingHTML || "<li>No pending students</li>";
        document.getElementById("approvedStudents").innerHTML = approvedHTML || "<li>No approved students</li>";
    });
}

function approveStudent(studentId) {
    if (!auth.currentUser) return logout();
    database.ref('students/' + studentId + '/status').set("approved", function() {
        initializeMonthlyFees(studentId);
        alert("✅ Student " + studentId + " approved!");
        loadAdminPanel();
        loadStudentFeesDropdown();
    });
}

function markPaid(studentId) {
    if (!auth.currentUser) return logout();
    database.ref('students/' + studentId + '/feeStatus').set("paid", function() {
        alert("💰 Student " + studentId + " fee marked as paid!");
        loadAdminPanel();
    });
}

function initializeMonthlyFees(studentId) {
    if (!auth.currentUser) return;
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var updates = {};
    months.forEach(function(m) {
        updates[m] = "unpaid";
    });
    database.ref('students/' + studentId + '/fees').set(updates);
}

function loadStudentFeesDropdown() {
    if (!auth.currentUser) return;
    database.ref('students').once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;
        var options = '<option value="">Select Student</option>';
        var students = snapshot.val();
        for (var id in students) {
            if (students[id].status === "approved") options += '<option value="' + id + '">' + students[id].name + ' (ID: ' + id + ')</option>';
        }
        document.getElementById("selectStudentFees").innerHTML = options;
    });
}

// Admin Fee Management Display - Chronological, Mark Paid/Break Buttons and Colors
function loadStudentFees(studentId) {
    if (!auth.currentUser) return;
    if (!studentId) {
        document.getElementById("monthlyFees").innerHTML = '';
        return;
    }
    
    var chronologicalMonths = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    database.ref('students/' + studentId + '/fees').once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;
        
        var html = '';
        var fees = snapshot.val();
        
        chronologicalMonths.forEach(function(month) {
            if (fees.hasOwnProperty(month)) {
                var status = fees[month];
                var statusClass = getStatusClass(status);
                
                // Set the status text to be colored
                var statusText = `<span class="${statusClass}">${status}</span>`;

                // Add both Mark Paid and Mark Break buttons
                html += '<li class="fee-item">' + month + ': ' + statusText + ' ';
                
                // Only show buttons if not already on a break status
                if(status !== 'break') {
                    html += `<button class="break-btn" onclick="markMonthBreak('${studentId}','${month}')">Mark Break</button>`;
                }
                
                // Only show Mark Paid button if not paid or on break
                if(status !== 'paid' && status !== 'break') {
                    html += `<button class="mark-paid-btn" onclick="markMonthPaid('${studentId}','${month}')">Mark Paid</button>`;
                }

                html += '</li>';
            }
        });

        document.getElementById("monthlyFees").innerHTML = html;
    });
}

function markMonthPaid(studentId, month) {
    if (!auth.currentUser) return logout();
    database.ref('students/' + studentId + '/fees/' + month).set("paid", function() {
        loadStudentFees(studentId);
    });
}

// NEW FUNCTION: Mark Month as Break
function markMonthBreak(studentId, month) {
    if (!auth.currentUser) return logout();
    database.ref('students/' + studentId + '/fees/' + month).set("break", function() {
        loadStudentFees(studentId);
    });
}


// Student Dashboard Display - Chronological, Current Month Limit, New Header, and Colors
function loadStudentDashboard(studentId) {
    var chronologicalMonths = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    var currentDate = new Date();
    var currentMonthIndex = currentDate.getMonth(); 
    
    database.ref('students/' + studentId).once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;

        var student = snapshot.val();

        // --- NEW HEADER STRUCTURE ---
        var headerHTML = '<h2>The Academic Care</h2>';
        headerHTML += '<p><strong>Academic Year:</strong> 2025</p>';
        headerHTML += '<p><strong>Student Name:</strong> ' + student.name + '</p>';
        headerHTML += '<p><strong>Class:</strong> ' + student.class + '</p>';
        headerHTML += '<p><strong>Roll:</strong> ' + student.roll + '</p>';
        headerHTML += '<p><strong>Guardian No:</strong> ' + student.guardian + '</p>';

        document.getElementById("studentName").innerHTML = headerHTML;
        
        // --- MONTHLY FEES DISPLAY ---
        var feesHTML = '<h3>Monthly Fees:</h3><ul>';
        var fees = student.fees || {}; 
        
        // Iterate only up to the current month index (limits display to past and current months)
        for (let i = 0; i <= currentMonthIndex; i++) {
            var month = chronologicalMonths[i];
            
            if (fees.hasOwnProperty(month)) {
                var status = fees[month];
                var statusClass = getStatusClass(status); // Get color class
                
                feesHTML += '<li>' + month + ': <span class="' + statusClass + '">' + status + '</span></li>';
            }
        }
        
        feesHTML += '</ul>';
        document.getElementById("studentFees").innerHTML = feesHTML;
    });
}
