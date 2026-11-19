
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";
const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const noticeForm = document.getElementById("noticeForm");
const noticeId = document.getElementById("noticeId");
const titleInput = document.getElementById("title");
const messageInput = document.getElementById("message");
const audienceInput = document.getElementById("audience");
const isPublishedInput = document.getElementById("isPublished");
const noticesTable = document.getElementById("noticesTable");
const statusMessage = document.getElementById("statusMessage");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const formHeading = document.getElementById("formHeading");

let editingNoticeId = null;

// SHOW MESSAGE
function showMessage(message, success = true) {
    statusMessage.textContent = message;
    statusMessage.style.color = success ? "green" : "red";
}

// RESET FORM
function resetNoticeForm() {
    noticeForm.reset();
    noticeId.value = "";
    editingNoticeId = null;
    isPublishedInput.checked = true;
    saveBtn.textContent = "Save Notice";
    formHeading.textContent = "Create New Notice";
    cancelBtn.hidden = true;
}

// LOAD NOTICES
async function loadNotices() {
    noticesTable.innerHTML = `
        <tr><td colspan="5">Loading notices...</td></tr>
    `;

    const { data, error } = await db
        .from("notices")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Load notices error:", error);
        noticesTable.innerHTML = `
            <tr><td colspan="5">Unable to load notices.</td></tr>
        `;
        showMessage(error.message, false);
        return;
    }

    if (!data || data.length === 0) {
        noticesTable.innerHTML = `
            <tr><td colspan="5">No notices found.</td></tr>
        `;
        return;
    }

    noticesTable.innerHTML = "";

    data.forEach((notice) => {
        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = notice.title;

        const audienceCell = document.createElement("td");
        audienceCell.textContent = notice.audience;

        const statusCell = document.createElement("td");
        statusCell.textContent = notice.is_published ? "Published" : "Draft";
        statusCell.className = notice.is_published
            ? "status-published"
            : "status-draft";

        const dateCell = document.createElement("td");
        dateCell.textContent = notice.created_at
            ? new Date(notice.created_at).toLocaleDateString("en-IN")
            : "-";

        const actionCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.className = "action-btn edit-btn";
        editButton.addEventListener("click", () => editNotice(notice));

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "action-btn delete-btn";
        deleteButton.addEventListener("click", () => deleteNotice(notice.id));

        actionCell.append(editButton, deleteButton);
        row.append(titleCell, audienceCell, statusCell, dateCell, actionCell);
        noticesTable.appendChild(row);
    });
}

// ADD OR UPDATE NOTICE
noticeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const noticeData = {
        title: titleInput.value.trim(),
        message: messageInput.value.trim(),
        audience: audienceInput.value,
        is_published: isPublishedInput.checked
    };

    if (!noticeData.title || !noticeData.message) {
        showMessage("Please fill in all required fields.", false);
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    let result;

    if (editingNoticeId) {
        result = await db
            .from("notices")
            .update({
                ...noticeData,
                updated_at: new Date().toISOString()
            })
            .eq("id", editingNoticeId);
    } else {
        result = await db
            .from("notices")
            .insert([noticeData]);
    }

    saveBtn.disabled = false;
    saveBtn.textContent = editingNoticeId ? "Update Notice" : "Save Notice";

    if (result.error) {
        console.error("Save notice error:", result.error);
        showMessage(result.error.message, false);
        return;
    }

    showMessage(editingNoticeId ? "Notice updated successfully!" : "Notice added successfully!");
    resetNoticeForm();
    await loadNotices();
});

// EDIT NOTICE
function editNotice(notice) {
    editingNoticeId = notice.id;

    noticeId.value = notice.id;
    titleInput.value = notice.title;
    messageInput.value = notice.message;
    audienceInput.value = notice.audience;
    isPublishedInput.checked = notice.is_published;

    saveBtn.textContent = "Update Notice";
    formHeading.textContent = "Edit Notice";
    cancelBtn.hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// DELETE NOTICE
async function deleteNotice(id) {
    const confirmed = confirm("Are you sure you want to delete this notice?");

    if (!confirmed) return;

    const { error } = await db
        .from("notices")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Delete notice error:", error);
        showMessage(error.message, false);
        return;
    }

    showMessage("Notice deleted successfully!");
    await loadNotices();
}

// CANCEL EDIT
cancelBtn.addEventListener("click", () => {
    resetNoticeForm();
    showMessage("Edit cancelled.");
});

// INITIAL LOAD
loadNotices();
