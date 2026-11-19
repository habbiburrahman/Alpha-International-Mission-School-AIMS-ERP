
// ==========================================
// AIMS ERP - FEES OVERVIEW
// ==========================================

// Use your existing Supabase URL and publishable key.
// Never use the service_role key in frontend code.

const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "YOUR_EXISTING_PUBLISHABLE_KEY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// HTML Elements
const totalInvoices = document.getElementById("totalInvoices");
const paidInvoices = document.getElementById("paidInvoices");
const pendingInvoices = document.getElementById("pendingInvoices");
const partialInvoices = document.getElementById("partialInvoices");
const invoiceTableBody = document.getElementById("invoiceTableBody");
const message = document.getElementById("message");

// ==========================================
// ADMIN CHECK
// ==========================================

async function checkAdmin() {
    const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
        message.textContent = "Please login as Admin first.";
        return false;
    }

    const { data, error } = await supabaseClient.rpc("is_admin");

    if (error || data !== true) {
        message.textContent = "Access denied. Admin only.";
        return false;
    }

    return true;
}

// ==========================================
// FORMAT CURRENCY
// ==========================================

function formatAmount(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ==========================================
// FORMAT STATUS
// ==========================================

function formatStatus(status) {
    const statusNames = {
        paid: "Paid",
        pending: "Pending",
        partially_paid: "Partially Paid",
        overdue: "Overdue",
        cancelled: "Cancelled"
    };

    return statusNames[status] || status || "-";
}

// ==========================================
// LOAD FEE INVOICES
// ==========================================

async function loadFeeInvoices() {
    message.textContent = "Loading fee invoices...";

    const allowed = await checkAdmin();

    if (!allowed) return;

    const { data: invoices, error } = await supabaseClient
        .from("fee_invoices")
        .select(`
            id,
            student_id,
            invoice_number,
            issue_date,
            due_date,
            total_amount,
            status,
            created_at
        `)
        .order("created_at", { ascending: false });

    if (error) {
        message.textContent = "Fees Error: " + error.message;
        invoiceTableBody.innerHTML =
            '<tr><td colspan="6">Unable to load invoices.</td></tr>';
        return;
    }

    const records = invoices || [];

    // ======================================
    // CALCULATE INVOICE STATISTICS
    // ======================================

    const paid = records.filter(item =>
        item.status === "paid"
    ).length;

    const pending = records.filter(item =>
        item.status === "pending" || item.status === "overdue"
    ).length;

    const partial = records.filter(item =>
        item.status === "partially_paid"
    ).length;

    totalInvoices.textContent = records.length;
    paidInvoices.textContent = paid;
    pendingInvoices.textContent = pending;
    partialInvoices.textContent = partial;

    // ======================================
    // DISPLAY RECENT 10 INVOICES
    // ======================================

    invoiceTableBody.innerHTML = "";

    if (records.length === 0) {
        invoiceTableBody.innerHTML =
            '<tr><td colspan="6">No fee invoices found.</td></tr>';

        message.textContent = "No invoices available yet.";
        return;
    }

    records.slice(0, 10).forEach(invoice => {
        const row = document.createElement("tr");

        const values = [
            invoice.invoice_number || "-",
            invoice.student_id ?? "-",
            invoice.issue_date || "-",
            invoice.due_date || "-",
            formatAmount(invoice.total_amount),
            formatStatus(invoice.status)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        invoiceTableBody.appendChild(row);
    });

    message.textContent = "Fee invoices loaded successfully.";
}

// ==========================================
// INITIALIZE
// ==========================================

async function initializePage() {
    try {
        await loadFeeInvoices();
    } catch (error) {
        message.textContent = "Unexpected Error: " + error.message;
    }
}

initializePage();
