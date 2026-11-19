
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const invoiceTable = document.getElementById("invoiceTable");
const paymentTable = document.getElementById("paymentTable");

function formatMoney(amount) {
    return "₹" + Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(date) {
    if (!date) return "--";

    return new Date(date).toLocaleDateString("en-IN");
}

async function loadStudentFees() {
    try {
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        const session = sessionData.session;

        if (!session) {
            window.location.href = "student-login.html";
            return;
        }

        const userId = session.user.id;

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (profileError) throw profileError;

        if (!["student", "parent"].includes(profile.role)) {
            alert("Access denied. Student or Parent account required.");
            return;
        }

        let studentId;

        if (profile.role === "student") {
            const { data: student, error } = await db
                .from("students")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (error) throw error;

            studentId = student.id;

        } else {
            const { data: parent, error: parentError } = await db
                .from("parents")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (parentError) throw parentError;

            const { data: link, error: linkError } = await db
                .from("student_parents")
                .select("student_id")
                .eq("parent_id", parent.id)
                .limit(1)
                .single();

            if (linkError) throw linkError;

            studentId = link.student_id;
        }

        // Fetch only this student's invoices
        const { data: invoices, error: invoiceError } = await db
            .from("fee_invoices")
            .select(`
                id,
                invoice_number,
                issue_date,
                due_date,
                total_amount,
                status
            `)
            .eq("student_id", studentId)
            .order("id", { ascending: false });

        if (invoiceError) throw invoiceError;

        if (!invoices || invoices.length === 0) {
            invoiceTable.innerHTML = `
                <tr>
                    <td colspan="7">No fee invoices available.</td>
                </tr>
            `;

            paymentTable.innerHTML = `
                <tr>
                    <td colspan="6">No payment history available.</td>
                </tr>
            `;

            updateFeeSummary(0, 0, 0);
            return;
        }

        const invoiceIds = invoices.map(invoice => invoice.id);

        // Fetch successful payments for these invoices
        const { data: payments, error: paymentError } = await db
            .from("fee_payments")
            .select(`
                invoice_id,
                amount,
                payment_method,
                payment_status,
                transaction_reference,
                payment_date
            `)
            .in("invoice_id", invoiceIds)
            .order("payment_date", { ascending: false });

        if (paymentError) throw paymentError;

        let totalFees = 0;
        let paidFees = 0;

        const paidByInvoice = {};

        (payments || []).forEach(payment => {
            if (payment.payment_status === "successful") {
                const amount = Number(payment.amount) || 0;

                paidByInvoice[payment.invoice_id] =
                    (paidByInvoice[payment.invoice_id] || 0) + amount;

                paidFees += amount;
            }
        });

        invoiceTable.innerHTML = "";

        invoices.forEach(invoice => {
            const total = Number(invoice.total_amount) || 0;
            const paid = paidByInvoice[invoice.id] || 0;
            const pending = Math.max(0, total - paid);

            totalFees += total;

            const row = document.createElement("tr");

            const values = [
                invoice.invoice_number || "--",
                formatDate(invoice.issue_date),
                formatDate(invoice.due_date),
                formatMoney(total),
                formatMoney(paid),
                formatMoney(pending),
                invoice.status || "--"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            invoiceTable.appendChild(row);
        });

        const pendingFees = Math.max(0, totalFees - paidFees);

        updateFeeSummary(totalFees, paidFees, pendingFees);

        // Payment history
        paymentTable.innerHTML = "";

        if (!payments || payments.length === 0) {
            paymentTable.innerHTML = `
                <tr>
                    <td colspan="6">No payment history available.</td>
                </tr>
            `;
        } else {
            payments.forEach(payment => {
                const invoice = invoices.find(
                    item => item.id === payment.invoice_id
                );

                const row = document.createElement("tr");

                const values = [
                    formatDate(payment.payment_date),
                    invoice?.invoice_number || "--",
                    formatMoney(payment.amount),
                    payment.payment_method || "--",
                    payment.payment_status || "--",
                    payment.transaction_reference || "--"
                ];

                values.forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                paymentTable.appendChild(row);
            });
        }

    } catch (error) {
        console.error("Fee Details Error:", error);

        invoiceTable.innerHTML = `
            <tr>
                <td colspan="7">Unable to load fee details.</td>
            </tr>
        `;

        paymentTable.innerHTML = `
            <tr>
                <td colspan="6">Unable to load payment history.</td>
            </tr>
        `;
    }
}

function updateFeeSummary(total, paid, pending) {
    document.getElementById("totalFees").textContent =
        formatMoney(total);

    document.getElementById("paidFees").textContent =
        formatMoney(paid);

    document.getElementById("pendingFees").textContent =
        formatMoney(pending);
}

loadStudentFees();
