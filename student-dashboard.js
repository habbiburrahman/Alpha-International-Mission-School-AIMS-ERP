

const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// HTML ELEMENTS
const studentNameElement = document.getElementById("studentName");
const profileNameElement = document.getElementById("profileName");
const admissionElement = document.getElementById("admissionNumber");
const classElement = document.getElementById("studentClass");
const sectionElement = document.getElementById("studentSection");
const parentElement = document.getElementById("parentName");
const logoutBtn = document.getElementById("logoutBtn");

const photoElement = document.getElementById("studentPhoto");
const noPhotoElement = document.getElementById("noStudentPhoto");
const dobElement = document.getElementById("studentDOB");
const genderElement = document.getElementById("studentGender");

// FEE ELEMENTS
const totalFeesElement = document.getElementById("totalFees");
const paidFeesElement = document.getElementById("paidFees");
const remainingFeesElement = document.getElementById("remainingFees");
const feeStatusElement = document.getElementById("feeStatus");
const studentFeeList = document.getElementById("studentFeeList");
const feeMessage = document.getElementById("feeMessage");

let currentUser = null;

// FORMAT CURRENCY
function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
    });
}

// SHOW DASHBOARD ERROR
function showDashboardError(error) {
    console.error("AIMS Dashboard Error:", error);

    alert(
        "Dashboard Error: " +
        (error.message || "Something went wrong")
    );
}

// RESET DASHBOARD
function resetDashboard() {
    studentNameElement.textContent = "Loading...";
    profileNameElement.textContent = "Loading...";
    admissionElement.textContent = "--";
    classElement.textContent = "--";
    sectionElement.textContent = "--";
    parentElement.textContent = "--";

    if (dobElement) dobElement.textContent = "--";
    if (genderElement) genderElement.textContent = "--";

    photoElement.src = "";
    photoElement.style.display = "none";

    noPhotoElement.style.display = "block";
    noPhotoElement.textContent = "Loading Photo...";

    totalFeesElement.textContent = formatCurrency(0);
    paidFeesElement.textContent = formatCurrency(0);
    remainingFeesElement.textContent = formatCurrency(0);

    feeStatusElement.textContent = "Loading...";

    studentFeeList.innerHTML =
        '<tr><td colspan="6">Loading fee details...</td></tr>';

    feeMessage.textContent = "";
}

// FORMAT DATE
function formatDate(dateValue) {
    if (!dateValue) return "--";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "--";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

// CHECK STUDENT ACTIVE STATUS
async function checkStudentActive(student) {
    if (!student || student.is_active === false) {
        alert(
            "Your student account is currently inactive. " +
            "Please contact the school administration."
        );

        await db.auth.signOut();

        window.location.replace("student-login.html");

        return false;
    }

    return true;
}

// LOAD STUDENT PHOTO
async function loadStudentPhoto(photoPath) {
    photoElement.style.display = "none";
    noPhotoElement.style.display = "block";

    if (!photoPath) {
        noPhotoElement.textContent = "Photo Not Available";
        return;
    }

    try {
        const { data, error } = await db.storage
            .from("profile-photos")
            .createSignedUrl(photoPath, 3600);

        if (error) throw error;

        if (!data || !data.signedUrl) {
            throw new Error("Photo URL could not be generated.");
        }

        photoElement.onload = function () {
            photoElement.style.display = "block";
            noPhotoElement.style.display = "none";
        };

        photoElement.onerror = function () {
            photoElement.style.display = "none";
            noPhotoElement.style.display = "block";
            noPhotoElement.textContent = "Photo Not Available";
        };

        photoElement.src = data.signedUrl;

    } catch (error) {
        console.error("Student Photo Error:", error);

        noPhotoElement.textContent = "Photo Not Available";
    }
}

// LOAD CLASS, SECTION AND PARENT
async function loadStudentDashboard(student) {

    // CHECK ACTIVE STATUS FIRST
    const isActive = await checkStudentActive(student);

    if (!isActive) return;

    studentNameElement.textContent =
        student.student_name || "Student";

    profileNameElement.textContent =
        student.student_name || "--";

    admissionElement.textContent =
        student.admission_number || "--";

    dobElement.textContent =
        formatDate(student.date_of_birth);

    genderElement.textContent =
        student.gender || "--";

    await loadStudentPhoto(student.photo_url);

    // CLASS AND SECTION
    const { data: enrollment, error: enrollmentError } = await db
        .from("enrollments")
        .select("section_id")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (enrollmentError) throw enrollmentError;

    if (enrollment) {

        const { data: section, error: sectionError } = await db
            .from("sections")
            .select("section_name, class_id")
            .eq("id", enrollment.section_id)
            .single();

        if (sectionError) throw sectionError;

        sectionElement.textContent =
            section.section_name || "--";

        const { data: classData, error: classError } = await db
            .from("classes")
            .select("class_name")
            .eq("id", section.class_id)
            .single();

        if (classError) throw classError;

        classElement.textContent =
            classData.class_name || "--";

    } else {
        classElement.textContent = "Not Assigned";
        sectionElement.textContent = "Not Assigned";
    }

    // LINKED PARENT
    const { data: links, error: linksError } = await db
        .from("student_parents")
        .select("parent_id")
        .eq("student_id", student.id);

    if (linksError) throw linksError;

    if (links && links.length > 0) {

        const parentIds = links.map(item => item.parent_id);

        const { data: parents, error: parentsError } = await db
            .from("parents")
            .select("parent_name")
            .in("id", parentIds);

        if (parentsError) throw parentsError;

        parentElement.textContent =
            parents
                .map(parent => parent.parent_name)
                .filter(Boolean)
                .join(", ") || "--";

    } else {
        parentElement.textContent = "Not Linked";
    }

    // LOAD FEES
    await loadStudentFees(student.id);
}

// LOAD STUDENT FEES
async function loadStudentFees(studentId) {

    feeMessage.textContent = "Loading fee records...";

    const { data: invoices, error: invoiceError } = await db
        .from("fee_invoices")
        .select(`
            id,
            invoice_number,
            total_amount,
            status,
            due_date
        `)
        .eq("student_id", studentId)
        .order("id", { ascending: false });

    if (invoiceError) throw invoiceError;

    if (!invoices || invoices.length === 0) {

        totalFeesElement.textContent = formatCurrency(0);
        paidFeesElement.textContent = formatCurrency(0);
        remainingFeesElement.textContent = formatCurrency(0);

        feeStatusElement.textContent = "No Invoices";

        studentFeeList.innerHTML =
            '<tr><td colspan="6">No fee invoices found.</td></tr>';

        feeMessage.textContent =
            "No fee records are currently available.";

        return;
    }

    const invoiceIds = invoices.map(invoice => invoice.id);

    const { data: payments, error: paymentError } = await db
        .from("fee_payments")
        .select(`
            invoice_id,
            amount,
            payment_status
        `)
        .in("invoice_id", invoiceIds);

    if (paymentError) throw paymentError;

    const successfulPayments = payments || [];

    let totalFees = 0;
    let totalPaid = 0;
    let totalDue = 0;

    studentFeeList.innerHTML = "";

    invoices.forEach(invoice => {

        const invoiceTotal =
            Number(invoice.total_amount) || 0;

        const invoicePaid = successfulPayments
            .filter(payment =>
                Number(payment.invoice_id) === Number(invoice.id) &&
                payment.payment_status === "successful"
            )
            .reduce(
                (sum, payment) =>
                    sum + Number(payment.amount || 0),
                0
            );

        const invoiceDue = Math.max(
            0,
            invoiceTotal - invoicePaid
        );

        totalFees += invoiceTotal;
        totalPaid += invoicePaid;

        if (invoice.status !== "cancelled") {
            totalDue += invoiceDue;
        }

        const row = document.createElement("tr");

        const values = [
            invoice.invoice_number || "--",
            formatCurrency(invoiceTotal),
            formatCurrency(invoicePaid),
            formatCurrency(invoiceDue),
            invoice.status || "pending",
            formatDate(invoice.due_date)
        ];

        values.forEach((value, index) => {

            const cell = document.createElement("td");

            if (index === 4) {

                const badge = document.createElement("span");

                const status = String(value).toLowerCase();

                badge.className = "fee-status " + status;

                badge.textContent =
                    status.replace("_", " ");

                cell.appendChild(badge);

            } else {
                cell.textContent = value;
            }

            row.appendChild(cell);
        });

        studentFeeList.appendChild(row);
    });

    totalFeesElement.textContent =
        formatCurrency(totalFees);

    paidFeesElement.textContent =
        formatCurrency(totalPaid);

    remainingFeesElement.textContent =
        formatCurrency(totalDue);

    if (totalDue <= 0) {

        feeStatusElement.textContent = "All Paid";

    } else if (totalPaid > 0) {

        feeStatusElement.textContent = "Partially Paid";

    } else {

        feeStatusElement.textContent = "Payment Due";
    }

    feeMessage.textContent =
        "Fee information is based on payment records updated by the school administration.";
}

// INITIALIZE DASHBOARD
async function initializeDashboard() {

    resetDashboard();

    try {

        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {

            window.location.replace("student-login.html");

            return;
        }

        currentUser = sessionData.session.user;

        const { data: userData, error: userError } =
            await db.auth.getUser();

        if (userError || !userData.user) {

            await db.auth.signOut();

            window.location.replace("student-login.html");

            return;
        }

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("full_name, role")
            .eq("id", currentUser.id)
            .single();

        if (profileError) throw profileError;

        // STUDENT LOGIN
        if (profile.role === "student") {

            const { data: student, error: studentError } = await db
                .from("students")
                .select(`
                    id,
                    user_id,
                    student_name,
                    admission_number,
                    date_of_birth,
                    gender,
                    photo_url,
                    is_active
                `)
                .eq("user_id", currentUser.id)
                .single();

            if (studentError) throw studentError;

            if (!student || student.user_id !== currentUser.id) {

                throw new Error(
                    "Student account verification failed."
                );
            }

            await loadStudentDashboard(student);
        }

        // PARENT LOGIN
        else if (profile.role === "parent") {

            const { data: parent, error: parentError } = await db
                .from("parents")
                .select("id, parent_name")
                .eq("user_id", currentUser.id)
                .single();

            if (parentError) throw parentError;

            const { data: links, error: linksError } = await db
                .from("student_parents")
                .select("student_id")
                .eq("parent_id", parent.id);

            if (linksError) throw linksError;

            if (!links || links.length === 0) {

                throw new Error(
                    "No student is linked to this parent account."
                );
            }

            // CURRENT INTERFACE DISPLAYS ONE LINKED STUDENT
            const { data: student, error: studentError } = await db
                .from("students")
                .select(`
                    id,
                    user_id,
                    student_name,
                    admission_number,
                    date_of_birth,
                    gender,
                    photo_url,
                    is_active
                `)
                .eq("id", links[0].student_id)
                .single();

            if (studentError) throw studentError;

            await loadStudentDashboard(student);

        } else {

            throw new Error(
                "This account is not a Student or Parent account."
            );
        }

        console.log(
            "AIMS Student & Parent Dashboard Loaded"
        );

    } catch (error) {

        showDashboardError(error);

        feeMessage.textContent =
            "Unable to load fee information.";

        studentFeeList.innerHTML =
            '<tr><td colspan="6">Fee details could not be loaded.</td></tr>';

        feeStatusElement.textContent = "Unavailable";
    }
}

// LOGOUT
logoutBtn.addEventListener("click", async function () {

    logoutBtn.disabled = true;
    logoutBtn.textContent = "Logging out...";

    const { error } = await db.auth.signOut();

    if (error) {

        showDashboardError(error);

        logoutBtn.disabled = false;
        logoutBtn.textContent = "Logout";

        return;
    }

    window.location.replace("student-login.html");
});

// START DASHBOARD
initializeDashboard();