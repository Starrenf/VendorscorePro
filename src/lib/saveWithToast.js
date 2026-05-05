export async function saveWithToast(operation, toast, messages = {}) {
  const { loading = "Opslaan...", success = "Opgeslagen.", error = "Opslaan mislukt." } = messages;
  const id = toast?.info ? toast.info(loading, "Bezig", { duration: 0 }) : null;
  try {
    const result = await (typeof operation === "function" ? operation() : operation);
    if (result?.error) throw result.error;
    if (id && toast?.dismiss) toast.dismiss(id);
    toast?.success?.(success);
    return result;
  } catch (err) {
    if (id && toast?.dismiss) toast.dismiss(id);
    toast?.error?.(err?.message || error);
    throw err;
  }
}
