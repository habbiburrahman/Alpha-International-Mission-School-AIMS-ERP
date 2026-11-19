
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let archiveRecords = [];
let invoiceRecords = [];
let paymentRecords = [];

async function verifyAdmin() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.href = "index.html";
        return false;
    }

    const user = data.session.user;

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return false;
    }

    return true;
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined && text !== null) {
        element.textContent = String(text);
    }

    return element;
}

function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleString("en-IN");
}

function formatAmount(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function addRecordItem(container, label, value, statusClass = "") {
    const item = createElement("div", "record-item");

    item.appendChild(createElement("span", "", label));

    const strong = createElement("strong", statusClass, value);
    item.appendChild(strong);

    container.appendChild(item);
}

function renderPayments(invoiceId, container) {
    const payments = paymentRecords.filter(
        payment => payment.invoice_id === invoiceId
    );

    if (payments.length === 0) {
        container.appendChild(
            createElement("p", "no-invoices", "No payment records found.")
        );
        return;
    }

    const list = createElement("ul", "payment-list");

    payments.forEach(payment => {
        const text =
            `${formatAmount(payment.amount)} | ` +
            `${payment.payment_method || "Method not available"} | ` +
            `${payment.payment_status || "Status not available"}`;

        list.appendChild(createElement("li", "", text));
    });

    container.appendChild(list);
}

function renderInvoices(logId, container) {
    const invoices = invoiceRecords.filter(
        invoice => invoice.deletion_log_id === logId
    );

    if (invoices.length === 0) {
        container.appendChild(
            createElement("p", "no-invoices", "No linked fee invoices.")
        );
        return;
    }

    invoices.forEach(invoice => {
        const box = createElement("div", "invoice-box");

        box.appendChild(
            createElement("p", "", `Invoice: ${invoice.invoice_number}`)
        );

        box.appendChild(
            createElement("p", "", `Amount: ${formatAmount(invoice.total_amount)}`)
        );

        box.appendChild(
            createElement("p", "", `Status: ${invoice.status}`)
        );

        const paymentHeading = createElement("p");
        paymentHeading.appendChild(
            createElement("strong", "", "Payment History")
        );

        box.appendChild(paymentHeading);
        renderPayments(invoice.id, box);

        container.appendChild(box);
    });
}

function renderArchive() {
    const archiveList = document.getElementById("archiveList");
    const searchValue = document
        .getElementById("searchInput")
        .value.trim()
        .toLowerCase();

    const typeValue = document.getElementById("typeFilter").value;

    archiveList.replaceChildren();

    const filteredRecords = archiveRecords.filter(record => {
        const name = (record.account_name || "").toLowerCase();
        const identifier = (record.account_identifier || "").toLowerCase();

        const matchesSearch =
            name.includes(searchValue) ||
            identifier.includes(searchValue);

        const matchesType =
            typeValue === "all" || record.account_type === typeValue;

        return matchesSearch && matchesType;
    });

    document.getElementById("emptyMessage").hidden =
        filteredRecords.length !== 0;

    filteredRecords.forEach(record => {
        const card = createElement("article", "archive-card");

        const header = createElement("div", "archive-header");
        const heading = createElement("div");

        heading.appendChild(
            createElement(
                "h2",
                "",
                record.account_name || "Name not available"
            )
        );

        heading.appendChild(
            createElement(
                "p",
                "",
                `Account ID: ${record.account_identifier}`
            )
        );

        header.appendChild(heading);

        header.appendChild(
            createElement("span", "account-type", record.account_type)
        );

        card.appendChild(header);

        const grid = createElement("div", "record-grid");

        addRecordItem(grid, "Archive ID", record.id);
        addRecordItem(grid, "Deleted On", formatDate(record.deleted_at));

        addRecordItem(
            grid,
            "Auth Cleanup",
            record.auth_cleanup_status,
            `status-${record.auth_cleanup_status}`
        );

        addRecordItem(
            grid,
            "Storage Cleanup",
            record.storage_cleanup_status,
            `status-${record.storage_cleanup_status}`
        );

        addRecordItem(
            grid,
            "Deleted By (Admin ID)",
            record.deleted_by
        );

        card.appendChild(grid);

        const invoiceSection = createElement("div", "invoice-section");

        invoiceSection.appendChild(
            createElement("h3", "", "Preserved Fee & Payment History")
        );

        renderInvoices(record.id, invoiceSection);

        card.appendChild(invoiceSection);
        archiveList.appendChild(card);
    });
}

async function loadArchiveData() {
    const loadingMessage = document.getElementById("loadingMessage");
    const errorMessage = document.getElementById("errorMessage");

    loadingMessage.hidden = false;
    errorMessage.textContent = "";

    // Load deleted account history
    const { data: logs, error: logsError } = await supabaseClient
        .from("account_deletion_logs")
        .select(`
            id,
            account_type,
            account_identifier,
            account_name,
            deleted_at,
            deleted_by,
            related_records,
            auth_cleanup_status,
            storage_cleanup_status
        `)
        .order("deleted_at", { ascending: false });

    if (logsError) {
        console.error("Archive logs error:", logsError);
        errorMessage.textContent =
            "Deleted account history load nahi hui. Supabase permissions check karo.";
        loadingMessage.hidden = true;
        return;
    }

    archiveRecords = logs || [];

    // Load preserved invoices linked to archive records
    const { data: invoices, error: invoiceError } = await supabaseClient
        .from("fee_invoices")
        .select(`
            id,
            deletion_log_id,
            invoice_number,
            total_amount,
            status
        `)
        .not("deletion_log_id", "is", null);

    if (invoiceError) {
        console.error("Invoice history error:", invoiceError);
        errorMessage.textContent =
            "Archive records load hue, lekin fee invoices load nahi hue.";
        loadingMessage.hidden = true;
        return;
    }

    invoiceRecords = invoices || [];

    // Load payments for archived invoices
    const invoiceIds = invoiceRecords.map(invoice => invoice.id);

    if (invoiceIds.length > 0) {
        const { data: payments, error: paymentError } =
            await supabaseClient
                .from("fee_payments")
                .select(`
                    id,
                    invoice_id,
                    amount,
                    payment_method,
                    payment_status
                `)
                .in("invoice_id", invoiceIds);

        if (paymentError) {
            console.error("Payment history error:", paymentError);
            errorMessage.textContent =
                "Invoices load hue, lekin payment history load nahi hui.";
            loadingMessage.hidden = true;
            return;
        }

        paymentRecords = payments || [];
    } else {
        paymentRecords = [];
    }

    // Update summary cards
    document.getElementById("totalAccounts").textContent =
        archiveRecords.length;

    document.getElementById("totalStudents").textContent =
        archiveRecords.filter(record =>
            record.account_type === "student"
        ).length;

    document.getElementById("totalTeachers").textContent =
        archiveRecords.filter(record =>
            record.account_type === "teacher"
        ).length;

    renderArchive();

    loadingMessage.hidden = true;
}

async function startArchivePage() {
    const isAdmin = await verifyAdmin();

    if (!isAdmin) return;

    await loadArchiveData();
}

document.getElementById("searchInput").addEventListener(
    "input",
    renderArchive
);

document.getElementById("typeFilter").addEventListener(
    "change",
    renderArchive
);

document.getElementById("logoutBtn").addEventListener(
    "click",
    async () => {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            alert("Logout nahi ho paya: " + error.message);
            return;
        }

        window.location.href = "index.html";
    }
);

startArchivePage();
