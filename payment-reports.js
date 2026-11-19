
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const totalCollection = document.getElementById("totalCollection");
const todayCollection = document.getElementById("todayCollection");
const monthlyCollection = document.getElementById("monthlyCollection");
const pendingFees = document.getElementById("pendingFees");

const reportTableBody = document.getElementById("reportTableBody");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const filterBtn = document.getElementById("filterBtn");
const resetBtn = document.getElementById("resetBtn");

let payments = [];
let invoices = [];

function formatCurrency(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getLocalDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
        alert("Only Admin can view payment reports.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadInvoices() {
    const { data, error } = await db
        .from("fee_invoices")
        .select("id, total_amount, status");

    if (error) throw new Error("Invoice error: " + error.message);

    invoices = data || [];
}

async function loadPayments() {
    const { data, error } = await db
        .from("fee_payments")
        .select("id, invoice_id, amount, payment_method, payment_status, payment_date")
        .order("payment_date", { ascending: false });

    if (error) throw new Error("Payment error: " + error.message);

    payments = data || [];
}

function getPaidAmount(invoiceId) {
    return payments
        .filter(payment =>
            Number(payment.invoice_id) === Number(invoiceId) &&
            payment.payment_status === "successful"
        )
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function calculateSummary() {
    const successfulPayments = payments.filter(
        payment => payment.payment_status === "successful"
    );

    const total = successfulPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0), 0
    );

    const today = getLocalDate();

    const todayTotal = successfulPayments
        .filter(payment =>
            payment.payment_date &&
            getLocalDate(new Date(payment.payment_date)) === today
        )
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const now = new Date();

    const monthlyTotal = successfulPayments
        .filter(payment => {
            if (!payment.payment_date) return false;
            const date = new Date(payment.payment_date);
            return date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const pendingTotal = invoices
        .filter(invoice =>
            ["pending", "partially_paid", "overdue"].includes(invoice.status)
        )
        .reduce((sum, invoice) => {
            const balance = Math.max(
                0,
                Number(invoice.total_amount || 0) - getPaidAmount(invoice.id)
            );

            return sum + balance;
        }, 0);

    totalCollection.textContent = formatCurrency(total);
    todayCollection.textContent = formatCurrency(todayTotal);
    monthlyCollection.textContent = formatCurrency(monthlyTotal);
    pendingFees.textContent = formatCurrency(pendingTotal);
}

function renderPaymentTable(records) {
    reportTableBody.innerHTML = "";

    if (records.length === 0) {
        reportTableBody.innerHTML =
            '<tr><td colspan="6">No payment records found.</td></tr>';
        return;
    }

    records.forEach(payment => {
        const row = document.createElement("tr");

        const values = [
            payment.id,
            payment.invoice_id,
            payment.payment_date
                ? new Date(payment.payment_date).toLocaleString("en-IN")
                : "-",
            payment.payment_method || "-",
            formatCurrency(payment.amount),
            payment.payment_status || "-"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        reportTableBody.appendChild(row);
    });
}

function generateReport() {
    const from = startDate.value;
    const to = endDate.value;

    if (from && to && from > to) {
        alert("Start date cannot be after end date.");
        return;
    }

    const filtered = payments.filter(payment => {
        if (!payment.payment_date) return false;

        const date = getLocalDate(new Date(payment.payment_date));

        if (from && date < from) return false;
        if (to && date > to) return false;

        return true;
    });

    renderPaymentTable(filtered);
}

function resetReport() {
    startDate.value = "";
    endDate.value = "";
    renderPaymentTable(payments);
}

filterBtn.addEventListener("click", generateReport);
resetBtn.addEventListener("click", resetReport);

async function initializePage() {
    try {
        reportTableBody.innerHTML =
            '<tr><td colspan="6">Loading reports...</td></tr>';

        const allowed = await checkAdmin();
        if (!allowed) return;

        await loadInvoices();
        await loadPayments();

        calculateSummary();
        renderPaymentTable(payments);

    } catch (error) {
        reportTableBody.innerHTML = "";
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = error.message;
        row.appendChild(cell);
        reportTableBody.appendChild(row);
        console.error(error);
    }
}

initializePage();