
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const homeworkForm = document.getElementById("homeworkForm");
const classSelect = document.getElementById("classSelect");
const sectionSelect = document.getElementById("sectionSelect");
const subjectSelect = document.getElementById("subjectSelect");
const homeworkTable = document.getElementById("homeworkTable");
const assignedDate = document.getElementById("assignedDate");
const dueDate = document.getElementById("dueDate");
const submitBtn = document.getElementById("submitBtn");

let isAdmin = false;
let editingHomeworkId = null;

// TODAY DATE
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// HTML SECURITY
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// ADMIN CHECK
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
        alert("Only Admin can manage homework.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// LOAD CLASSES
async function loadClasses() {
    const { data, error } = await db
        .from("classes")
        .select("id, class_name")
        .order("id");

    if (error) {
        console.error(error);
        alert("Unable to load classes.");
        return;
    }

    classSelect.innerHTML = '<option value="">Select Class</option>';

    data.forEach(item => {
        classSelect.innerHTML += `
            <option value="${item.id}">
                ${escapeHTML(item.class_name)}
            </option>
        `;
    });
}

// LOAD SECTIONS
async function loadSections(classId, selectedSectionId = null) {
    sectionSelect.innerHTML =
        '<option value="">Select Section</option>';

    sectionSelect.disabled = true;

    if (!classId) return;

    const { data, error } = await db
        .from("sections")
        .select("id, section_name")
        .eq("class_id", classId)
        .order("section_name");

    if (error) {
        console.error(error);
        alert("Unable to load sections.");
        return;
    }

    data.forEach(item => {
        sectionSelect.innerHTML += `
            <option value="${item.id}">
                ${escapeHTML(item.section_name)}
            </option>
        `;
    });

    sectionSelect.disabled = false;

    if (selectedSectionId !== null) {
        sectionSelect.value = String(selectedSectionId);
    }
}

// LOAD SUBJECTS
async function loadSubjects() {
    const { data, error } = await db
        .from("subjects")
        .select("id, subject_name")
        .order("subject_name");

    if (error) {
        console.error(error);
        alert("Unable to load subjects.");
        return;
    }

    subjectSelect.innerHTML =
        '<option value="">Select Subject</option>';

    data.forEach(item => {
        subjectSelect.innerHTML += `
            <option value="${item.id}">
                ${escapeHTML(item.subject_name)}
            </option>
        `;
    });
}

// LOAD HOMEWORK
async function loadHomework() {
    homeworkTable.innerHTML = `
        <tr>
            <td colspan="7">Loading homework...</td>
        </tr>
    `;

    const { data, error } = await db
        .from("homework")
        .select(`
            *,
            classes(class_name),
            sections(section_name),
            subjects(subject_name)
        `)
        .order("id", { ascending: false });

    if (error) {
        console.error(error);

        homeworkTable.innerHTML = `
            <tr>
                <td colspan="7">Unable to load homework.</td>
            </tr>
        `;
        return;
    }

    if (!data || data.length === 0) {
        homeworkTable.innerHTML = `
            <tr>
                <td colspan="7">No homework assigned yet.</td>
            </tr>
        `;
        return;
    }

    homeworkTable.innerHTML = "";

    data.forEach(item => {
        homeworkTable.innerHTML += `
            <tr>
                <td>${escapeHTML(item.title)}</td>
                <td>${escapeHTML(item.classes?.class_name || "-")}</td>
                <td>${escapeHTML(item.sections?.section_name || "-")}</td>
                <td>${escapeHTML(item.subjects?.subject_name || "-")}</td>
                <td>${escapeHTML(item.assigned_date || "-")}</td>
                <td>${escapeHTML(item.due_date || "-")}</td>

                <td>
                    <button
                        class="edit-btn"
                        onclick="editHomework(${Number(item.id)})">
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteHomework(${Number(item.id)})">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

// ASSIGN / UPDATE HOMEWORK
homeworkForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const title = document.getElementById("title").value.trim();

    const description =
        document.getElementById("description").value.trim();

    const classId = classSelect.value;
    const sectionId = sectionSelect.value;
    const subjectId = subjectSelect.value;

    const assigned = assignedDate.value;
    const due = dueDate.value;

    if (!title || !classId || !sectionId || !subjectId || !due) {
        alert("Please fill all required fields.");
        return;
    }

    if (due < assigned) {
        alert("Submission date cannot be before assigned date.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = editingHomeworkId
        ? "Updating..."
        : "Saving...";

    const homeworkData = {
        title: title,
        description: description || null,
        class_id: Number(classId),
        section_id: Number(sectionId),
        subject_id: Number(subjectId),
        assigned_date: assigned,
        due_date: due
    };

    let result;

    if (editingHomeworkId) {
        result = await db
            .from("homework")
            .update(homeworkData)
            .eq("id", editingHomeworkId);
    } else {
        result = await db
            .from("homework")
            .insert([homeworkData]);
    }

    submitBtn.disabled = false;

    if (result.error) {
        console.error(result.error);

        alert(
            "Error: " + result.error.message
        );

        submitBtn.textContent = editingHomeworkId
            ? "Update Homework"
            : "Assign Homework";

        return;
    }

    alert(
        editingHomeworkId
            ? "Homework updated successfully!"
            : "Homework assigned successfully!"
    );

    resetHomeworkForm();

    await loadHomework();
});

// EDIT HOMEWORK
async function editHomework(id) {
    const { data, error } = await db
        .from("homework")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error(error);
        alert("Unable to load homework details.");
        return;
    }

    editingHomeworkId = id;

    document.getElementById("title").value = data.title || "";
    document.getElementById("description").value =
        data.description || "";

    classSelect.value = String(data.class_id);

    await loadSections(data.class_id, data.section_id);

    subjectSelect.value = String(data.subject_id);

    assignedDate.value = data.assigned_date || getTodayDate();
    dueDate.value = data.due_date || "";

    submitBtn.textContent = "Update Homework";

    document.querySelector(".form-section").scrollIntoView({
        behavior: "smooth"
    });
}

// RESET FORM
function resetHomeworkForm() {
    homeworkForm.reset();

    editingHomeworkId = null;

    assignedDate.value = getTodayDate();
    assignedDate.max = getTodayDate();
    dueDate.min = getTodayDate();

    sectionSelect.innerHTML =
        '<option value="">Select Section</option>';

    sectionSelect.disabled = true;

    submitBtn.textContent = "Assign Homework";
    submitBtn.disabled = false;
}

// DELETE HOMEWORK
async function deleteHomework(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this homework?"
    );

    if (!confirmed) return;

    const { error } = await db
        .from("homework")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        alert("Unable to delete homework: " + error.message);
        return;
    }

    alert("Homework deleted successfully!");

    await loadHomework();
}

// CANCEL EDIT
function cancelEdit() {
    resetHomeworkForm();
}

window.editHomework = editHomework;
window.deleteHomework = deleteHomework;
window.cancelEdit = cancelEdit;

// CLASS CHANGE
classSelect.addEventListener("change", function() {
    loadSections(this.value);
});

// INITIALIZE
async function initializePage() {
    assignedDate.value = getTodayDate();
    assignedDate.max = getTodayDate();
    dueDate.min = getTodayDate();

    isAdmin = await checkAdmin();

    if (!isAdmin) return;

    await loadClasses();
    await loadSubjects();
    await loadHomework();
}

initializePage();
