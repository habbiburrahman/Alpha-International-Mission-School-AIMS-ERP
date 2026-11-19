
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const loginForm = document.getElementById("studentLoginForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("loginBtn");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    message.textContent = "";
    message.style.color = "";

    const studentId = document
        .getElementById("studentId")
        .value.trim();

    const password = document
        .getElementById("password")
        .value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
        const { data, error } = await db.functions.invoke(
            "student-login",
            {
                body: {
                    student_id: studentId,
                    password: password
                }
            }
        );

        if (error) {
            throw new Error(
                data?.error || error.message || "Login failed."
            );
        }

        if (!data?.success || !data.access_token || !data.refresh_token) {
            throw new Error(data?.error || "Invalid login response.");
        }

        // Create Supabase student session
        const { error: sessionError } = await db.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });

        if (sessionError) {
            throw sessionError;
        }

        // Verify student role
        const { data: userData, error: userError } =
            await db.auth.getUser();

        if (userError || !userData.user) {
            await db.auth.signOut();
            throw new Error("Unable to verify student account.");
        }

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", userData.user.id)
            .single();

        if (profileError || profile?.role !== "student") {
            await db.auth.signOut();
            throw new Error("This account is not a Student account.");
        }

        message.style.color = "green";
        message.textContent = "Login successful!";

        window.location.href = "student-dashboard.html";

    } catch (error) {
        console.error("Student Login Error:", error);

        message.style.color = "red";
        message.textContent = error.message;

    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
    }
});
