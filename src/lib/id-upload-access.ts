export function getIdUploadAccessResult(
  uploadAgentId: string,
  sessionAgentId: string
): { allowed: true } | { allowed: false; status: 403; message: string } {
  if (uploadAgentId !== sessionAgentId) {
    return { allowed: false, status: 403, message: "Forbidden." };
  }
  return { allowed: true };
}
