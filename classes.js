
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const classForm = document.getElementById("classForm");
const sectionForm = document.getElementById("sectionForm");

const classTableBody = document.getElementById("classTableBody");
const sectionTableBody = document.getElementById("sectionTableBody");
const sectionClass = document.getElementById("sectionClass");

const formMessage = document.getElementById("formMessage");
const sectionMessage = document.getElementById("sectionMessage");

// Check Admin Login
async function checkAdmin() {
    const { data } = await supabaseClient.auth.getSession();

    if (!data.session) {
        window.location.href = "index.html";
        return false;
    }

    const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

    if (error || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Load Classes
async function loadClasses() {
    const { data: classes, error } = await supabaseClient
        .from("classes")
        .select("*")
        .order("id");

    if (error) {
        console.error("Class loading error:", error);
        classTableBody.innerHTML =
            `<tr><td colspan="3">Unable to load classes.</td></tr>`;
        return;
    }

    classTableBody.innerHTML = "";
    sectionClass.innerHTML = `<option value="">Select Class</option>`;

    if (!classes || classes.length === 0) {
        classTableBody.innerHTML =
            `<tr><td colspan="3">No classes found.</td></tr>`;
        return;
    }

    classes.forEach(item => {
        const row = document.createElement("tr");

        const idCell = document.createElement("td");
        idCell.textContent = item.id;

        const nameCell = document.createElement("td");
        nameCell.textContent = item.class_name;

        const actionCell = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.onclick = () => editClass(item);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => deleteClass(item.id);

        actionCell.append(editBtn, deleteBtn);
        row.append(idCell, nameCell, actionCell);
        classTableBody.appendChild(row);

        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.class_name;
        sectionClass.appendChild(option);
    });
}

// Add Class
classForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const className = document.getElementById("className").value.trim();

    const { error } = await supabaseClient
        .from("classes")
        .insert({ class_name: className });

    if (error) {
        formMessage.textContent = "Error: " + error.message;
        formMessage.style.color = "red";
        return;
    }

    formMessage.textContent = "Class added successfully!";
    formMessage.style.color = "green";

    classForm.reset();
    await loadClasses();
});

// Edit Class
async function editClass(item) {
    const newName = prompt("Enter new class name:", item.class_name);

    if (newName === null || !newName.trim()) return;

    const { error } = await supabaseClient
        .from("classes")
        .update({ class_name: newName.trim() })
        .eq("id", item.id);

    if (error) {
        alert("Update failed: " + error.message);
        return;
    }

    alert("Class updated successfully!");
    await loadClasses();
}

// Delete Class
async function deleteClass(id) {
    if (!confirm("Are you sure you want to delete this class?")) return;

    const { error } = await supabaseClient
        .from("classes")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Delete failed: " + error.message);
        return;
    }

    alert("Class deleted successfully!");
    await loadClasses();
}

// Load Sections
async function loadSections() {
    const { data: sections, error } = await supabaseClient
        .from("sections")
        .select("id, section_name, class_id, classes(class_name)")
        .order("id");

    if (error) {
        console.error("Section loading error:", error);
        sectionTableBody.innerHTML =
            `<tr><td colspan="3">Unable to load sections.</td></tr>`;
        return;
    }

    sectionTableBody.innerHTML = "";

    if (!sections || sections.length === 0) {
        sectionTableBody.innerHTML =
            `<tr><td colspan="3">No sections found.</td></tr>`;
        return;
    }

    sections.forEach(item => {
        const row = document.createElement("tr");

        [item.id, item.classes?.class_name || "-", item.section_name].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        sectionTableBody.appendChild(row);
    });
}

// Add Section
sectionForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const classId = sectionClass.value;
    const sectionName = document.getElementById("sectionName").value.trim();

    const { error } = await supabaseClient
        .from("sections")
        .insert({
            class_id: classId,
            section_name: sectionName
        });

    if (error) {
        sectionMessage.textContent = "Error: " + error.message;
        sectionMessage.style.color = "red";
        return;
    }

    sectionMessage.textContent = "Section added successfully!";
    sectionMessage.style.color = "green";

    sectionForm.reset();
    await loadSections();
});

// Start Page
async function startPage() {
    const isAdmin = await checkAdmin();

    if (!isAdmin) return;

    await loadClasses();
    await loadSections();
}

startPage();
