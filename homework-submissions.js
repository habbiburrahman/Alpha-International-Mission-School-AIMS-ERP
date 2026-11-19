
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const homeworkSelect = document.getElementById("homeworkSelect");
const loadBtn = document.getElementById("loadBtn");
const submissionTable = document.getElementById("submissionTable");

let submissions = [];

// Check Admin Login
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
        alert("Only Admin can access this page.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Load Homework List
async function loadHomework() {
    homeworkSelect.innerHTML =
        '<option value="">Loading homework...</option>';

    const { data, error } = await db
        .from("homework")
        .select("id, title")
        .order("id", { ascending: false });

    if (error) {
        console.error("Homework Error:", error);

        homeworkSelect.innerHTML =
            '<option value="">Unable to load homework</option>';
        return;
    }

    homeworkSelect.innerHTML =
        '<option value="">Select Homework</option>';

    data.forEach(item => {
        const option = document.createElement("option");

        option.value = item.id;
        option.textContent = item.title;

        homeworkSelect.appendChild(option);
    });
}

// Load Submissions
async function loadSubmissions() {
    const homeworkId = homeworkSelect.value;

    if (!homeworkId) {
        alert("Please select homework first.");
        return;
    }

    submissionTable.innerHTML =
        '<tr><td colspan="7">Loading submissions...</td></tr>';

    const { data, error } = await db
        .from("homework_submissions")
        .select(`
            id,
            homework_id,
            student_id,
            submission_text,
            file_path,
            submitted_at,
            status,
            students (
                student_name,
                admission_number
            )
        `)
        .eq("homework_id", homeworkId)
        .order("submitted_at", { ascending: false });

    if (error) {
        console.error("Submission Error:", error);

        submissionTable.innerHTML =
            '<tr><td colspan="7">Error loading submissions.</td></tr>';

        return;
    }

    submissions = data || [];

    await displaySubmissions();
}

// Create Styled PDF Button
function createPDFButton(text, url, backgroundColor, newTab = false) {
    const button = document.createElement("a");

    button.href = url;
    button.textContent = text;

    if (newTab) {
        button.target = "_blank";
        button.rel = "noopener noreferrer";
    }

    Object.assign(button.style, {
        display: "inline-block",
        padding: "9px 15px",
        backgroundColor: backgroundColor,
        color: "#ffffff",
        textDecoration: "none",
        borderRadius: "7px",
        fontSize: "13px",
        fontWeight: "600",
        margin: "4px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "0.2s"
    });

    button.addEventListener("mouseenter", () => {
        button.style.opacity = "0.85";
    });

    button.addEventListener("mouseleave", () => {
        button.style.opacity = "1";
    });

    return button;
}

// Display Submissions
async function displaySubmissions() {
    submissionTable.innerHTML = "";

    if (submissions.length === 0) {
        submissionTable.innerHTML =
            '<tr><td colspan="7">No submissions found for this homework.</td></tr>';

        updateSummary();
        return;
    }

    for (const item of submissions) {
        const student = item.students || {};

        const row = document.createElement("tr");

        const studentName = student.student_name || "Unknown";
        const admissionNumber = student.admission_number || "-";
        const submissionText = item.submission_text || "-";

        const submittedAt = item.submitted_at
            ? new Date(item.submitted_at).toLocaleString()
            : "-";

        row.innerHTML = `
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="pdf-actions">Loading PDF...</td>

            <td>
                <select class="status-select">
                    <option value="submitted">Submitted</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="late">Late</option>
                </select>
            </td>

            <td>
                <button type="button" class="update-btn">
                    Update
                </button>
            </td>
        `;

        row.cells[0].textContent = studentName;
        row.cells[1].textContent = admissionNumber;
        row.cells[2].textContent = submissionText;
        row.cells[3].textContent = submittedAt;

        // PDF View and Download
        const pdfCell = row.querySelector(".pdf-actions");

        if (item.file_path) {
            const { data: signedData, error: signedError } =
                await db.storage
                    .from("homework-pdfs")
                    .createSignedUrl(item.file_path, 600);

            if (signedError) {
                console.error("PDF URL Error:", signedError);

                pdfCell.textContent = "PDF unavailable";
            } else {
                pdfCell.innerHTML = "";

                const viewButton = createPDFButton(
                    "👁 View PDF",
                    signedData.signedUrl,
                    "#2563eb",
                    true
                );

                const downloadButton = createPDFButton(
                    "⬇ Download PDF",
                    signedData.signedUrl + "&download=" +
                        encodeURIComponent("Homework.pdf"),
                    "#16a34a"
                );

                pdfCell.appendChild(viewButton);
                pdfCell.appendChild(downloadButton);
            }
        } else {
            pdfCell.textContent = "No PDF attached";
        }

        // Status
        const statusSelect = row.querySelector(".status-select");

        statusSelect.value = item.status || "submitted";

        // Update Button
        row.querySelector(".update-btn").addEventListener("click", () => {
            updateStatus(item.id, statusSelect.value);
        });

        submissionTable.appendChild(row);
    }

    updateSummary();
}

// Update Submission Status
async function updateStatus(id, status) {
    const { error } = await db
        .from("homework_submissions")
        .update({ status: status })
        .eq("id", id);

    if (error) {
        console.error("Status Error:", error);

        alert("Status update failed: " + error.message);
        return;
    }

    alert("Submission status updated successfully!");

    await loadSubmissions();
}

// Update Summary Cards
function updateSummary() {
    document.getElementById("totalCount").textContent =
        submissions.length;

    document.getElementById("submittedCount").textContent =
        submissions.filter(item =>
            item.status === "submitted"
        ).length;

    document.getElementById("pendingCount").textContent =
        submissions.filter(item =>
            item.status === "pending"
        ).length;
}

// Load Button
loadBtn.addEventListener("click", loadSubmissions);

// Initialize Application
async function init() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    await loadHomework();
}

init();
