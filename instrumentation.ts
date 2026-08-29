export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { bootstrapFacebookAutoResume } = await import("./app/facebook-auto/lib/bot");
  void bootstrapFacebookAutoResume().catch((error) => {
    console.error("Không thể bootstrap resume Auto Facebook:", error);
  });

  const { bootstrapThreadsAutoResume } = await import("./app/threads-auto/lib/runtime");
  void bootstrapThreadsAutoResume().catch((error) => {
    console.error("Không thể bootstrap resume Auto Threads:", error);
  });
}