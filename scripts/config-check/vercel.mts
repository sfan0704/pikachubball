import { z } from "zod";
import { snapshotSchema, type Contract, type Snapshot } from "./contracts.mts";

/** Read exact-project variable scopes without decrypting or retaining variable values. */
export async function collectVercel(
  contract: Pick<Contract, "vercelProjectId" | "vercelTeamId">,
  token: string,
  transport: typeof fetch = fetch
): Promise<NonNullable<Snapshot["vercel"]>> {
  try {
    const { vercelProjectId: projectId, vercelTeamId: teamId } = contract;
    if (!/^prj_[a-zA-Z0-9]+$/.test(projectId) || !/^team_[a-zA-Z0-9]+$/.test(teamId) || !token)
      throw new Error();
    const read = async (
      path: string,
      parameters: Record<string, string> = {}
    ): Promise<unknown> => {
      const url = new URL(path, "https://api.vercel.com");
      url.searchParams.set("teamId", teamId);
      for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      const response = await transport(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      return response.json();
    };
    const project = z
      .object({ id: z.literal(projectId), accountId: z.literal(teamId) })
      .parse(await read(`/v9/projects/${projectId}`));
    const variable = snapshotSchema.shape.vercel.unwrap().shape.variables.element;
    const response = z
      .object({
        envs: z.array(variable.strip().extend({ gitBranch: z.string().nullable().optional() })),
      })
      .parse(await read(`/v10/projects/${projectId}/env`, { decrypt: "false" }));
    return snapshotSchema.shape.vercel.unwrap().parse({
      projectId: project.id,
      teamId: project.accountId,
      variables: response.envs.map(({ key, target, gitBranch }) => ({
        key,
        target,
        gitBranch: gitBranch ?? null,
      })),
    });
  } catch {
    // Platform bodies, validation errors and transport errors can contain credentials.
    throw new Error("Vercel metadata access unavailable");
  }
}
