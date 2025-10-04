// ====================================================================
// 1. FIREBASE INITIALIZATION AND IMPORTS
// ====================================================================
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, ServerValue } from "firebase/database";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8",
    authDomain: "the-academic-care.firebaseapp.com",
    databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "the-academic-care",
    storageBucket: "the-academic-care.firebasestorage.app",
    messagingSenderId: "728354914429",
    appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
    measurementId: "G-37MDWVYWFJ"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);


// ====================================================================
// 2. REGISTRATION LOGIC (Runs on index.html)
// ====================================================================
function handleRegistration() {
    const form = document.getElementById('registrationForm');
    if (!form) return; // Only run if on index.html

    const resultMessage = document.getElementById('resultMessage');
    const registerBtn = document.getElementById('registerBtn');

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        if (!form.checkValidity()) { form.reportValidity(); return; }

        registerBtn.disabled = true;
        registerBtn.textContent = 'Processing...';

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const studentClass = document.getElementById('class').value;
        const roll = document.getElementById('roll').value;
        const guardianNo = document.getElementById('guardianNo').value;
        
        // Generate Unique Student ID (S+YYYY+CC+RR)
        const academicYear = new Date().getFullYear();
        const formattedClass = String(studentClass).padStart(2, '0');
        const formattedRoll = String(roll).padStart(2, '0');
        const studentID = `S${academicYear}${formattedClass}${formattedRoll}`;

        try {
            // 1. Create User in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const userUID = userCredential.user.uid;

            // 2. Save Registration Data to Realtime Database
            const registrationData = {
                id: studentID,
                name: name,
                class: studentClass,
                roll: formattedRoll,
                guardianNo: guardianNo,
                email: email, // Store email for admin reference
                uid: userUID, // Link to the Firebase Auth UID
                status: 'Pending', 
                registeredAt: ServerValue.TIMESTAMP 
            };
            
            const registrationRef = ref(database, 'registrations/' + studentID);
            await set(registrationRef, registrationData);

            // 3. Display Success Message
            document.getElementById('studentID').innerHTML = `Your **Student ID** is: <strong>${studentID}</strong>`;
            
            form.classList.add('hidden');
            resultMessage.classList.remove('hidden');
            alert("Registration successful! Your account is created, and your application is pending approval.");

        } catch (error) {
            console.error("Registration failed:", error);
            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please log in or use a different email.";
            }
            alert(`Registration Failed: ${errorMessage}`);
            
        } finally {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Register & Create Account';
        }
    });
}

// ====================================================================
// 3. LOGIN & STATUS CHECK LOGIC (Runs on login.html)
// ====================================================================
function handleLogin() {
    const loginForm = document.getElementById('loginForm');
    const statusArea = document.getElementById('statusArea');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!loginForm) return; // Only run if on login.html

    // Attempt to log in
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing In...';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle the rest
        } catch (error) {
            alert(`Login Failed: ${error.message}`);
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log In';
        }
    });

    // Handle logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // onAuthStateChanged will handle the UI update
        } catch (error) {
            console.error("Logout error:", error);
        }
    });

    // Handle state change (Login/Logout)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            loginForm.classList.add('hidden');
            statusArea.classList.remove('hidden');
            await displayStatus(user.uid);
        } else {
            // User is signed out
            loginForm.classList.remove('hidden');
            statusArea.classList.add('hidden');
            document.getElementById('registrationStatus').textContent = "";
        }
    });
}

// Function to fetch and display the student's status
async function displayStatus(uid) {
    const statusElement = document.getElementById('registrationStatus');
    const studentNameDisplay = document.getElementById('studentNameDisplay');
    const studentIDDisplay = document.getElementById('studentIDDisplay');
    const adminMessage = document.getElementById('adminMessage');

    statusElement.textContent = "Loading...";
    adminMessage.textContent = "";

    try {
        // Find the registration record linked to this UID
        const registrationsRef = ref(database, 'registrations');
        const snapshot = await get(registrationsRef);

        if (snapshot.exists()) {
            let registrationFound = false;
            
            // Iterate through all registrations to find the one matching the user's UID
            snapshot.forEach((childSnapshot) => {
                const regData = childSnapshot.val();
                if (regData.uid === uid) {
                    // Match found!
                    registrationFound = true;
                    
                    const status = regData.status || 'Pending'; // Default to Pending
                    
                    // Update display
                    studentNameDisplay.textContent = regData.name;
                    studentIDDisplay.textContent = regData.id;
                    statusElement.textContent = status.toUpperCase();
                    
                    // Apply styling based on status
                    statusElement.classList.remove('pending', 'approved');
                    if (status.toLowerCase() === 'pending') {
                        statusElement.classList.add('pending');
                        adminMessage.textContent = "Your registration is currently under review by the administrator. Please check back later.";
                    } else if (status.toLowerCase() === 'approved') {
                        statusElement.classList.add('approved');
                        adminMessage.textContent = "Congratulations! Your registration has been approved. You can now access all coaching resources.";
                    } else {
                        // For statuses like 'Rejected', 'On Hold', etc.
                        statusElement.classList.add('pending'); 
                        adminMessage.textContent = regData.adminNote || "Your registration status is not standard. Please contact 'The Academic Care' directly.";
                    }
                }
            });

            if (!registrationFound) {
                statusElement.textContent = "No Registration Found";
                adminMessage.textContent = "Please ensure you have completed the registration form on the main page.";
                studentIDDisplay.textContent = "N/A";
            }

        } else {
            statusElement.textContent = "Database Error: No registrations found.";
        }
    } catch (error) {
        console.error("Error fetching status:", error);
        statusElement.textContent = "Error loading status.";
    }
}


// ====================================================================
// 4. INITIALIZATION
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    handleRegistration();
    handleLogin();
});
