const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const invoiceSelect = document.getElementById("invoice");
const invoiceDetails = document.getElementById("invoiceDetails");
const amountInput = document.getElementById("amount");
const methodSelect = document.getElementById("paymentMethod");
const referenceInput = document.getElementById("transactionReference");
const saveButton = document.getElementById("savePayment");
const message = document.getElementById("message");
const paymentList = document.getElementById("paymentList");

let invoices = [];
let payments = [];
let currentUser = null;

async function checkAdmin() {
    const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

    if (sessionError || !sessionData.session) {
        alert("Please login as Admin first.");
        window.location.href = "index.html";
        return false;
    }

    currentUser = sessionData.session.user;

    const { data, error } = await db.rpc("is_admin");

    if (error || !data) {
        alert("Only Admin can manage fee payments.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadInvoices() {
    const { data, error } = await db
        .from("fee_invoices")
        .select("id, student_id, invoice_number, total_amount, status")
        .order("id", { ascending: false });

    if (error) {
        message.textContent = "Invoice error: " + error.message;
        message.style.color = "red";
        return false;
    }

    invoices = data || [];

    return true;
}

async function loadPayments() {
    const { data, error } = await db
        .from("fee_payments")
        .select("id, invoice_id, amount, payment_method, payment_status, transaction_reference, payment_date")
        .order("id", { ascending: false });

    if (error) {
        message.textContent = "Payment loading error: " + error.message;
        message.style.color = "red";
        return false;
    }

    payments = data || [];

    return true;
}

function getPaidAmount(invoiceId) {
    return payments
        .filter(payment =>
            Number(payment.invoice_id) === Number(invoiceId) &&
            payment.payment_status === "successful"
        )
        .reduce((total, payment) => total + Number(payment.amount), 0);
}

function getBalance(invoice) {
    return Math.max(
        0,
        Number(invoice.total_amount) - getPaidAmount(invoice.id)
    );
}

function loadInvoiceDropdown() {
    invoiceSelect.innerHTML =
        '<option value="">Select Invoice</option>';

    invoices.forEach(invoice => {
        const balance = getBalance(invoice);

        if (balance <= 0) return;

        const option = document.createElement("option");

        option.value = invoice.id;
        option.textContent =
            `${invoice.invoice_number} | Student ID: ${invoice.student_id} | Balance: ₹${balance.toFixed(2)}`;

        invoiceSelect.appendChild(option);
    });
}

function showInvoiceDetails() {
    const invoiceId = invoiceSelect.value;

    const invoice = invoices.find(
        item => Number(item.id) === Number(invoiceId)
    );

    if (!invoice) {
        invoiceDetails.style.display = "none";
        amountInput.max = "";
        return;
    }

    const paid = getPaidAmount(invoice.id);
    const balance = getBalance(invoice);

    invoiceDetails.style.display = "block";

    invoiceDetails.textContent =
        `Invoice: ${invoice.invoice_number} | ` +
        `Student ID: ${invoice.student_id} | ` +
        `Total Fee: ₹${Number(invoice.total_amount).toFixed(2)} | ` +
        `Paid: ₹${paid.toFixed(2)} | ` +
        `Remaining: ₹${balance.toFixed(2)}`;

    amountInput.max = balance.toFixed(2);
    amountInput.value = "";
}

async function loadPaymentRecords() {
    paymentList.innerHTML = "";

    if (payments.length === 0) {
        paymentList.innerHTML =
            '<tr><td colspan="6">No payment records found.</td></tr>';
        return;
    }

    payments.forEach(payment => {
        const row = document.createElement("tr");

        const values = [
            payment.invoice_id,
            "₹" + Number(payment.amount).toFixed(2),
            payment.payment_method || "-",
            payment.payment_status || "-",
            payment.transaction_reference || "-",
            payment.payment_date
                ? new Date(payment.payment_date).toLocaleString()
                : "-"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        paymentList.appendChild(row);
    });
}

async function savePayment() {
    const invoiceId = invoiceSelect.value;
    const amount = Number(amountInput.value);
    const paymentMethod = methodSelect.value;
    const transactionReference = referenceInput.value.trim();

    if (!invoiceId || !amountInput.value || !paymentMethod) {
        message.textContent = "Please fill all required fields.";
        message.style.color = "red";
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        message.textContent = "Enter a valid payment amount.";
        message.style.color = "red";
        return;
    }

    const invoice = invoices.find(
        item => Number(item.id) === Number(invoiceId)
    );

    if (!invoice) {
        message.textContent = "Invoice not found.";
        message.style.color = "red";
        return;
    }

    const balance = getBalance(invoice);

    if (amount > balance + 0.001) {
        message.textContent =
            `Payment cannot exceed remaining balance ₹${balance.toFixed(2)}.`;
        message.style.color = "red";
        return;
    }

    saveButton.disabled = true;
    message.textContent = "Saving payment...";
    message.style.color = "blue";

    const { error: paymentError } = await db
        .from("fee_payments")
        .insert({
            invoice_id: Number(invoiceId),
            amount: amount,
            payment_method: paymentMethod,
            payment_status: "successful",
            transaction_reference: transactionReference || null,
            payment_date: new Date().toISOString(),
            recorded_by: currentUser.id
        });

    if (paymentError) {
        saveButton.disabled = false;
        message.textContent =
            "Payment error: " + paymentError.message;
        message.style.color = "red";
        return;
    }

    const updatedPaid = getPaidAmount(invoice.id) + amount;

    const newStatus =
        updatedPaid >= Number(invoice.total_amount) - 0.001
            ? "paid"
            : "partially_paid";

    const { error: updateError } = await db
        .from("fee_invoices")
        .update({ status: newStatus })
        .eq("id", Number(invoiceId));

    if (updateError) {
        saveButton.disabled = false;
        message.textContent =
            "Payment saved, but invoice status update failed: " +
            updateError.message +
            ". Please refresh and check before retrying.";
        message.style.color = "red";
        return;
    }

    message.textContent = "Payment saved successfully!";
    message.style.color = "green";

    amountInput.value = "";
    methodSelect.value = "";
    referenceInput.value = "";

    await loadInvoices();
    await loadPayments();

    loadInvoiceDropdown();
    showInvoiceDetails();
    await loadPaymentRecords();

    saveButton.disabled = false;
}

invoiceSelect.addEventListener("change", showInvoiceDetails);
saveButton.addEventListener("click", savePayment);

async function initializePage() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    const invoicesLoaded = await loadInvoices();

    if (!invoicesLoaded) return;

    const paymentsLoaded = await loadPayments();

    if (!paymentsLoaded) return;

    loadInvoiceDropdown();
    await loadPaymentRecords();

    message.textContent = "Fee Payment Management is ready.";
    message.style.color = "green";
}

initializePage();
