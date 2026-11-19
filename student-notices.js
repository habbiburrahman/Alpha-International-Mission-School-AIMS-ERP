
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const noticeContainer = document.getElementById("noticeContainer");

async function loadNotices() {
    try {
        const { data: { session }, error: sessionError } =
            await db.auth.getSession();

        if (sessionError || !session) {
            window.location.href = "index.html";
            return;
        }

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

        if (profileError || !profile ||
            !["student", "parent"].includes(profile.role)) {
            throw new Error("Access denied.");
        }

        const { data: notices, error } = await db
            .from("notices")
            .select("id, title, message, audience, created_at")
            .eq("is_published", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        const allowedAudiences = ["all", "students", "parents"];

        const visibleNotices = notices.filter(notice => {
            const audience = (notice.audience || "").toLowerCase();

            if (!allowedAudiences.includes(audience)) return false;

            if (audience === "all") return true;

            if (profile.role === "student") {
                return audience === "students";
            }

            return audience === "parents";
        });

        if (!visibleNotices.length) {
            noticeContainer.innerHTML = `
                <p class="empty-message">
                    No notices available right now.
                </p>
            `;
            return;
        }

        noticeContainer.innerHTML = visibleNotices.map(notice => `
            <article class="notice-card">
                <h3>${escapeHTML(notice.title)}</h3>

                <p class="notice-message">
                    ${escapeHTML(notice.message)}
                </p>

                <div class="notice-meta">
                    <span>Audience: ${escapeHTML(notice.audience || "All")}</span>
                    <span>${formatDate(notice.created_at)}</span>
                </div>
            </article>
        `).join("");

    } catch (error) {
        console.error("Notices error:", error);

        noticeContainer.innerHTML = `
            <p class="error-message">
                Unable to load notices. ${escapeHTML(error.message)}
            </p>
        `;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatDate(date) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

loadNotices();
