import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const strings = z.array(z.string());
const provider = z
  .object({
    identifier: z.string(),
    providerType: z.string(),
    issuer: z.string(),
    enabled: z.boolean(),
    pkceEnabled: z.boolean(),
    skipNonceCheck: z.boolean(),
    scopes: strings,
  })
  .strict();
const variable = z
  .object({
    key: z.string(),
    target: z.array(z.enum(["production", "preview", "development"])),
    gitBranch: z.string().nullable(),
  })
  .strict();

/** Safe observed metadata; unexpected fields (including values/secrets) are rejected. */
export const snapshotSchema = z
  .object({
    environment: z.literal("prod"),
    capturedAt: z.string().datetime(),
    projectRef: z.string(),
    providers: z.array(provider).nullable(),
    auth: z.object({ siteUrl: z.string(), redirectAllowList: strings }).strict().nullable(),
    database: z.object({ migrationVersions: strings, schemaDigest: digest }).strict().nullable(),
    vercel: z
      .object({ projectId: z.string(), teamId: z.string(), variables: z.array(variable) })
      .strict()
      .nullable(),
  })
  .strict();

/** A schema reference generated only from this checkout's migration-built disposable stack. */
export const baselineSchema = z
  .object({
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    migrationsDigest: digest,
    queryDigest: digest,
    schemaDigest: digest,
  })
  .strict();

/** The production identities and non-secret configuration expectations. */
export const contractSchema = z
  .object({
    vercelProjectId: z.string(),
    vercelTeamId: z.string(),
    requiredVariables: strings,
    forbiddenVariables: strings,
    environments: z
      .object({
        prod: z
          .object({ projectRef: z.string(), siteUrl: z.string(), redirectAllowList: strings })
          .strict(),
      })
      .strict(),
  })
  .strict();

/** Parsed comparison inputs, containing no credential values. */
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Baseline = z.infer<typeof baselineSchema>;
export type Contract = z.infer<typeof contractSchema>;

/** One criterion's outcome; missing evidence cannot pass. */
export interface Result {
  readonly check: string;
  readonly outcome: "passed" | "mismatch" | "unavailable";
}
