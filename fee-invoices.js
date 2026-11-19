
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const studentSelect = document.getElementById("student");
const academicYearSelect = document.getElementById("academicYear");
const invoiceNumberInput = document.getElementById("invoiceNumber");
const issueDateInput = document.getElementById("issueDate");
const dueDateInput = document.getElementById("dueDate");
const totalAmountInput = document.getElementById("totalAmount");
const generateButton = document.getElementById("generateInvoice");
const message = document.getElementById("message");
const invoiceList = document.getElementById("invoiceList");

let students = [];

function getTodayDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function generateInvoiceNumber() {
    const now = new Date();

    const date = getTodayDate().replaceAll("-", "");
    const time = [
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `AIMS-${date}-${time}`;
}

async function checkAdmin() {
    const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

    if (sessionError || !sessionData.session) {
        alert("Please login as Admin first.");
        window.location.href = "index.html";
        return false;
    }

    const { data, error } = await db.rpc("is_admin");

    if (error || !data) {
        alert("Only Admin can manage fee invoices.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadStudents() {
    const { data, error } = await db
        .from("students")
        .select("id, student_name")
        .order("student_name");

    if (error) {
        message.textContent = "Student loading error: " + error.message;
        message.style.color = "red";
        return false;
    }

    students = data || [];

    studentSelect.innerHTML =
        '<option value="">Select Student</option>';

    students.forEach(student => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent = student.student_name;
        studentSelect.appendChild(option);
    });

    return true;
}

async function loadAcademicYears() {
    const { data, error } = await db
        .from("academic_years")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        message.textContent = "Academic year error: " + error.message;
        message.style.color = "red";
        return false;
    }

    academicYearSelect.innerHTML =
        '<option value="">Select Academic Year</option>';

    (data || []).forEach(year => {
        const option = document.createElement("option");
        option.value = year.id;

        const label =
            year.year_name ||
            year.academic_year ||
            year.name ||
            year.title ||
            year.session ||
            year.id;

        option.textContent = label;
        academicYearSelect.appendChild(option);
    });

    return true;
}

async function loadInvoices() {
    const { data, error } = await db
        .from("fee_invoices")
        .select("id, student_id, invoice_number, issue_date, due_date, total_amount, status")
        .order("id", { ascending: false });

    if (error) {
        invoiceList.innerHTML =
            '<tr><td colspan="6">Error: ' + error.message + '</td></tr>';
        return;
    }

    invoiceList.innerHTML = "";

    if (!data || data.length === 0) {
        invoiceList.innerHTML =
            '<tr><td colspan="6">No invoices found.</td></tr>';
        return;
    }

    data.forEach(invoice => {
        const row = document.createElement("tr");

        const values = [
            invoice.invoice_number,
            invoice.student_id,
            invoice.issue_date,
            invoice.due_date,
            "₹" + Number(invoice.total_amount).toFixed(2),
            invoice.status || "Pending"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "-";
            row.appendChild(cell);
        });

        invoiceList.appendChild(row);
    });
}

async function createInvoice() {
    const studentId = studentSelect.value;
    const academicYearId = academicYearSelect.value;
    const issueDate = issueDateInput.value;
    const dueDate = dueDateInput.value;
    const totalAmount = Number(totalAmountInput.value);

    if (
        !studentId ||
        !academicYearId ||
        !issueDate ||
        !dueDate ||
        !totalAmountInput.value
    ) {
        message.textContent = "Please fill all required fields.";
        message.style.color = "red";
        return;
    }

    if (dueDate < issueDate) {
        message.textContent =
            "Due date cannot be earlier than issue date.";
        message.style.color = "red";
        return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        message.textContent = "Please enter a valid fee amount.";
        message.style.color = "red";
        return;
    }

    generateButton.disabled = true;
    message.textContent = "Generating invoice...";
    message.style.color = "blue";

    const invoiceNumber = generateInvoiceNumber();

    const { error } = await db
        .from("fee_invoices")
        .insert({
            student_id: Number(studentId),
            academic_year_id: Number(academicYearId),
            invoice_number: invoiceNumber,
            issue_date: issueDate,
            due_date: dueDate,
            total_amount: totalAmount,
            status: "pending"
        });

    generateButton.disabled = false;

    if (error) {
        message.textContent = "Invoice error: " + error.message;
        message.style.color = "red";
        return;
    }

    message.textContent =
        "Invoice generated successfully: " + invoiceNumber;
    message.style.color = "green";

    invoiceNumberInput.value = generateInvoiceNumber();
    studentSelect.value = "";
    academicYearSelect.value = "";
    dueDateInput.value = "";
    totalAmountInput.value = "";

    await loadInvoices();
}

generateButton.addEventListener("click", createInvoice);

async function initializePage() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    issueDateInput.value = getTodayDate();
    invoiceNumberInput.value = generateInvoiceNumber();

    const studentsLoaded = await loadStudents();

    if (!studentsLoaded) return;

    const yearsLoaded = await loadAcademicYears();

    if (!yearsLoaded) return;

    await loadInvoices();

    message.textContent = "Fee Invoice Management is ready.";
    message.style.color = "green";
}

initializePage();
