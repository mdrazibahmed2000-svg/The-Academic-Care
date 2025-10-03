// --- COMPLETE, FINAL, AND ROBUST script.js ---

// 🚨 CRITICAL: REPLACE THE PLACEHOLDER CONFIG VALUES BELOW WITH YOUR ACTUAL FIREBASE KEYS
// If these keys are incorrect, the script will stop running, and the login button will not work.
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

var database;
var auth;
var currentStudent = "";

// Initialize Firebase with Error Handling
// The try...catch block prevents the entire script from crashing if config is bad.
try {
    // Check if firebase is available (must be linked in index.html)
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        throw new Error("Firebase SDK not loaded. Check index.html <script> links.");
    }
    
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    auth = firebase.auth();
    console.log("✅ Firebase Initialized successfully.");
} catch (error) {
    console.error("❌ FATAL ERROR: Firebase Initialization Failed. Check firebaseConfig in script.js and SDK links in index.html.", error);
    
    // Display an error message to the user when the window loads
    window.onload = function() {
        const loginErrorElement = document.getElementById("loginError");
        if (loginErrorElement) {
            loginErrorElement.innerText = "❌ APP ERROR: Failed to connect to Firebase. Check console/config.";
        }
    };
}


// Utility function to get the current date in DD-MM-YYYY format
function getCurrentDate() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return dd + '-' + mm + '-' + yyyy;
}

// Utility function to get the correct CSS class for status
function getStatusClass(status) {
    if (status === "paid") return "status-paid";
    if (status === "unpaid") return "status-unpaid";
    if (status === "break") return "status-break";
    return "";
}

// FUNCTION: Toggles visibility of collapsible sections (FOR STUDENT DASHBOARD)
function toggleSection(contentId) {
    const content = document.getElementById(contentId);
    const header = document.getElementById(contentId.replace('Content', 'Header'));
    
    if (!content || !header) return;

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        header.innerHTML = header.innerHTML.replace('⬇️', '⬆️');
    } else {
        content.classList.add('hidden');
        header.innerHTML = header.innerHTML.replace('⬆️', '⬇️');
    }
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
    // Only sign out if an Admin is logged in via Auth
    if (auth && auth.currentUser) {
        auth.signOut();
    }
    currentStudent = "";
    // Hide all dashboards and show login page
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("login-page").classList.remove("hidden");
    document.getElementById("studentId").value = ""; // Clear the ID field
    clearLoginError();
}

function clearLoginError() {
    const loginErrorElement = document.getElementById("loginError");
    if (loginErrorElement) {
        loginErrorElement.innerText = "";
    }
}

// Student Registration
function registerStudent() {
    if (!database) return alert("❌ Database not initialized. Cannot register.");

    var name = document.getElementById("regName").value.trim();
    var studentClass = document.getElementById("regClass").value.trim();
    var roll = document.getElementById("regRoll").value.trim();
    var guardian = document.getElementById("regGuardian").value.trim();
    
    if (!name || !studentClass || !roll || !guardian) {
        alert("⚠️ Fill all fields");
        return;
    }

    var year = new Date().getFullYear();
    // Use padded class/roll number for robust ID generation
    var studentId = "S" + year + String(studentClass).padStart(2, '0') + String(roll).padStart(2, '0');

    database.ref('students/' + studentId).set({
        name: name,
        class: studentClass,
        roll: roll,
        guardian: guardian,
        status: "pending"
    }, function(error) {
        if (error) {
            alert("❌ Database Write Error: " + error.message);
        }
        else {
            alert("✅ Registration successful! Student ID: " + studentId + ". Please wait for admin approval.");
            document.getElementById("registerForm").reset();
            showLogin();
        }
    });
}

// SECURE LOGIN FUNCTION
function login() {
    if (!database || !auth) {
        document.getElementById("loginError").innerText = "❌ Application failed to load. Check console for Firebase config errors.";
        return;
    }
    
    var id = document.getElementById("studentId").value.trim();
    clearLoginError();
    
    if (!id) {
        document.getElementById("loginError").innerText = "❌ Please enter a Student ID or 'admin' email.";
        return;
    }

    // 1. ADMIN FLOW CHECK (using Firebase Authentication)
    if (id === "admin" || id.includes('@')) {
        var email = id.includes('@') ? id : prompt("Enter admin email:");
        var password = prompt("Enter admin password:");

        if (!email || !password) {
            document.getElementById("loginError").innerText = "Admin login cancelled.";
            return;
        }

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                document.getElementById("login-page").classList.add("hidden");
                document.getElementById("admin-panel").classList.remove("hidden");
                loadAdminPanel();
                loadStudentFeesDropdown();
            })
            .catch((error) => {
                console.error("Admin Login Error:", error.code, error.message);
                let errorMsg = "❌ Admin Login Failed. ";
                if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                    errorMsg += "Invalid email or password.";
                } else {
                    errorMsg += "Check network or console.";
                }
                document.getElementById("loginError").innerText = errorMsg;
            });
        return; 
    }

    // 2. STUDENT FLOW (Unauthenticated Database Read)
    database.ref('students/' + id).once('value').then(function(snapshot) {
        if (snapshot.exists()) {
            var student = snapshot.val();
            
            if (student.status !== "approved") {
                document.getElementById("loginError").innerText = "⏳ Login failed: Student is " + student.status + ". Wait for admin approval.";
                return;
            }
            
            currentStudent = id;
            document.getElementById("login-page").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            
            // Reset collapsible state
            document.getElementById("profileContent").classList.add("hidden");
            document.getElementById("feesContent").classList.add("hidden");
            document.getElementById("profileHeader").innerHTML = "My Profile ⬇️";
            document.getElementById("feesHeader").innerHTML = "Tuition Fee Status ⬇️";

            loadStudentDashboard(id); 
        } else {
            document.getElementById("loginError").innerText = "❌ Invalid Student ID or student not registered!";
        }
    }).catch(error => {
        // This catches Firebase Permission Denied (Rule issue) or network errors.
        console.error("Database Login Error (Check Firebase Rules):", error);
        document.getElementById("loginError").innerText = "❌ Connection/Permission Error. Ensure Firebase Rules are published correctly.";
    });
}

// --- ADMIN FUNCTIONS ---

function loadAdminPanel() {
    if (!auth || !auth.currentUser) return logout();
    
    database.ref('students').once('value').then(function(snapshot) {
        
        var students = snapshot.val();
        var pendingHTML = "", approvedHTML = "";
        
        // Loop through all students to separate pending from approved
        for (var id in students) {
            var s = students[id];
            var line = s.name + " (Class " + s.class + ", Roll " + s.roll + ") - ID: " + id;
            
            if (s.status === "pending") {
                pendingHTML += `<li>${line} <button class="mark-paid-btn" onclick="approveStudent('${id}')">Approve</button></li>`;
            } else if (s.status === "approved") {
                // This list is not displayed in the current admin panel design but kept for reference
                approvedHTML += `<li>${line}</li>`; 
            }
        }
        
        document.getElementById("pendingStudents").innerHTML = pendingHTML || "<li>No pending students</li>";
        // The approved students list needs a dedicated div in the HTML to be displayed
    });
}

function approveStudent(studentId) {
    if (!auth || !auth.currentUser) return logout();
    database.ref('students/' + studentId + '/status').set("approved", function(error) {
        if (error) {
            console.error(error);
            alert("❌ Approval failed.");
        } else {
            initializeMonthlyFees(studentId);
            alert("✅ Student " + studentId + " approved!");
            loadAdminPanel();
            loadStudentFeesDropdown();
        }
    });
}

function initializeMonthlyFees(studentId) {
    if (!auth || !auth.currentUser) return;
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var updates = {};
    months.forEach(function(m) {
        updates[m] = "unpaid";
    });
    // Set initial 'unpaid' status for all months
    database.ref('students/' + studentId + '/fees').set(updates);
}

function loadStudentFeesDropdown() {
    if (!auth || !auth.currentUser) return;
    database.ref('students').once('value').then(function(snapshot) {
        var options = '<option value="">Select Student</option>';
        if (snapshot.exists()) {
            var students = snapshot.val();
            for (var id in students) {
                if (students[id].status === "approved") options += '<option value="' + id + '">' + students[id].name + ' (ID: ' + id + ')</option>';
            }
        }
        document.getElementById("selectStudentFees").innerHTML = options;
    });
}

function markMonthPaid(studentId, month) {
    if (!auth || !auth.currentUser) return logout();
    
    let method = prompt("Enter payment method for " + month + " (bKash, Nagad, or Cash):");
    
    if (!method) {
        alert("Payment method is required. Payment canceled.");
        return;
    }
    
    const paymentRecord = {
        status: "paid",
        date: getCurrentDate(),
        method: method.trim()
    };
    
    database.ref('students/' + studentId + '/fees/' + month).set(paymentRecord, function(error) {
        if (error) {
            console.error(error);
            alert("❌ Payment failed.");
        } else {
            alert("Payment for " + month + " recorded successfully!");
            loadStudentFees(studentId);
        }
    });
}

function markMonthBreak(studentId, month) {
    if (!auth || !auth.currentUser) return logout();
    // Set status directly to "break"
    database.ref('students/' + studentId + '/fees/' + month).set("break", function(error) {
        if (error) {
            console.error(error);
            alert("❌ Mark break failed.");
        } else {
            loadStudentFees(studentId);
        }
    });
}


function loadStudentFees(studentId) {
    if (!auth || !auth.currentUser) return;
    if (!studentId) {
        document.getElementById("monthlyFees").innerHTML = '';
        return;
    }
    
    var chronologicalMonths = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    database.ref('students/' + studentId + '/fees').once('value').then(function(snapshot) {
        if (!snapshot.exists()) {
            document.getElementById("monthlyFees").innerHTML = '<li>No fee records found for this student. (Admin must approve student first)</li>';
            return;
        }
        
        var html = '<ul class="fee-list">';
        var fees = snapshot.val();
        
        chronologicalMonths.forEach(function(month) {
            if (fees.hasOwnProperty(month)) {
                
                let statusData = fees[month];
                let dateMethodDisplay = '';
                let status = 'unpaid';

                // Check if fee is an object (meaning it was paid)
                if (typeof statusData === 'object' && statusData !== null && statusData.status) {
                    dateMethodDisplay = ` (Date: ${statusData.date}, Method: ${statusData.method})`;
                    status = statusData.status;
                } else if (typeof statusData === 'string') {
                    // status is "unpaid" or "break"
                    status = statusData; 
                }

                var statusClass = getStatusClass(status);
                var statusText = `<span class="${statusClass}">${status}</span>`;

                html += '<li class="fee-item">' + month + ': ' + statusText + dateMethodDisplay + ' ';
                
                // Admin Buttons
                if(status !== 'break') {
                    html += `<button class="break-btn" onclick="markMonthBreak('${studentId}','${month}')">Mark Break</button>`;
                }
                
                if(status !== 'paid' && status !== 'break') {
                    html += `<button class="mark-paid-btn" onclick="markMonthPaid('${studentId}','${month}')">Mark Paid</button>`;
                }

                html += '</li>';
            }
        });

        document.getElementById("monthlyFees").innerHTML = html + '</ul>';
    }).catch(error => {
        console.error("Error loading student fees in Admin Panel:", error);
        document.getElementById("monthlyFees").innerHTML = '<li>Error loading fees.</li>';
    });
}

// --- STUDENT DASHBOARD FUNCTIONS ---

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

        // 1. SCHOOL NAME AND ACADEMIC YEAR 
        const studentNameElement = document.getElementById("studentName");
        if (studentNameElement) {
            var headerHTML = '<h2>The Academic Care</h2>';
            headerHTML += '<p><strong>Academic Year:</strong> 2025</p>';
            studentNameElement.innerHTML = headerHTML;
        }
        
        // 2. MY PROFILE CONTENT
        const profileContentElement = document.getElementById("profileContent");
        if (profileContentElement) {
            var profileContentHTML = '';
            profileContentHTML += '<p><strong>Student Name:</strong> ' + student.name + '</p>';
            profileContentHTML += '<p><strong>Class:</strong> ' + student.class + '</p>';
            profileContentHTML += '<p><strong>Roll:</strong> ' + student.roll + '</p>';
            profileContentHTML += '<p><strong>Guardian No:</strong> ' + student.guardian + '</p>';
            profileContentElement.innerHTML = profileContentHTML;
        }

        // 3. TUITION FEE STATUS CONTENT (Only up to the current month)
        const feesContentElement = document.getElementById("feesContent");
        if (feesContentElement) {
            var feesContentHTML = '<ul class="fee-list">';
            var fees = student.fees || {}; 
            
            for (let i = 0; i <= currentMonthIndex; i++) {
                var month = chronologicalMonths[i];
                
                if (fees.hasOwnProperty(month)) {
                    
                    let statusData = fees[month];
                    let dateDisplay = '';
                    let status = 'unpaid';

                    if (typeof statusData === 'object' && statusData !== null && statusData.status) {
                        dateDisplay = ` (Paid on: ${statusData.date})`;
                        status = statusData.status;
                    } else if (typeof statusData === 'string') {
                        status = statusData; 
                    }

                    var statusClass = getStatusClass(status); 
                    
                    feesContentHTML += '<li>' + month + ': <span class="' + statusClass + '">' + status + dateDisplay + '</span></li>';
                }
            }
            
            feesContentHTML += '</ul>';
            
            feesContentElement.innerHTML = feesContentHTML;
        }
    }).catch(error => {
        console.error("Error loading student dashboard:", error);
    });
}
