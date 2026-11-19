
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// ==========================================
// HTML ELEMENTS
// ==========================================

const homeworkTable = document.getElementById("homeworkTable");
const historyTable = document.getElementById("historyTable");

const submissionForm = document.getElementById("submissionForm");
const selectedHomework = document.getElementById("selectedHomework");
const homeworkIdInput = document.getElementById("homeworkId");

const pdfFile = document.getElementById("pdfFile");
const submissionText = document.getElementById("submissionText");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");

const BUCKET = "homework-files";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

let currentStudent = null;
let currentUser = null;

// ==========================================
// HELPERS
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showError(error) {
    console.error("AIMS Student Portal Error:", error);

    homeworkTable.innerHTML = `
        <tr>
            <td colspan="4">
                Error: ${escapeHTML(error.message || "Something went wrong")}
            </td>
        </tr>
    `;
}

function showMessage(text, color = "green") {
    message.style.color = color;
    message.textContent = text;
}

async function createPdfLink(filePath, cell) {
    if (!filePath) {
        cell.textContent = "No PDF";
        return;
    }

    const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 600);

    if (error) {
        console.error("PDF URL Error:", error);
        cell.textContent = "PDF unavailable";
        return;
    }

    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View PDF";

    Object.assign(link.style, {
        display: "inline-block",
        padding: "7px 12px",
        backgroundColor: "#2563eb",
        color: "#fff",
        textDecoration: "none",
        borderRadius: "6px",
        fontSize: "13px"
    });

    cell.appendChild(link);
}

// ==========================================
// INITIALIZE STUDENT PORTAL
// ==========================================

async function initializeStudentPortal() {
    console.log("AIMS Student Homework JS Loaded");

    try {
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
            window.location.href = "student-login.html";
            return;
        }

        currentUser = sessionData.session.user;

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();

        if (profileError) throw profileError;

        if (profile.role !== "student") {
            throw new Error("This account is not a Student account.");
        }

        const { data: student, error: studentError } = await db
            .from("students")
            .select("id, student_name")
            .eq("user_id", currentUser.id)
            .single();

        if (studentError) throw studentError;

        currentStudent = student;

        console.log("Logged-in Student:", currentStudent);

        await loadHomework();
        await loadSubmissionHistory();

    } catch (error) {
        showError(error);

        historyTable.innerHTML = `
            <tr>
                <td colspan="5">
                    Unable to load history:
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
    }
}

// ==========================================
// LOAD ASSIGNED HOMEWORK
// ==========================================

async function loadHomework() {
    homeworkTable.innerHTML = `
        <tr>
            <td colspan="4">Loading homework...</td>
        </tr>
    `;

    const { data: enrollment, error: enrollmentError } = await db
        .from("enrollments")
        .select("section_id")
        .eq("student_id", currentStudent.id)
        .limit(1)
        .maybeSingle();

    if (enrollmentError) throw enrollmentError;

    if (!enrollment) {
        homeworkTable.innerHTML = `
            <tr>
                <td colspan="4">No class enrollment found.</td>
            </tr>
        `;
        return;
    }

    const { data: homeworkList, error } = await db
        .from("homework")
        .select("id, title, description, due_date, file_path")
        .eq("section_id", enrollment.section_id)
        .order("created_at", { ascending: false });

    if (error) throw error;

    if (!homeworkList || homeworkList.length === 0) {
        homeworkTable.innerHTML = `
            <tr>
                <td colspan="4">No homework assigned yet.</td>
            </tr>
        `;
        return;
    }

    homeworkTable.innerHTML = "";

    for (const item of homeworkList) {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(item.title)}</td>
            <td>${escapeHTML(item.description || "-")}</td>
            <td>${escapeHTML(item.due_date || "-")}</td>
            <td>
                <button type="button" class="select-btn">
                    Select
                </button>
                <div class="homework-pdf"></div>
            </td>
        `;

        row.querySelector(".select-btn").addEventListener("click", () => {
            homeworkIdInput.value = item.id;
            selectedHomework.value = item.title;
            showMessage("Homework selected.");
        });

        await createPdfLink(
            item.file_path,
            row.querySelector(".homework-pdf")
        );

        homeworkTable.appendChild(row);
    }
}

// ==========================================
// LOAD SUBMISSION HISTORY
// ==========================================

async function loadSubmissionHistory() {
    historyTable.innerHTML = `
        <tr>
            <td colspan="5">Loading submission history...</td>
        </tr>
    `;

    try {
        const { data, error } = await db
            .from("homework_submissions")
            .select(`
                id,
                homework_id,
                submission_text,
                file_path,
                submitted_at,
                status
            `)
            .eq("student_id", currentStudent.id)
            .order("submitted_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            historyTable.innerHTML = `
                <tr>
                    <td colspan="5">No homework submissions found.</td>
                </tr>
            `;
            return;
        }

        const homeworkIds = [
            ...new Set(data.map(item => item.homework_id))
        ];

        const { data: homeworkList, error: homeworkError } = await db
            .from("homework")
            .select("id, title")
            .in("id", homeworkIds);

        if (homeworkError) throw homeworkError;

        const homeworkMap = {};

        (homeworkList || []).forEach(hw => {
            homeworkMap[hw.id] = hw.title;
        });

        historyTable.innerHTML = "";

        for (const item of data) {
            const row = document.createElement("tr");

            const homeworkName =
                homeworkMap[item.homework_id] || "Homework";

            const submittedDate = item.submitted_at
                ? new Date(item.submitted_at).toLocaleString()
                : "-";

            const status = item.status || "submitted";

            row.innerHTML = `
                <td>${escapeHTML(homeworkName)}</td>
                <td>${escapeHTML(submittedDate)}</td>
                <td>${escapeHTML(item.submission_text || "-")}</td>
                <td class="history-pdf"></td>
                <td>
                    <span class="history-status"></span>
                </td>
            `;

            await createPdfLink(
                item.file_path,
                row.querySelector(".history-pdf")
            );

            const statusElement = row.querySelector(".history-status");

            statusElement.textContent =
                status.charAt(0).toUpperCase() + status.slice(1);

            const statusColors = {
                submitted: "#2563eb",
                reviewed: "#16a34a",
                late: "#dc2626",
                pending: "#d97706"
            };

            Object.assign(statusElement.style, {
                display: "inline-block",
                padding: "6px 11px",
                borderRadius: "20px",
                color: "#ffffff",
                backgroundColor: statusColors[status] || "#64748b",
                fontSize: "12px",
                fontWeight: "600"
            });

            historyTable.appendChild(row);
        }

    } catch (error) {
        console.error("History Loading Error:", error);

        historyTable.innerHTML = `
            <tr>
                <td colspan="5">
                    History Error: ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
    }
}

// ==========================================
// SUBMIT HOMEWORK PDF
// ==========================================

submissionForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    showMessage("", "red");

    if (!currentStudent || !currentUser) {
        showMessage("Student login required.", "red");
        return;
    }

    const homeworkId = homeworkIdInput.value;
    const file = pdfFile.files[0];

    if (!homeworkId) {
        showMessage("Please select homework first.", "red");
        return;
    }

    if (!file) {
        showMessage("Please select a PDF file.", "red");
        return;
    }

    if (
        file.type !== "application/pdf" ||
        !file.name.toLowerCase().endsWith(".pdf")
    ) {
        showMessage("Only PDF files are allowed.", "red");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showMessage("PDF size must be below 5 MB.", "red");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";

    let uploadedFilePath = null;

    try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

        uploadedFilePath =
            `student/${currentUser.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await db.storage
            .from(BUCKET)
            .upload(uploadedFilePath, file, {
                contentType: "application/pdf",
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { error: insertError } = await db
            .from("homework_submissions")
            .insert({
                homework_id: Number(homeworkId),
                student_id: currentStudent.id,
                submission_text: submissionText.value.trim(),
                file_path: uploadedFilePath,
                status: "submitted"
            });

        if (insertError) {
            await db.storage
                .from(BUCKET)
                .remove([uploadedFilePath]);

            uploadedFilePath = null;
            throw insertError;
        }

        showMessage("Homework PDF submitted successfully!");

        submissionForm.reset();
        homeworkIdInput.value = "";

        await loadSubmissionHistory();

    } catch (error) {
        console.error("PDF submission error:", error);

        showMessage(
            error.message || "Submission failed.",
            "red"
        );

    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Homework";
    }
});

// ==========================================
// START APPLICATION
// ==========================================

initializeStudentPortal();
