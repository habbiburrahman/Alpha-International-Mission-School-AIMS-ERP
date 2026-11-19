
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const examForm = document.getElementById("examForm");
const classSelect = document.getElementById("className");
const examTableBody = document.getElementById("examTableBody");
const message = document.getElementById("message");

let exams = [];

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
        alert("Only Admin can manage exams.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadClasses() {
    const { data, error } = await db
        .from("classes")
        .select("id, class_name")
        .order("id");

    if (error) {
        console.error(error);
        message.textContent = "Unable to load classes.";
        return;
    }

    classSelect.innerHTML = '<option value="">Select Class</option>';

    data.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.class_name;
        classSelect.appendChild(option);
    });
}

async function loadExams() {
    const { data, error } = await db
        .from("exams")
        .select("*, classes(class_name)")
        .order("exam_date", { ascending: false });

    if (error) {
        console.error(error);
        message.textContent = "Unable to load exams.";
        return;
    }

    exams = data || [];
    displayExams();
    updateSummary();
}


function displayExams() {
    examTableBody.innerHTML = "";

    if (exams.length === 0) {
        examTableBody.innerHTML =
            '<tr><td colspan="8">No exams found.</td></tr>';
        return;
    }

    exams.forEach(exam => {
        const row = document.createElement("tr");

        const values = [
            exam.id,
            exam.exam_name,
            exam.exam_type || "-",
            exam.classes?.class_name || "-",
            exam.exam_date,
            exam.total_marks,
            exam.passing_marks
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";

        deleteButton.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to delete this exam?")) {
                return;
            }

            const { error } = await db
                .from("exams")
                .delete()
                .eq("id", exam.id);

            if (error) {
                alert("Delete error: " + error.message);
                return;
            }

            await loadExams();
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        examTableBody.appendChild(row);
    });
}


function updateSummary() {
    const today = new Date().toISOString().slice(0, 10);

    document.getElementById("totalExams").textContent =
        exams.length;

    document.getElementById("upcomingExams").textContent =
        exams.filter(exam => exam.exam_date >= today).length;

    document.getElementById("completedExams").textContent =
        exams.filter(exam => exam.exam_date < today).length;
}

examForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const examName = document.getElementById("examName").value.trim();
    const examType = document.getElementById("examType").value;
    const classId = classSelect.value;
    const examDate = document.getElementById("examDate").value;
    const totalMarks = Number(document.getElementById("totalMarks").value);
    const passingMarks = Number(document.getElementById("passingMarks").value);

    if (!examName || !classId || !examDate ||
        totalMarks <= 0 || passingMarks < 0 ||
        passingMarks > totalMarks) {
        message.textContent = "Please enter valid exam details.";
        return;
    }

    const examData = {
        exam_name: examName,
        exam_type: examType,
        class_id: Number(classId),
        exam_date: examDate,
        total_marks: totalMarks,
        passing_marks: passingMarks
    };

    const { error } = await db
        .from("exams")
        .insert([examData]);

    if (error) {
        console.error(error);
        message.textContent = "Error: " + error.message;
        return;
    }

    message.textContent = "Exam saved successfully!";
    examForm.reset();

    await loadExams();
});

async function initializeExams() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    await loadClasses();
    await loadExams();
}

initializeExams();
